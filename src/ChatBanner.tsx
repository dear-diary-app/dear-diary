import {usePageLocked} from './DesktopIdleLock';
import React,{useEffect,useRef,useState}from'react';
import{useLocation,useNavigate}from'react-router-dom';
import{useChat,type ChatMsg}from'./ChatStore';
import{useAuth,useStore}from'./store';
import{otherId,personById}from'./model';
import{parseFeedReply}from'./FeedSocial';
import{IMAGE_CREDIT,imageUserCaption}from'./ChatImageSearch';
export function bannerPreview(m:ChatMsg){
 if(m.effect==='blur')return 'Blurred message';
 if(m.audio)return 'Voice note';if(m.song)return 'Song: '+m.song.title;if(m.weather)return 'Weather: '+m.weather.place;
 if(m.sticker)return 'Sticker';if(m.gif_id)return 'GIF';
 if(m.body==='/truthdare')return 'Truth or dare challenge';
 const body=parseFeedReply(m.body)?.text??(m.body.startsWith(IMAGE_CREDIT)?imageUserCaption(m.body):m.body);
 return (m.images.length?`${m.images.length===1?'Photo':'Photos'}${body?': ':''}`:'')+body||'New message';
}
export function ChatBanner(){const locked=usePageLocked();const chat=useChat(),store=useStore(),auth=useAuth(),loc=useLocation(),navigate=useNavigate();return <IncomingChatBanner chat={chat} enabled={!locked&&store.notifPrefs.chat!==false} sender={personById(otherId(auth.me!)).name} path={loc.pathname} onOpen={()=>navigate("/chat/thread")}/>;}
export function IncomingChatBanner({chat,enabled,sender,path,onOpen}:{onOpen:()=>void;chat:ReturnType<typeof useChat>;enabled:boolean;sender:string;path:string}){
 const[message,setMessage]=useState<ChatMsg|null>(null),[reply,setReply]=useState(false),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [remaining,setRemaining]=useState(100);
 const started=useRef(Date.now());
 const known=useRef<Set<string>|null>(null),queued=useRef<ChatMsg|null>(null),input=useRef<HTMLTextAreaElement>(null),sending=useRef(false),mounted=useRef(true),timer=useRef<number>();
 const away=path!=='/chat'&&!path.startsWith('/chat/');
 const close=()=>{setMessage(null);setReply(false);setText('');setError('');queued.current=null;};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;window.clearTimeout(timer.current);};},[]);
 useEffect(()=>{if(!chat.loaded)return;if(!known.current){known.current=new Set(chat.messages.map(m=>m.id));return;}
 const fresh=chat.messages.filter(m=>!known.current!.has(m.id));chat.messages.forEach(m=>known.current!.add(m.id));
 const incoming=fresh.filter(m=>m.sender_id!==chat.uid&&m.recipient_id===chat.uid&&!m.seen_at&&!m.state&&Date.parse(m.created_at)>=started.current-2000);
 if(!enabled||!away||document.hidden||!document.hasFocus())return;
 const newest=incoming[incoming.length-1];if(newest){setNotice('');if(reply||busy)queued.current=newest;else{setMessage(newest);setText('');setError('');}}
 },[chat.messages,chat.loaded,chat.uid,enabled,away,reply,busy]);
 useEffect(()=>{if(!enabled||!away)close();},[enabled,away]);
 useEffect(()=>{if(message&&!chat.messages.some(m=>m.id===message.id)){close();}else if(message){const latest=chat.messages.find(m=>m.id===message.id);if(latest&&latest.body!==message.body)setMessage(latest);}},[chat.messages,message?.id]);
 useEffect(()=>{const hide=()=>{if(document.hidden){close();setNotice('');}};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 useEffect(()=>{
  window.clearTimeout(timer.current);
  if(!message||reply||busy)return;
  const deadline=Date.now()+10000;setRemaining(100);
  const update=()=>setRemaining(Math.max(0,Math.min(100,(deadline-Date.now())/100)));
  const tick=window.setInterval(update,100);
  timer.current=window.setTimeout(()=>{setRemaining(0);setMessage(null);},10000);
  return()=>{window.clearTimeout(timer.current);window.clearInterval(tick);};
 },[message,reply,busy]);
 useEffect(()=>{if(reply)input.current?.focus();},[reply]);
 const send=async(e:React.FormEvent)=>{e.preventDefault();if(!message||!text.trim()||sending.current)return;sending.current=true;setBusy(true);setError('');let ok=false;try{ok=await chat.replyFromBanner(text,message.id);}catch{}sending.current=false;if(!mounted.current)return;setBusy(false);if(ok){setReply(false);setText('');setMessage(queued.current);queued.current=null;setNotice('Reply sent');window.setTimeout(()=>{if(mounted.current)setNotice('');},3000);}else setError('Reply could not send. Check Chat for Retry or Delete before sending again.');};
 if(!message)return notice?<div className="dd-chat-banner-notice" role="status">{notice}</div>:null;
 return <section className="dd-chat-banner" aria-label="New chat message" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'&&!busy)close();}}>
 <div className="dd-chat-banner-top"><button type="button" className="dd-chat-banner-open" aria-label={`Open chat with ${sender}`} disabled={busy} onClick={()=>{if(reply&&text.trim()&&!window.confirm("Leave your unsent quick reply and open Chat?"))return;close();onOpen();}}><strong>{sender}</strong><span>{bannerPreview(message).slice(0,240)}</span></button>{!reply&&<button type="button" className="dd-chat-banner-reply" onClick={()=>setReply(true)}>Reply</button>}<button type="button" className="dd-chat-banner-dismiss" aria-label="Dismiss message notification" onClick={close} disabled={busy}>×</button></div>
 <span className="dd-sr-only" role="status">New message from {sender}: {bannerPreview(message).slice(0,240)}</span>
 {reply&&<form onSubmit={e=>void send(e)}><label htmlFor="dd-banner-reply">Reply to {sender}</label><textarea id="dd-banner-reply" ref={input} maxLength={2000} rows={2} value={text} disabled={busy||!!error} onChange={e=>setText(e.target.value)} placeholder="Write a reply..."/><div className="dd-chat-banner-actions"><button type="button" onClick={close} disabled={busy}>Cancel</button><button type="submit" disabled={!text.trim()||busy||!!error}>{busy?'Sending...':'Send'}</button></div>{error&&<p role="alert">{error}</p>}</form>}
 {!reply&&!busy&&<div className="dd-chat-banner-duration" aria-hidden="true"><span style={{transform:`scaleX(${remaining/100})`}}/></div>}
 </section>;
}
