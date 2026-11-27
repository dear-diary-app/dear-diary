import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { useAuth } from './store';
import { VAPID_PUBLIC_KEY } from './push-public';
const supported=()=> 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const ios=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const installed=()=>matchMedia('(display-mode: standalone)').matches||(navigator as Navigator & {standalone?:boolean}).standalone;
const registration=()=>navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
export async function disableDevicePush(){
 if(!supported())return;
 const reg=await registration(),sub=await reg?.pushManager.getSubscription();
 if(!sub)return;
 await sub.unsubscribe();
 const {error}=await supabase.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);
 if(error)throw new Error('Device permission removed. Server cleanup will finish when the expired endpoint is detected.');
}
export function PushSettings(){
 const {session}=useAuth();const [busy,setBusy]=useState(true),[enabled,setEnabled]=useState(false),[message,setMessage]=useState('Checking this device...');
 const refresh=async()=>{
  if(!supported()){setMessage(ios()?'On iPad/iPhone, add Dear Diary to your Home Screen in Safari, then open it there to enable notifications. Requires iPadOS/iOS 16.4 or later.':'This browser does not support Web Push. Try Android Chrome or another supported browser.');setBusy(false);return;}
  const reg=await registration(),sub=await reg?.pushManager.getSubscription();
  if(sub){const {data,error}=await supabase.from('push_subscriptions').select('id').eq('endpoint',sub.endpoint).maybeSingle();if(error)throw error;setEnabled(!!data);setMessage(data?'Notifications are enabled on this device.': 'This device is not registered. Enable notifications below.');}
  else{setEnabled(false);setMessage(Notification.permission==='denied'?'Notifications are blocked. Allow them in your browser/site settings, then return here.':'Enable reminders on this device when you are ready.');}setBusy(false);
 };
 useEffect(()=>{void refresh().catch(()=>{setMessage('Could not check this device. Check your connection and retry.');setBusy(false);});},[]);
 const enable=async()=>{
  if(busy)return;setBusy(true);
  try{
   // Ask only after this explicit button tap, never on launch or page entry.
   const permission=await Notification.requestPermission();
   if(permission!=='granted'){setMessage(permission==='denied'?'Permission denied. Allow notifications in browser/site settings to try again.':'Permission was not granted. Nothing was enabled.');return;}
   const reg=await registration();if(!reg?.active)throw new Error('The app is still preparing offline support. Reload once, then enable notifications.');
   const raw=atob(VAPID_PUBLIC_KEY.replace(/-/g,'+').replace(/_/g,'/'));const key=Uint8Array.from(raw,c=>c.charCodeAt(0));
   const sub=await reg.pushManager.getSubscription()??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});const data=sub.toJSON();
   const {error}=await supabase.from('push_subscriptions').upsert({user_id:session!.user.id,endpoint:sub.endpoint,p256dh:data.keys!.p256dh,auth:data.keys!.auth},{onConflict:'endpoint'});
   if(error)throw new Error('Could not register this device. Check your connection and retry.');
   setEnabled(true);setMessage('Notifications enabled on this device. Your selected reminders will arrive even when the app is closed.');
  }catch(error){setMessage(error instanceof Error?error.message:'Could not enable notifications. Please retry.');}finally{setBusy(false);}
 };
 return <section className="dd-card dd-push-settings" aria-labelledby="push-heading"><h2 id="push-heading" className="dd-card-title">This device</h2>
 <p className="dd-card-sub" role="status">{message}</p>
 {ios()&&!installed()&&<p className="dd-card-note">Use the Home Screen app on iPad or iPhone, not a normal Safari tab.</p>}
 {supported()&&<button type="button" className="dd-btn dd-btn-primary" disabled={busy} onClick={()=>{if(!enabled)void enable();else{setBusy(true);void disableDevicePush().then(()=>{setEnabled(false);setMessage('Notifications disabled on this device.');}).catch(e=>setMessage(e.message)).finally(()=>setBusy(false));}}}>{busy?'Checking...':enabled?'Disable on this device':'Enable notifications on this device'}</button>}
 <p className="dd-card-note">Times are India Standard Time: 6:00 AM new page, 9:00 PM writing reminder, 9:45 PM before lock, 10:00 PM reading time, and 11:00 PM /ask reminder when enabled and unused today. Only reminders you leave on below are sent. No diary text appears in notifications.</p>
 <p className="dd-card-note">Delivery needs internet and browser/OS permission. Battery saving, Focus/Do Not Disturb, or a force-stopped browser can delay or block alerts. Timing is best effort, not an alarm.</p></section>;
}
