import createQpdf from '@neslinesli93/qpdf-wasm';
import wasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url';

// A dedicated worker keeps encryption off the UI thread. It is terminated after
// each export, discarding its PIN, random owner key and in-memory filesystem.
self.onmessage=async(event:MessageEvent<{bytes:ArrayBuffer;pin:string}>)=>{
 let fs:{writeFile:(path:string,data:Uint8Array)=>void;readFile:(path:string)=>Uint8Array;unlink:(path:string)=>void}|undefined;
 try{
  const {bytes,pin}=event.data;if(!/^\d{4}$/.test(pin))throw new Error('Invalid PIN');
  const create=createQpdf as unknown as (options:Record<string,unknown>)=>Promise<{FS:NonNullable<typeof fs>;callMain:(args:string[])=>number}>;
  const qpdf=await create({locateFile:()=>wasmUrl,noInitialRun:true,print:()=>{},printErr:()=>{}});fs=qpdf.FS;
  fs.writeFile('/diary-input.pdf',new Uint8Array(bytes));
  const owner=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
  const code=qpdf.callMain(['--encrypt',pin,owner,'256','--','/diary-input.pdf','/diary-locked.pdf']);
  if(code!==0)throw new Error('Encryption failed');
  const output=new Uint8Array(fs.readFile('/diary-locked.pdf'));
  fs.unlink('/diary-input.pdf');fs.unlink('/diary-locked.pdf');fs=undefined;
  self.postMessage({ok:true,bytes:output.buffer}, {transfer:[output.buffer]});
 }catch{
  if(fs)for(const path of ['/diary-input.pdf','/diary-locked.pdf'])try{fs.unlink(path);}catch{}
  self.postMessage({ok:false});
 }
};
