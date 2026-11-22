import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './store';
import { TopBar } from './ui';
import { Bell, Clock } from './icons';

interface Notice { id: string; account_id: string; title: string; body: string; received_at: number; type: string }
const labels: Record<string,string> = {open:'New page',writing:'Writing reminder',lock:'Before lock',published:'Reading time',reminder:'Reminder'};
function readNotices(account: string): Promise<Notice[]> {
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('dear-diary-inbox',1);
  request.onupgradeneeded=()=>{const store=request.result.createObjectStore('notifications',{keyPath:'id'});store.createIndex('account','account_id');};
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result;const transaction=db.transaction('notifications','readonly');
   const read=transaction.objectStore('notifications').index('account').getAll(account);
   read.onsuccess=()=>resolve((read.result as Notice[]).sort((a,b)=>b.received_at-a.received_at));
   read.onerror=()=>reject(read.error);transaction.oncomplete=()=>db.close();transaction.onabort=()=>{db.close();reject(transaction.error);};
  };
 });
}
export function NotificationInbox(){
 const {session}=useAuth();const account=session!.user.id;
 const [state,setState]=useState<{account:string;rows:Notice[];loading:boolean;error:boolean}>({account,rows:[],loading:true,error:false});
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;
  const refresh=()=>{void readNotices(account).then(rows=>{if(active)setState({account,rows,loading:false,error:false});}).catch(()=>{if(active)setState({account,rows:[],loading:false,error:true});});};
  refresh();const message=(event:MessageEvent)=>{if(event.data?.type==='diary-inbox-updated'&&event.data?.account_id===account)refresh();};
  const visible=()=>{if(document.visibilityState==='visible')refresh();};
  navigator.serviceWorker?.addEventListener('message',message);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visible);
  return()=>{active=false;navigator.serviceWorker?.removeEventListener('message',message);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);};
 },[account,retry]);
 const current=state.account===account?state:{rows:[],loading:true,error:false};
 return <main className="dd-shell dd-shell-narrow"><TopBar back="/" backLabel="Back to the books" />
 <div className="dd-anim dd-inbox"><div className="dd-inbox-heading"><div><h1 className="dd-title">Your notifications</h1><p className="dd-sub">Little nudges, kept in one place</p></div></div>
 {current.loading?<section className="dd-card" role="status">Opening your notifications...</section>:current.error?<section className="dd-card" role="alert"><h2 className="dd-card-title">History could not open</h2><p className="dd-card-sub">Your browser may be blocking local storage. Your diary is unaffected.</p><button className="dd-btn dd-btn-ghost" onClick={()=>setRetry(x=>x+1)}>Retry</button></section>:current.rows.length===0?<section className="dd-card dd-inbox-empty"><div className="dd-inbox-orbit" aria-hidden="true"><Bell size={36}/><span/><span/></div><h2>No notifications yet</h2><p>When a reminder reaches this device, it will find a home here.</p><Link className="dd-btn dd-btn-primary" to="/notifications">Manage reminders</Link></section>:<ol className="dd-inbox-list" aria-label="Received notifications">{current.rows.map(row=><li className="dd-card dd-inbox-item" key={row.id}><div className="dd-inbox-icon" aria-hidden="true"><Bell size={21}/></div><div className="dd-inbox-copy"><span className="dd-inbox-type">{labels[row.type]||labels.reminder}</span><h2>{row.title}</h2><p>{row.body}</p><time dateTime={new Date(row.received_at).toISOString()}><Clock size={12}/>{new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'}).format(row.received_at)} IST</time></div></li>)}</ol>}
 <p className="dd-card-note dd-inbox-note">Only reminders received for your account on this device appear here. History starts with this update and keeps the latest 200 reminders. Clearing browser or app data removes it. No diary text is stored here.</p>
 </div></main>;
}
