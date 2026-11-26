import{friendModeOn}from'./friendPrivacy';
// Default-deny Android screenshot policy. This does not expose a native unlock path.
export function startAndroidPrivacy(){
 const bridge=window.DearDiaryAndroid;if(!bridge)return()=>{};
 let last=true;
 const set=(secure:boolean)=>{if(secure===last)return;last=secure;bridge.postMessage(JSON.stringify({op:'screen-privacy',secure}));};
 const check=()=>{const path=location.hash.replace(/^#/,'').split('?')[0]||'/';
  const ownProfile=path==='/profile';
  const allowed=path==='/'||ownProfile||path==='/settings'||path==='/settings/how-to-use'||path==='/settings/whats-new';
  const route=document.querySelector('[data-dd-route]')?.getAttribute('data-dd-route');
  const locked=route!==path||document.documentElement.hasAttribute('data-page-slide')||!document.querySelector('[data-dd-app-open="true"]')||document.hidden||!!document.querySelector('[aria-label="Unlock Dear Diary"],.dd-login,.dd-security-page,[role="dialog"],.dd-crop-overlay,dialog[open],.dd-chat-banner,.dd-chat-banner-notice');
  const sensitiveSettings=path==='/settings'&&!!document.querySelector('[data-dd-private-settings] details[open],.dd-device-settings details[open],.dd-export details[open],section[aria-labelledby="privacy-heading"] details[open],input[type="password"]');
  set(friendModeOn()||!allowed||locked||sensitiveSettings);
 };
 const schedule=()=>check();
 const navigate=()=>{set(true);schedule();};
 const click=(e:Event)=>{const target=e.target as Element|null;if(target?.closest('a,button,summary'))set(true);};
 const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open','hidden','aria-label','class','data-dd-app-open','data-dd-route','data-page-slide']});
 window.addEventListener('hashchange',navigate);window.addEventListener('dd-native-background',navigate);document.addEventListener('click',click,true);document.addEventListener('visibilitychange',schedule);schedule();
 return()=>{set(true);observer.disconnect();window.removeEventListener('hashchange',navigate);window.removeEventListener('dd-native-background',navigate);document.removeEventListener('click',click,true);document.removeEventListener('visibilitychange',schedule);};
}
