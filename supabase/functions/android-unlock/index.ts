import{createClient}from'npm:@supabase/supabase-js@2';
const headers={'Access-Control-Allow-Origin':'https://dear-diary-app.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type','Content-Type':'application/json'};
const bytes=(s:string)=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
Deno.serve(async req=>{
 const out=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers});if(req.method==='OPTIONS')return out({});if(req.method!=='POST')return out({},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);const{data:{user}}=await db.auth.getUser((req.headers.get('authorization')||'').replace(/^Bearer /i,''));if(!user)return out({},401);
 try{const b=await req.json();const id=String(b.id||'');if(!/^[a-f0-9]{64}$/.test(id))return out({error:'key'},400);
 if(b.action==='register'){
  if(!/^\d{4}$/.test(b.pin||''))return out({error:'pin'},400);const r=await db.rpc('pin_attempt',{p_user:user.id,p_pin:b.pin,p_new_pin:null});if(r.error||!r.data?.ok)return out({error:'pin'},400);
  if(typeof b.publicKey!=='string'||b.publicKey.length>2048)return out({error:'key'},400);await crypto.subtle.importKey('spki',bytes(b.publicKey),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const{count}=await db.from('android_unlock_keys').select('id',{count:'exact',head:true}).eq('user_id',user.id);if((count||0)>=10)return out({error:'limit'},400);
  const r2=await db.from('android_unlock_keys').upsert({user_id:user.id,id,public_key:b.publicKey});if(r2.error)throw Error();return out({ok:true});
 }
 const{data:key}=await db.from('android_unlock_keys').select('public_key').eq('user_id',user.id).eq('id',id).maybeSingle();if(!key)return out({error:'not_registered'},400);
 if(b.action==='options'){
  await db.from('android_unlock_challenges').delete().eq('user_id',user.id).lt('expires_at',new Date().toISOString());const{count}=await db.from('android_unlock_challenges').select('id',{count:'exact',head:true}).eq('user_id',user.id);if((count||0)>20)return out({error:'limit'},429);
  const challenge=crypto.randomUUID()+crypto.randomUUID();const r=await db.from('android_unlock_challenges').insert({user_id:user.id,key_id:id,challenge}).select('id').single();if(r.error)throw Error();return out({challenge,challengeId:r.data.id});
 }
 if(b.action!=='verify')return out({},400);
 const{data:c}=await db.from('android_unlock_challenges').delete().eq('id',b.challengeId).eq('user_id',user.id).eq('key_id',id).gt('expires_at',new Date().toISOString()).select().maybeSingle();if(!c)return out({error:'expired'},400);
 const pub=await crypto.subtle.importKey('spki',bytes(key.public_key),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pub,bytes(b.signature),new TextEncoder().encode(c.challenge));return out({ok},ok?200:400);
 }catch{return out({error:'device_auth_failed'},400);}
});
