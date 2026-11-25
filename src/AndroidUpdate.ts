import{supabase}from'./lib/supabase';
export function listenAndroidUpdate(uid:string|null){
 const bridge=window.DearDiaryAndroid;if(!bridge)return()=>{};let active=true,busy=false;
 const request=async(e:Event)=>{const d=(e as CustomEvent).detail;if(!uid||busy||!Number.isInteger(d?.current))return;busy=true;
  try{const{data:{session}}=await supabase.auth.getSession();if(!active||session?.user.id!==uid)return;
   const response=await fetch(import.meta.env.VITE_SUPABASE_URL+'/functions/v1/android-update',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+session.access_token,apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({action:d.action==='download'?'download':'check',current:d.current,code:d.code})});
   if(!response.ok)throw Error();const result=await response.json();if(active)bridge.postMessage(JSON.stringify({op:'update-result',action:d.action,...result}));
  }catch{if(active)bridge.postMessage(JSON.stringify({op:'update-error',action:d.action}));}finally{busy=false;}
 };
 window.addEventListener('dd-android-update',request);if(uid)bridge.postMessage(JSON.stringify({op:'update-ready'}));
 return()=>{active=false;window.removeEventListener('dd-android-update',request);};
}
