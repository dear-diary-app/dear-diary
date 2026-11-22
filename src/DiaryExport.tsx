import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import { useStore } from './store';

export function DiaryExport(){
 const store=useStore();const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const saving=Object.values(store.saveState).some(state=>state==='saving');
 const failed=Object.values(store.saveState).some(state=>state==='error');
 const download=async()=>{
  if(busy||saving||failed)return;setBusy(true);setMessage('Preparing a fresh copy of your saved diary...');
  try{
   // No account argument: the server always uses the authenticated caller.
   const {data,error}=await supabase.rpc('export_my_diary');
   if(error||!data||data.app!=='Dear Diary'||!Array.isArray(data.entries))throw new Error('Could not export your diary. Check your connection and try again.');
   const username=String(data.account?.username||'my-diary').replace(/[^a-z0-9_-]/gi,'-');
   const filename=`dear-diary-${username}-${data.export_date}.json`;
   const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json;charset=utf-8'});
   const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   setMessage('Your JSON file is ready. If your browser opens a preview, use Share or Save to keep it.');
  }catch(error){setMessage(error instanceof Error?error.message:'Could not export your diary. Please try again.');}finally{setBusy(false);}
 };
 return <section className="dd-card dd-export" aria-labelledby="export-title"><h2 id="export-title" className="dd-card-title">Your diary, to keep</h2><p className="dd-card-sub">Download a fresh JSON copy of your own saved pages, including dates, text, stickers and entry details. Your partner's pages are never included.</p><p className="dd-card-note">Photo references are included, not the image files. No export copy is kept on our server. Keep your downloaded file private.</p><button type="button" className="dd-btn dd-btn-primary" disabled={busy||saving||failed} onClick={()=>void download()}>{busy?'Preparing download...':'Download my diary'}</button>{saving&&<p className="dd-card-note" role="status">Waiting for your latest changes to finish saving...</p>}{failed&&<p className="dd-card-note" role="status">Some diary changes are not saved. Open your diary and retry saving before downloading.</p>}{message&&<p className="dd-card-note" role="status">{message}</p>}</section>;
}
