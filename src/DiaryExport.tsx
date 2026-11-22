import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import { useStore } from './store';

export function DiaryExport(){
 const store=useStore();const [busy,setBusy]=useState<'json'|'pdf'|null>(null),[message,setMessage]=useState('');
 const saving=Object.values(store.saveState).some(state=>state==='saving');
 const failed=Object.values(store.saveState).some(state=>state==='error');
 const download=async(format:'json'|'pdf')=>{
  if(busy||saving||failed)return;setBusy(format);setMessage(format==='pdf'?'Preparing your readable diary. A long diary may take a moment...':'Preparing a fresh copy of your saved diary...');
  try{
   // No account argument: the server always uses the authenticated caller.
   const {data,error}=await supabase.rpc('export_my_diary');
   if(error||!data||data.app!=='Dear Diary'||!Array.isArray(data.entries))throw new Error('Could not export your diary. Check your connection and try again.');
   const username=String(data.account?.username||'my-diary').replace(/[^a-z0-9_-]/gi,'-');
   const filename=`dear-diary-${username}-${data.export_date}.${format}`;
   const blob=format==='pdf'?await (await import('./lib/readable-export')).readableDiaryPdf(data):new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json;charset=utf-8'});
   const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   setMessage(`Your ${format==='pdf'?'readable PDF':'JSON file'} is ready. If your browser opens a preview, use Share or Save to keep it.`);
  }catch(error){setMessage(error instanceof Error?error.message:'Could not export your diary. Please try again.');}finally{setBusy(null);}
 };
 return <section className="dd-card dd-export" aria-labelledby="export-title"><h2 id="export-title" className="dd-card-title">Your diary, to keep</h2><p className="dd-card-sub">Choose a readable PDF to enjoy your diary, or JSON for a structured backup. Both contain a fresh copy of your own saved pages. Your partner's pages are never included.</p><p className="dd-card-note">The PDF has dated pages and sticker artwork, arranged for reading. Photos are not included in the PDF; the JSON keeps their references, not the image files. No export copy is kept on our server. Keep your downloaded file private.</p><button type="button" className="dd-btn dd-btn-primary" disabled={!!busy||saving||failed} onClick={()=>void download('pdf')}>{busy==='pdf'?'Preparing PDF...':'Download readable PDF'}</button><button type="button" className="dd-btn dd-export-json" disabled={!!busy||saving||failed} onClick={()=>void download('json')}>{busy==='json'?'Preparing JSON...':'Download JSON backup'}</button>{saving&&<p className="dd-card-note" role="status">Waiting for your latest changes to finish saving...</p>}{failed&&<p className="dd-card-note" role="status">Some diary changes are not saved. Open your diary and retry saving before downloading.</p>}{message&&<p className="dd-card-note" role="status">{message}</p>}</section>;
}
