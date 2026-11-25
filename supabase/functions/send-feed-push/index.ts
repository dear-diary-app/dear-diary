import {sendAndroid} from '../_shared/android-push.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const secret=Deno.env.get('DIARY_PUSH_CRON');
 if(!secret||req.headers.get('x-diary-cron')!==secret)return json({error:'unauthorized'},401);
 let id='';try{id=String((await req.json()).id??'');}catch{}
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return json({error:'bad_id'},400);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data:events,error:claimError}=await db.rpc('claim_feed_alert',{p_id:id});
 if(claimError)return json({error:'claim_failed'},500);
 const event=events?.[0];if(!event)return json({sent:0,reason:'ineligible_or_claimed'});
 const {data:sender,error:senderError}=await db.from('profiles').select('display_name').eq('id',event.sender_id).maybeSingle();
 if(senderError)return json({error:'profile_unavailable'},500);
 const name=String(sender?.display_name||'Your friend').replace(/[\r\n\t]/g,' ').slice(0,40);
 const {data:subs,error:subError}=await db.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id',event.recipient_id);
 if(subError)return json({error:'subscriptions_unavailable'},500);
 webpush.setVapidDetails('https://dear-diary-app.github.io',Deno.env.get('VAPID_PUBLIC_KEY')!,Deno.env.get('VAPID_PRIVATE_KEY')!);
 let sent=0,failed=0,expired=0;
 for(const sub of subs??[]){
  // Re-check just before each send, so a newly disabled category stops this batch too.
  const {data:settings,error:settingsError}=await db.from('app_settings').select('notifications').eq('user_id',event.recipient_id).maybeSingle();
  if(settingsError||settings?.notifications?.feed===false)break;
  let host='';try{host=new URL(sub.endpoint).hostname;}catch{}
  if(!sub.endpoint.startsWith('https://')||!(['fcm.googleapis.com','updates.push.services.mozilla.com'].includes(host)||host.endsWith('.push.apple.com'))){expired++;continue;}
  try{
   await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({title:'Dear Diary',body:event.kind==='reaction'?'Your friend reacted to a feed post.':'Your friend commented on a feed post.',account_id:event.recipient_id,type:'feed',reply_action:false,tag:`feed-${event.post_id}`,post_id:event.post_id}),{TTL:120,urgency:'normal',timeout:10000});sent++;
  }catch(err){const status=(err as {statusCode?:number}).statusCode;if(status===404||status===410){await db.from('push_subscriptions').delete().eq('id',sub.id);expired++;}else failed++;}
 }
 const {data:nativeSettings,error:nativeSettingsError}=await db.from('app_settings').select('notifications').eq('user_id',event.recipient_id).maybeSingle();
 const native=nativeSettingsError||nativeSettings?.notifications?.feed===false?null:await sendAndroid(db,event.recipient_id,'feed');
 return json({sent,failed,expired,native});
});
