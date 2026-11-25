import {supabase} from './lib/supabase';
declare global {interface Window {DearDiaryAndroid?:{postMessage:(data:string)=>void}}}
// The native bridge is scoped to this exact HTTPS origin and top frame.
export function listenAndroidPush(uid:string|null){
 const bridge=window.DearDiaryAndroid;if(!bridge)return()=>{};
 let active=true;
 const onToken=async(e:Event)=>{const token=(e as CustomEvent).detail;if(!uid||typeof token!=='string'||token.length<20||token.length>4096)return;
  const {data:{session}}=await supabase.auth.getSession();if(!active||session?.user.id!==uid)return;
  await fetch(import.meta.env.VITE_SUPABASE_URL+'/functions/v1/android-push-token',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({token})}).catch(()=>{});
 };
 window.addEventListener('dd-android-token',onToken);
 bridge.postMessage(JSON.stringify(uid?{op:'bind',uid}:{op:'unbind'}));bridge.postMessage(JSON.stringify({op:'ready'}));
 return()=>{active=false;window.removeEventListener('dd-android-token',onToken);};
}
