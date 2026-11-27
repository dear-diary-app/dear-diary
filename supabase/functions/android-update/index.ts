import{createClient}from'npm:@supabase/supabase-js@2';
const headers={'Access-Control-Allow-Origin':'https://dear-diary-app.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type','Content-Type':'application/json','Cache-Control':'no-store'};
Deno.serve(async req=>{
 const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers});
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return out({error:'method'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const{data:{user}}=await db.auth.getUser((req.headers.get('Authorization')||'').replace(/^Bearer /,''));if(!user)return out({error:'unauthorized'},401);
 let b:any;try{b=await req.json();}catch{return out({error:'body'},400);}
 const{data:r,error}=await db.from('android_releases').select('version_code,version_name,notes,sha256,bytes,object_path').eq('active',true).order('version_code',{ascending:false}).limit(1).maybeSingle();
 if(error)return out({error:'channel_unavailable'},503);if(!r)return out({available:false});
 const release={code:r.version_code,version:r.version_name,notes:r.notes,sha256:r.sha256,bytes:r.bytes};
 if(b.action==='check')return out({available:r.version_code>Number(b.current||0),...release});
 if(r.version_code<=Number(b.current||0))return out({available:false,...release});
 if(b.action!=='download'||Number(b.code)!==r.version_code)return out({error:'release_changed'},409);
 const{data,error:e}=await db.storage.from('private-android-releases').createSignedUrl(r.object_path,600);
 if(e||!data?.signedUrl)return out({error:'download_unavailable'},503);
 return out({available:true,...release,url:data.signedUrl});
});
