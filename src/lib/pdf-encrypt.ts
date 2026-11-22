export async function encryptDiaryPdf(blob:Blob,pin:string):Promise<Blob>{
 if(!/^\d{4}$/.test(pin))throw new Error('Enter your 4-digit diary PIN.');
 const bytes=await blob.arrayBuffer();
 return new Promise((resolve,reject)=>{
  const failure=new Error('Could not lock the PDF. No unprotected file was downloaded. Please try again.');
  let worker:Worker;try{worker=new Worker(new URL('./pdf-encrypt.worker.ts',import.meta.url),{type:'module'});}catch{reject(failure);return;}
  const fail=()=>{clearTimeout(timeout);worker.terminate();reject(failure);};
  const timeout=setTimeout(fail,120000);
  worker.onerror=fail;
  worker.onmessage=(event:MessageEvent<{ok:boolean;bytes?:ArrayBuffer}>)=>{
   if(!event.data.ok||!event.data.bytes){fail();return;}
   clearTimeout(timeout);worker.terminate();resolve(new Blob([event.data.bytes],{type:'application/pdf'}));
  };
  worker.postMessage({bytes,pin},[bytes]);
 });
}
