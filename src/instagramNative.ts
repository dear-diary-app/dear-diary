import{instagramReel}from'./instagramReel';
import{friendModeOn}from'./friendPrivacy';
export function instagramSupport(){
 const w=window as any,bridge=typeof window.DearDiaryAndroid?.postMessage==='function';
 const apk=bridge||w.ddInstagramWebView===1||/DearDiaryAPK\//.test(navigator.userAgent);
 return{apk,bridge,embedded:bridge&&w.ddInstagramWebView===1,direct:bridge&&w.ddInstagramDirect===1};
}
export function openInstagramFromTab(event:{isTrusted:boolean;preventDefault:()=>void},locked:boolean){
 if(!event.isTrusted||locked||friendModeOn()||document.hidden||!document.querySelector('[data-dd-app-open="true"]')){event.preventDefault();return false;}
 if(!instagramSupport().direct)return false;
 event.preventDefault();window.DearDiaryAndroid?.postMessage(JSON.stringify({op:'instagram-tab'}));return true;
}

export function openInstagramReel(event:{isTrusted:boolean;preventDefault:()=>void},value:string){const url=instagramReel(value);if(!url)return false;event.preventDefault();if(!event.isTrusted||friendModeOn()||document.hidden||!document.querySelector('[data-dd-app-open="true"]'))return true;if(!instagramSupport().embedded||(window as any).ddInstagramReelLinks!==1){window.alert('Opening this reel inside Dear Diary needs Android APK 2.12 or newer. Update the APK on this device.');return true;}window.DearDiaryAndroid?.postMessage(JSON.stringify({op:'instagram-reel',url}));return true;}
