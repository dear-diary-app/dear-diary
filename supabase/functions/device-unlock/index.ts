import{createClient}from'npm:@supabase/supabase-js@2';
import{generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse}from'npm:@simplewebauthn/server@13.2.2';
const origin='https://dear-diary-app.github.io',rpID='dear-diary-app.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Content-Type':'application/json'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const b64=(v:Uint8Array)=>btoa(String.fromCharCode(...v)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const bytes=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return json({error:'method'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');const{data:{user},error}=await db.auth.getUser(token);if(error||!user)return json({error:'unauthorized'},401);
 try{const body=await req.json();const action=body.action;const credentialId=typeof body.credentialId==='string'?body.credentialId:'';if(credentialId.length>2048)return json({error:'bad_credential'},400);
  if(action==='remove'){const r=await db.from('device_unlock_credentials').delete().eq('user_id',user.id).eq('id',credentialId);if(r.error)throw Error();return json({ok:true});}
  if(action==='register-options'||action==='authenticate-options'){await db.from('device_unlock_challenges').delete().eq('user_id',user.id).lt('expires_at',new Date().toISOString());const recent=await db.from('device_unlock_challenges').select('id',{count:'exact',head:true}).eq('user_id',user.id);if(recent.error)throw Error();if((recent.count||0)>=20)return json({error:'too_many_requests'},429);}
  if(action==='register-options'){
   if(!/^\d{4}$/.test(body.pin||''))return json({error:'pin_required'},400);
   const r=await db.rpc('pin_attempt',{p_user:user.id,p_pin:body.pin,p_new_pin:null});if(r.error||!r.data?.ok)return json({error:r.data?.error==='locked'?'locked':'wrong_pin'},400);
   const{data:existing,error:e}=await db.from('device_unlock_credentials').select('id').eq('user_id',user.id);if(e)throw Error();if((existing?.length||0)>=10)return json({error:'device_limit'},400);
   const options=await generateRegistrationOptions({rpName:'Dear Diary',rpID,userID:new TextEncoder().encode(user.id),userName:user.email||user.id,attestationType:'none',authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'discouraged',userVerification:'required'},excludeCredentials:(existing||[]).map(c=>({id:c.id})),supportedAlgorithmIDs:[-7,-257]});
   const saved=await db.from('device_unlock_challenges').insert({user_id:user.id,kind:'register',challenge:options.challenge}).select('id').single();if(saved.error)throw Error();return json({options,challengeId:saved.data.id});
  }
  if(action==='authenticate-options'){
   const{data:c,error:e}=await db.from('device_unlock_credentials').select('id,transports').eq('user_id',user.id).eq('id',credentialId).maybeSingle();if(e||!c)return json({error:'not_registered'},400);
   const options=await generateAuthenticationOptions({rpID,userVerification:'required',allowCredentials:[{id:c.id,transports:c.transports}]});const saved=await db.from('device_unlock_challenges').insert({user_id:user.id,kind:'authenticate',challenge:options.challenge,credential_id:c.id}).select('id').single();if(saved.error)throw Error();return json({options,challengeId:saved.data.id});
  }
  if(action!=='register-verify'&&action!=='authenticate-verify')return json({error:'action'},400);
  // Delete-and-return atomically consumes each challenge before verification, preventing replay.
  const{data:c,error:e}=await db.from('device_unlock_challenges').delete().eq('id',body.challengeId).eq('user_id',user.id).gt('expires_at',new Date().toISOString()).select().maybeSingle();if(e||!c)return json({error:'expired'},400);
  if(action==='register-verify'){
   if(c.kind!=='register')return json({error:'challenge_type'},400);
   const r=await verifyRegistrationResponse({response:body.response,expectedChallenge:c.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true});if(!r.verified||!r.registrationInfo)return json({error:'not_verified'},400);
   const key=r.registrationInfo.credential;const saved=await db.from('device_unlock_credentials').insert({user_id:user.id,id:key.id,public_key:b64(key.publicKey),counter:key.counter,transports:key.transports||[]});if(saved.error)throw Error();return json({ok:true,credentialId:key.id});
  }
  if(c.kind!=='authenticate'||body.response?.id!==c.credential_id)return json({error:'challenge_type'},400);
  const{data:key,error:ke}=await db.from('device_unlock_credentials').select().eq('user_id',user.id).eq('id',c.credential_id).single();if(ke||!key)return json({error:'not_registered'},400);
  const r=await verifyAuthenticationResponse({response:body.response,expectedChallenge:c.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,credential:{id:key.id,publicKey:bytes(key.public_key),counter:Number(key.counter),transports:key.transports}});if(!r.verified)return json({error:'not_verified'},400);
  const updated=await db.from('device_unlock_credentials').update({counter:r.authenticationInfo.newCounter}).eq('user_id',user.id).eq('id',key.id).eq('counter',key.counter).select('id');if(updated.error||!updated.data?.length)return json({error:'retry'},400);return json({ok:true});
 }catch{return json({error:'device_auth_failed'},400);}
});
