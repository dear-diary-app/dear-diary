import React,{useEffect,useRef} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from './store';
const allowed=(p:string)=>/^\/(?:$|chat(?:\/profile)?$|profile(?:\/(?:joydeep|aruba))?$|(?:hub|write|read|calendar|published|pin)\/(?:joydeep|aruba)$|settings(?:\/(?:how-to-use|whats-new|password|pin))?$|notifications$|inbox$)/.test(p);
// Device-local navigation metadata only. No diary/chat text, secrets or unlock grants.
export function ResumePlace({children}:{children:React.ReactNode}){
 const {session}=useAuth(),uid=session!.user.id,loc=useLocation(),nav=useNavigate();
 const key=`dd_place_${uid}`,started=useRef(false);
 useEffect(()=>{
  if(!started.current){started.current=true;try{const p=localStorage.getItem(key);if(loc.pathname==='/'&&!new URLSearchParams(loc.search).has('story')&&p&&allowed(p)&&p!=='/'){nav(p,{replace:true});return;}}catch{}}
  if(allowed(loc.pathname))try{localStorage.setItem(key,loc.pathname);}catch{}
 },[loc.pathname,key,nav]);
 useEffect(()=>{
  const k=`dd_scroll_${uid}_${loc.pathname}`;let ready=false,frame=0;
  let y=0;try{y=Number(localStorage.getItem(k)||0);}catch{}
  const restore=()=>{if(ready||!document.querySelector('.dd-route-page'))return;window.scrollTo(0,y);ready=true;observer.disconnect();};
  const observer=new MutationObserver(restore);observer.observe(document.getElementById('root')!,{childList:true,subtree:true});frame=requestAnimationFrame(restore);
  const save=()=>{if(!ready||!document.querySelector('.dd-route-page'))return;try{localStorage.setItem(k,String(window.scrollY));}catch{}};
  window.addEventListener('scroll',save,{passive:true});window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',save);
  return()=>{save();observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('scroll',save);window.removeEventListener('pagehide',save);document.removeEventListener('visibilitychange',save);};
 },[uid,loc.pathname]);
 return <>{children}</>;
}
