import{useCallback,useEffect,useRef,useState}from'react';
import type{RealtimeChannel}from'@supabase/supabase-js';
import{shareTypingEnabled}from'./typingPreference';
export function useChatTyping(uid:string,channel:React.MutableRefObject<RealtimeChannel|null>,joined:React.MutableRefObject<boolean>){
 const[partnerTyping,setPartnerTyping]=useState(false);const outgoing=useRef<number>(),incoming=useRef<number>(),last=useRef(0),sent=useRef(false);
 const foreground=()=>!document.hidden&&document.hasFocus()&&navigator.onLine;
 const stop=useCallback(()=>{window.clearTimeout(outgoing.current);last.current=0;if(sent.current&&channel.current&&joined.current)void channel.current.send({type:'broadcast',event:'typing',payload:{uid,on:false}});sent.current=false;},[uid,channel,joined]);
 const clear=useCallback(()=>{window.clearTimeout(incoming.current);setPartnerTyping(false);},[]);
 const receive=useCallback((on:boolean)=>{window.clearTimeout(incoming.current);setPartnerTyping(on&&foreground());if(on&&foreground())incoming.current=window.setTimeout(()=>setPartnerTyping(false),4000);},[]);
 const typing=useCallback((on:boolean)=>{if(!on||!foreground()||!shareTypingEnabled(uid)||!channel.current||!joined.current){stop();return;}window.clearTimeout(outgoing.current);const now=Date.now();if(!sent.current||now-last.current>=1200){last.current=now;sent.current=true;void channel.current.send({type:'broadcast',event:'typing',payload:{uid,on:true}});}outgoing.current=window.setTimeout(stop,2500);},[uid,channel,joined,stop]);
 useEffect(()=>{const away=()=>{if(!foreground()){stop();clear();}};const pagehide=()=>{stop();clear();};const pref=()=>{if(!shareTypingEnabled(uid))stop();};document.addEventListener('visibilitychange',away);window.addEventListener('blur',pagehide);window.addEventListener('offline',pagehide);window.addEventListener('pagehide',pagehide);window.addEventListener('dd-typing-preference',pref);window.addEventListener('storage',pref);return()=>{stop();window.clearTimeout(incoming.current);document.removeEventListener('visibilitychange',away);window.removeEventListener('blur',pagehide);window.removeEventListener('offline',pagehide);window.removeEventListener('pagehide',pagehide);window.removeEventListener('dd-typing-preference',pref);window.removeEventListener('storage',pref);};},[uid,stop,clear]);
 return{partnerTyping,typing,receive,clear,stop};
}
