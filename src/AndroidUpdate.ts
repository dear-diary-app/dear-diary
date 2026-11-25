import React,{useEffect,useState}from'react';
import{supabase}from'./lib/supabase';
let pendingRelease:any=null;
let installedCode:number|null=null;
const notify=()=>window.dispatchEvent(new Event('dd-update-badge'));
export function AndroidUpdateBadge(){const[release,setRelease]=useState(pendingRelease);useEffect(()=>{const changed=()=>setRelease(pendingRelease);window.addEventListener('dd-update-badge',changed);return()=>window.removeEventListener('dd-update-badge',changed);},[]);return release?React.createElement('button',{type:'button',className:'dd-iconbtn dd-update-badge','aria-label':'Update to Dear Diary '+release.version,title:'Update available',onClick:()=>window.dispatchEvent(new Event('dd-update-reopen'))},React.createElement('svg',{width:23,height:23,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,'aria-hidden':true},React.createElement('path',{d:'M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4',strokeLinecap:'round',strokeLinejoin:'round'})),React.createElement('span',{className:'dd-update-dot','aria-hidden':true})):null;}
export function listenAndroidUpdate(uid:string|null){
 const bridge=window.DearDiaryAndroid;if(!bridge)return()=>{};let active=true,busy=false;pendingRelease=null;notify();
 const request=async(e:Event)=>{const d=(e as CustomEvent).detail;if(!uid||busy||!Number.isInteger(d?.current))return;installedCode=d.current;busy=true;
  try{const{data:{session}}=await supabase.auth.getSession();if(!active||session?.user.id!==uid)return;
   const response=await fetch(import.meta.env.VITE_SUPABASE_URL+'/functions/v1/android-update',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+session.access_token,apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({action:d.action==='download'?'download':'check',current:d.current,code:d.code})});
   if(!response.ok)throw Error();const result=await response.json();if(active){const unchanged=d.silent&&pendingRelease?.code===result.code;if(d.action!=='download'){pendingRelease=result.available?result:null;notify();}if(!unchanged)bridge.postMessage(JSON.stringify({op:'update-result',action:d.action,...result}));}
  }catch{if(active)bridge.postMessage(JSON.stringify({op:'update-error',action:d.action}));}finally{busy=false;}
 };
 const recheck=()=>{if(!uid||document.hidden)return;const current=(window as any).ddInstalledCode??installedCode;if(current!==null&&Number.isInteger(current)&&current>0)void request(new CustomEvent('dd-android-update',{detail:{action:'check',current,silent:true}}));else bridge.postMessage(JSON.stringify({op:'update-ready'}));};const visible=()=>{if(!document.hidden)recheck();};window.addEventListener('dd-native-authenticated',recheck);document.addEventListener('visibilitychange',visible);const retry=window.setTimeout(recheck,1500);
 const reopen=()=>{if(uid&&pendingRelease)bridge.postMessage(JSON.stringify({op:'update-result',action:'check',...pendingRelease}));};window.addEventListener('dd-update-reopen',reopen);window.addEventListener('dd-android-update',request);if(uid){bridge.postMessage(JSON.stringify({op:'update-ready'}));}
 return()=>{active=false;window.clearTimeout(retry);window.removeEventListener('dd-native-authenticated',recheck);document.removeEventListener('visibilitychange',visible);pendingRelease=null;notify();window.removeEventListener('dd-update-reopen',reopen);window.removeEventListener('dd-android-update',request);};
}
