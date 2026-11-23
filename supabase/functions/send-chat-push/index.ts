import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const secret=Deno.env.get('DIARY_PUSH_CRON');
 if(!secret||req.headers.get('x-diary-cron')!==secret)return json({error:'unauthorized'},401);
 let id='',ack=false;try{const payload=await req.json();id=String(payload.id??'');ack=payload.scheduled_ack===true;}catch{}
 if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:'bad_id'},400);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data:msg,error:msgErr}=await db.from('chat_messages').select('id,sender_id,recipient_id,body,sticker,images,created_at,scheduled').eq('id',id).maybeSingle();
 if(!msg){if(msgErr)console.error('chat_push_read',msgErr.message);return json({sent:0,reason:'gone',err:msgErr?.message??null});}
 // Only fresh messages, so a retried call never replays old chat.
 if(Date.now()-new Date(msg.created_at).getTime()>120000)return json({sent:0,reason:'stale'});
 if(ack&&!msg.scheduled)return json({sent:0,reason:'not_scheduled'});
 const target=ack?msg.sender_id:msg.recipient_id;
 const {data:settings}=await db.from('app_settings').select('notifications').eq('user_id',target).maybeSingle();
 const prefs=settings?.notifications as Record<string,unknown>|null;
 if((settings?.notifications as Record<string,unknown>|null)?.chat===false)return json({sent:0,reason:'muted'});
 const {data:sender}=await db.from('profiles').select('display_name').eq('id',msg.sender_id).maybeSingle();
 const name=String(sender?.display_name||'Someone').slice(0,40);
 const {data:subs}=await db.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id',target);
 webpush.setVapidDetails('https://dear-diary-app.github.io',Deno.env.get('VAPID_PUBLIC_KEY')!,Deno.env.get('VAPID_PRIVATE_KEY')!);
 let sent=0,failed=0,expired=0;
 for(const s of subs??[]){
  let host='';try{host=new URL(s.endpoint).hostname;}catch{}
  const allowed=['fcm.googleapis.com','updates.push.services.mozilla.com'].includes(host)||host.endsWith('.push.apple.com');
  if(!allowed||!s.endpoint.startsWith('https://')){await db.from('push_subscriptions').delete().eq('id',s.id);expired++;continue;}
  try{
   // Opt-in is strict: unknown, failed or missing settings never reveal message text.
   const generic=msg.sticker?'Sent you a sticker':(msg.images?.length?(msg.images.length>1?'Sent you photos':'Sent you a photo'):'Sent you a message');
   const body=ack?'Your scheduled message was sent.':prefs?.chatPreview===true&&typeof msg.body==='string'&&msg.body.trim()?[...msg.body].slice(0,160).join(''):generic;
   await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title:ack?'Scheduled message sent':name,account_id:target,type:ack?'scheduled_sent':'chat',body,reply_action:!ack&&prefs?.chatReply===true,tag:ack?`scheduled-${msg.id}`:`chat-${msg.sender_id}`,url:'/dear-diary/#/chat'}),{TTL:3600,urgency:'high',timeout:10000});sent++;
  }catch(err){
   const status=(err as {statusCode?:number}).statusCode;
   if(status===404||status===410){await db.from('push_subscriptions').delete().eq('id',s.id);expired++;}else failed++;
  }
 }
 return json({sent,failed,expired});
});
