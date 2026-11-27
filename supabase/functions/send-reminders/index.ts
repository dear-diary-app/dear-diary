import {sendAndroid} from '../_shared/android-push.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const messages:Record<string,string>={
 ask:'11 PM /ask reminder: if you have not used today’s question, you can ask before midnight IST.',
 open:'A new diary page is ready. Your writing window is open until 10 PM.',
 writing:'A gentle reminder to write today’s diary page. Your writing window closes at 10 PM.',
 lock:'15 minutes left to write. Your diary locks at 10 PM.',
 published:'It is 10 PM. Writing is closed and nightly reading time has begun.',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const secret=Deno.env.get('DIARY_PUSH_CRON');
 if(!secret||req.headers.get('x-diary-cron')!==secret)return json({error:'unauthorized'},401);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 webpush.setVapidDetails('https://dear-diary-app.github.io',Deno.env.get('VAPID_PUBLIC_KEY')!,Deno.env.get('VAPID_PRIVATE_KEY')!);
 const {data:rows,error}=await db.rpc('claim_diary_reminders');
 if(error)return json({error:'claim_failed'},500);
 let sent=0,failed=0,expired=0;
 for(const row of rows??[]){
  let host='';try{host=new URL(row.endpoint).hostname;}catch{}
  const allowed=['fcm.googleapis.com','updates.push.services.mozilla.com'].includes(host)||host.endsWith('.push.apple.com');
  if(!allowed||!row.endpoint.startsWith('https://')){
   await db.from('push_subscriptions').delete().eq('id',row.subscription_id);expired++;continue;
  }
  try{
   const {data:recipient,error:recipientError}=await db.from('push_subscriptions').select('user_id').eq('id',row.subscription_id).single();
   if(recipientError||!recipient)throw new Error('recipient_unavailable');
   await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify({title:'Dear Diary',account_id:recipient.user_id,type:row.event,body:messages[row.event],tag:`diary-${row.event}-${row.day}`,url:'/dear-diary/'}),{TTL:600,urgency:'normal',timeout:10000});sent++;
  }catch(err){
   const status=(err as {statusCode?:number}).statusCode;
   if(status===404||status===410){await db.from('push_subscriptions').delete().eq('id',row.subscription_id);expired++;}
   else{await db.from('push_deliveries').delete().eq('subscription_id',row.subscription_id).eq('event',row.event).eq('day',row.day);failed++;}
  }
 }
 let nativeSent=0,nativeFailed=0;
 if(Deno.env.get('FCM_SERVICE_ACCOUNT')){
 const {data:nativeRows,error:nativeError}=await db.rpc('claim_android_reminders');
 if(!nativeError)for(const row of nativeRows||[]){const result=await sendAndroid(db,row.user_id,row.event,row.token);nativeSent+=result.sent;nativeFailed+=result.failed;if(result.failed)await db.from('android_push_deliveries').delete().eq('token',row.token).eq('event',row.event).eq('day',row.day);}
 }
 return json({sent,failed,expired,nativeSent,nativeFailed});
});
