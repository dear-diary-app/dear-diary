import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const secret=Deno.env.get('DIARY_PUSH_CRON');
 if(!secret||req.headers.get('x-diary-cron')!==secret)return json({error:'unauthorized'},401);
 let id='';try{id=String((await req.json()).id??'');}catch{}
 if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:'bad_id'},400);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data:msg,error:msgErr}=await db.from('chat_messages').select('id,sender_id,recipient_id,sticker,created_at').eq('id',id).maybeSingle();
 if(!msg){if(msgErr)console.error('chat_push_read',msgErr.message);return json({sent:0,reason:'gone',err:msgErr?.message??null});}
 // Only fresh messages, so a retried call never replays old chat.
 if(Date.now()-new Date(msg.created_at).getTime()>120000)return json({sent:0,reason:'stale'});
 const {data:settings}=await db.from('app_settings').select('notifications').eq('user_id',msg.recipient_id).maybeSingle();
 if((settings?.notifications as Record<string,unknown>|null)?.chat===false)return json({sent:0,reason:'muted'});
 const {data:sender}=await db.from('profiles').select('display_name').eq('id',msg.sender_id).maybeSingle();
 const name=String(sender?.display_name||'Someone').slice(0,40);
 const {data:subs}=await db.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id',msg.recipient_id);
 webpush.setVapidDetails('https://dear-diary-app.github.io',Deno.env.get('VAPID_PUBLIC_KEY')!,Deno.env.get('VAPID_PRIVATE_KEY')!);
 let sent=0,failed=0,expired=0;
 for(const s of subs??[]){
  let host='';try{host=new URL(s.endpoint).hostname;}catch{}
  const allowed=['fcm.googleapis.com','updates.push.services.mozilla.com'].includes(host)||host.endsWith('.push.apple.com');
  if(!allowed||!s.endpoint.startsWith('https://')){await db.from('push_subscriptions').delete().eq('id',s.id);expired++;continue;}
  try{
   // No message text in the notification, same privacy rule as the diary reminders.
   await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title:name,account_id:msg.recipient_id,type:'chat',body:msg.sticker?'Sent you a sticker':'Sent you a message',tag:`chat-${msg.sender_id}`,url:'/dear-diary/#/chat'}),{TTL:3600,urgency:'high',timeout:10000});sent++;
  }catch(err){
   const status=(err as {statusCode?:number}).statusCode;
   if(status===404||status===410){await db.from('push_subscriptions').delete().eq('id',s.id);expired++;}else failed++;
  }
 }
 return json({sent,failed,expired});
});
