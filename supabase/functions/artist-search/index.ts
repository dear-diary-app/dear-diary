import {createClient} from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'https://dear-diary-app.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!);const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');const{data:{user}}=await db.auth.getUser(token);if(!user)return json({error:'Sign in again.'},401);
 let query='';try{query=String((await req.json()).query||'').trim();}catch{return json({error:'Invalid search'},400);}if(query.length<2||query.length>80)return json({error:'Search with 2 to 80 characters'},400);
 try{const url=new URL('https://api.deezer.com/search/artist');url.searchParams.set('q',query);url.searchParams.set('limit','8');const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.data))throw Error();
 const artists=data.data.filter((a:any)=>Number.isSafeInteger(a.id)&&a.id>0&&typeof a.name==='string'&&a.name.trim()&&a.name.length<=100).map((a:any)=>({id:a.id,name:a.name.trim(),image:typeof a.picture_medium==='string'&&/^https:\/\/cdn-images\.dzcdn\.net\/images\/artist\//.test(a.picture_medium)?a.picture_medium:''}));return json({artists});
 }catch{return json({error:'Artist search is unavailable. Try again.'},502);}
});
