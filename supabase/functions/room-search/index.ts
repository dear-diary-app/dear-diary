import{createClient}from'npm:@supabase/supabase-js@2';
import{webProvider,officialProvider,type VideoResult}from'./providers.ts';
const headers={'Access-Control-Allow-Origin':'https://dear-diary-app.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Content-Type':'application/json','Cache-Control':'no-store'};
// Short-lived public results only. Hash keys, no persistent query/history/logging.
const cache=new Map<string,{until:number;results:VideoResult[]}>();const pending=new Map<string,Promise<VideoResult[]>>();let blockedUntil=0;
Deno.serve(async req=>{const out=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return out({},405);
 try{if(Number(req.headers.get('content-length')||0)>2000)return out({},413);const auth=req.headers.get('Authorization')||'';const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});const{data:{user}}=await db.auth.getUser(auth.replace(/^Bearer /,''));if(!user)return out({},401);
 const body=await req.json();if(typeof body.query!=='string'||body.query.trim().length<2||body.query.length>120)return out({error:'Enter 2 to 120 characters.'},400);
 // Verify linked-pair access even on a cache hit, without exposing Room content.
 const{error:pairError}=await db.rpc('watch_room',{p_action:'peek'});if(pairError)return out({},403);
 const key=Deno.env.get('YOUTUBE_DATA_API_KEY');const provider=Deno.env.get('ROOM_SEARCH_PROVIDER')==='official'&&key?officialProvider(key):webProvider;
 const query=body.query.trim().replace(/\s+/g,' ');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(provider.name+'|'+query.toLowerCase())))).map(x=>x.toString(16).padStart(2,'0')).join('');const now=Date.now();
 for(const[k,v]of cache)if(v.until<=now)cache.delete(k);
 const saved=cache.get(hash);if(saved&&saved.until>now)return out({results:saved.results,provider:provider.name,embeddable_filtered:provider.name==='official-api'});
 if(blockedUntil>now)return out({error:'YouTube search is temporarily unavailable. Paste a YouTube link or try again shortly.'},503);
 const{data:permitted,error}=await db.rpc('watch_search_allow');if(error||!permitted)return out({error:'Please wait a little before searching again, or paste a YouTube link.'},429);
 let work=pending.get(hash);if(!work){work=provider.search(query);pending.set(hash,work);}
 try{const results=await work;if(cache.size>=256)cache.delete(cache.keys().next().value!);cache.set(hash,{until:Date.now()+600000,results});return out({results,provider:provider.name,embeddable_filtered:provider.name==='official-api'});}catch{blockedUntil=Date.now()+30000;throw Error('SEARCH_UNAVAILABLE');}finally{pending.delete(hash);}
 }catch{return out({error:'YouTube search is unavailable. Paste a YouTube link or try again later.'},503);}
});
