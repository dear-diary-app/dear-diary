import {createClient} from 'npm:@supabase/supabase-js@2';
const headers={'Access-Control-Allow-Origin':'https://dear-diary-app.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type','Content-Type':'application/json'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 const out=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers});
 if(req.method!=='POST')return out({error:'method'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data:{user}}=await db.auth.getUser((req.headers.get('Authorization')||'').replace(/^Bearer /,''));if(!user)return out({error:'unauthorized'},401);
 let token='';try{token=String((await req.json()).token||'');}catch{}if(token.length<20||token.length>4096||!/^[A-Za-z0-9_:\-]+$/.test(token))return out({error:'bad_token'},400);
 const {count}=await db.from('android_push_tokens').select('token',{count:'exact',head:true}).eq('user_id',user.id);if((count||0)>=20){const {data:existing}=await db.from('android_push_tokens').select('token').eq('token',token).eq('user_id',user.id).maybeSingle();if(!existing)return out({error:'device_limit'},429);}
 const {error}=await db.from('android_push_tokens').upsert({token,user_id:user.id,updated_at:new Date().toISOString()},{onConflict:'token'});
 return error?out({error:'save_failed'},500):out({ok:true});
});
