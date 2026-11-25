let cached={token:'',expires:0};
const b64=(v:Uint8Array)=>btoa(String.fromCharCode(...v)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
async function access(sa:{private_key:string;client_email:string}){
 if(cached.expires>Date.now()+60000)return cached.token;
 const now=Math.floor(Date.now()/1000),enc=new TextEncoder();
 const h=b64(enc.encode(JSON.stringify({alg:'RS256',typ:'JWT'}))),p=b64(enc.encode(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3500})));
 const pem=sa.private_key.replace(/-----[^-]+-----|\s/g,'');const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),x=>x.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const sig=b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(h+'.'+p))));
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:h+'.'+p+'.'+sig})});if(!r.ok)throw Error('fcm_auth_failed');const d=await r.json();cached={token:d.access_token,expires:Date.now()+d.expires_in*1000};return cached.token;
}
export async function sendAndroid(db:any,userId:string,type:string,onlyToken?:string){
 const raw=Deno.env.get('FCM_SERVICE_ACCOUNT');if(!raw)return {sent:0,failed:0,configured:false};
 const sa=JSON.parse(raw);if(!/^[a-z0-9-]+$/.test(sa.project_id))throw Error('bad_fcm_project');
 const {data:rows,error}=await db.from('android_push_tokens').select('token').eq('user_id',userId);if(error)throw Error('android_tokens_unavailable');
 let sent=0,failed=0;
 for(const row of rows||[]){if(onlyToken&&row.token!==onlyToken)continue;try{
  const token=await access(sa);const r=await fetch('https://fcm.googleapis.com/v1/projects/'+sa.project_id+'/messages:send',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:{token:row.token,data:{account_id:userId,type},android:{priority:'HIGH',ttl:'600s'}}})});
  if(r.ok)sent++;else{const d=await r.json().catch(()=>({}));if(d?.error?.details?.some((x:any)=>x.errorCode==='UNREGISTERED'))await db.from('android_push_tokens').delete().eq('token',row.token);else failed++;}
 }catch{failed++;}}
 return {sent,failed,configured:true};
}
