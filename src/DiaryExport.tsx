import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import { useStore, verifyPin } from './store';

export function DiaryExport(){
 const store=useStore();const [busy,setBusy]=useState<'json'|'pdf'|null>(null),[message,setMessage]=useState(''),[showPin,setShowPin]=useState(false),[pin,setPin]=useState('');
 const saving=Object.values(store.saveState).some(state=>state==='saving');
 const failed=Object.values(store.saveState).some(state=>state==='error');
 const download=async(format:'json'|'pdf',pdfPin='')=>{
  if(busy||saving||failed)return;setBusy(format);setMessage(format==='pdf'?'Preparing your readable diary. A long diary may take a moment...':'Preparing a fresh copy of your saved diary...');
  try{
   if(format==='pdf'){
    if(!/^\d{4}$/.test(pdfPin))throw new Error('Enter your 4-digit diary PIN.');
    setPin('');setMessage('Checking your diary PIN...');
    const result=await verifyPin(pdfPin,'verify');
    if(!result.ok)throw new Error(result.error==='locked'?'Too many tries. Your diary PIN is locked for 15 minutes.':result.noPin?'Set your diary PIN before downloading a locked PDF.':result.error==='wrong'?'That diary PIN did not match. Try again.':'Could not verify your diary PIN. Please try again.');
    setMessage('Preparing your PIN-locked PDF. A long diary may take a moment...');
   }
   // No account argument: the server always uses the authenticated caller.
   const {data,error}=await supabase.rpc('export_my_diary');
   if(error||!data||data.app!=='Dear Diary'||!Array.isArray(data.entries))throw new Error('Could not export your diary. Check your connection and try again.');
   const username=String(data.account?.username||'my-diary').replace(/[^a-z0-9_-]/gi,'-');
   const filename=`dear-diary-${username}-${data.export_date}${format==='pdf'?'-locked':''}.${format}`;
   const blob=format==='pdf'?await (await import('./lib/readable-export')).readableDiaryPdf(data,pdfPin):new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json;charset=utf-8'});
   const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   if(format==='pdf')setShowPin(false);
   setMessage(`Your ${format==='pdf'?'PIN-locked PDF':'JSON file'} is ready. If your browser opens a preview, use Share or Save to keep it.`);
  }catch(error){setMessage(error instanceof Error?error.message:'Could not export your diary. Please try again.');}finally{setBusy(null);}
 };
 return <section className="dd-card dd-export" aria-labelledby="export-title"><h2 id="export-title" className="dd-card-title">Your diary, to keep</h2><p className="dd-card-sub">Choose a readable PDF to enjoy your diary, or JSON for a structured backup. Both contain a fresh copy of your own saved pages. Your partner's pages are never included.</p><p className="dd-card-note">The PDF has dated pages and sticker artwork, arranged for reading. Photos are not included in the PDF; the JSON keeps their references, not the image files. PDFs require your diary PIN to open. A 4-digit PIN is a basic privacy lock, not protection against determined guessing. Older PDF downloads stay unchanged. JSON is not PIN-protected. No export copy is kept on our server.</p><button type="button" className="dd-btn dd-btn-primary" disabled={!!busy||saving||failed} onClick={()=>{setPin('');setShowPin(true);setMessage('');}}>{busy==='pdf'?'Preparing PDF...':'Download readable PDF'}</button>{showPin&&<form className="dd-export-pin" onSubmit={event=>{event.preventDefault();void download('pdf',pin);}}><label className="dd-field"><span>Enter your diary PIN to lock this PDF</span><input type="password" autoFocus inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={event=>setPin(event.target.value.replace(/[^0-9]/g,''))} aria-label="PDF diary PIN" disabled={!!busy} required /></label><p className="dd-card-note">Use this same PIN when opening the downloaded PDF. If your diary PIN changes later, this file still uses today's PIN.</p><button className="dd-btn dd-btn-primary" type="submit" disabled={!!busy||saving||failed||pin.length!==4}>{busy==='pdf'?'Locking PDF...':'Lock and download PDF'}</button><button className="dd-btn dd-btn-ghost" type="button" disabled={!!busy} onClick={()=>{setPin('');setShowPin(false);setMessage('');}}>Cancel</button></form>}<button type="button" className="dd-btn dd-export-json" disabled={!!busy||saving||failed} onClick={()=>void download('json')}>{busy==='json'?'Preparing JSON...':'Download JSON backup'}</button>{saving&&<p className="dd-card-note" role="status">Waiting for your latest changes to finish saving...</p>}{failed&&<p className="dd-card-note" role="status">Some diary changes are not saved. Open your diary and retry saving before downloading.</p>}{message&&<p className="dd-card-note" role="status">{message}</p>}</section>;
}
