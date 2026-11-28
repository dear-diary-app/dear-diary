import{webCatalog}from'./web.ts';
import{createClient}from'npm:@supabase/supabase-js@2';
import channelLeads from'./channels.json'with{type:'json'};
import{languageTags,playlistKind,preferredAudio}from'./metadata.ts';
const headers={'Access-Control-Allow-Origin':'https://dear-diary-app.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Content-Type':'application/json','Cache-Control':'no-store'};
const channels=channelLeads.filter(c=>!('pendingResolution'in c)&&!['pokemon-bn','pokemon-ta','pokemon-te'].includes(c.id));
const cache=new Map<string,{until:number,data:any}>();const pending=new Map<string,Promise<any>>();let requests=0,day='',blockedUntil=0;
async function yt(resource:string,params:Record<string,string>,key:string){
 const id=resource+'?'+new URLSearchParams(params);const saved=cache.get(id);if(saved&&saved.until>Date.now())return saved.data;
 if(blockedUntil>Date.now())throw Error('YouTube catalog is resting after an API limit. Try later.');
 const date=new Date().toISOString().slice(0,10);if(date!==day){day=date;requests=0;}if(requests>=3000)throw Error('Daily catalog safety limit reached. Try tomorrow.');
 let work=pending.get(id);if(!work){work=(async()=>{requests++;const res=await fetch('https://www.googleapis.com/youtube/v3/'+resource+'?'+new URLSearchParams({...params,key}),{signal:AbortSignal.timeout(12000)});if(!res.ok){if(res.status===403||res.status===429)blockedUntil=Date.now()+60000;throw Error('YouTube catalog is temporarily unavailable.');}const d=await res.json();if(cache.size>350)cache.delete(cache.keys().next().value!);cache.set(id,{until:Date.now()+600000,data:d});return d;})();pending.set(id,work);}try{return await work;}finally{pending.delete(id);}
}
async function channelId(c:typeof channels[number],key:string){const handle='handle'in c?c.handle:null;if(typeof handle!=='string')throw Error('Channel verification pending');const d=await yt('channels',{part:'id',forHandle:handle},key);const id=d.items?.[0]?.id;if(!/^UC[\w-]{22}$/.test(id||''))throw Error('Channel is unavailable');return id as string;}
Deno.serve(async req=>{const out=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return out({},405);
 try{
 if(Number(req.headers.get('content-length')||0)>1500)return out({},413);
 const auth=req.headers.get('Authorization')||'',db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
 const{data:{user}}=await db.auth.getUser(auth.replace(/^Bearer /,''));if(!user)return out({},401);const{error:pair}=await db.rpc('watch_room',{p_action:'peek'});if(pair)return out({},403);
 const body=await req.json();if(body.action==='channels')return out({channels:channels.map(({id,name,url,note,sources})=>({id,name,url,note,sources})),source:'YouTube',region:'IN'});
 if(!['playlists','episodes'].includes(body.action))return out({},400);const c=channels.find(c=>c.id===body.channel);if(!c)return out({},400);
 const page=typeof body.page==='string'&&/^[A-Za-z0-9_=-]{1,500}$/.test(body.page)?body.page:undefined;if(body.page&&!page)return out({},400);
 const key=Deno.env.get('YOUTUBE_DATA_API_KEY');
 const{data:allowed,error:limit}=await db.rpc('watch_search_allow');if(limit||!allowed)return out({error:'Please wait a little before loading more.'},429);
 if(!key){if(page)return out({error:'Key-free preview loads only the first visible page.'},400);if(body.action==='episodes'&&(typeof body.playlist!=='string'||!/^PL[\w-]{8,98}$/.test(body.playlist)))return out({},400);return out(await webCatalog(c as any,body.action,body.playlist));}
 const cid=await channelId(c,key);
 if(body.action==='playlists'){
  const d=await yt('playlists',{part:'snippet,contentDetails,status',channelId:cid,maxResults:'50',...(page?{pageToken:page}:{})},key);
  const playlists=(d.items||[]).filter((p:any)=>p.snippet?.channelId===cid&&p.status?.privacyStatus==='public'&&preferredAudio(p.snippet?.title||'')).map((p:any)=>({id:p.id,title:p.snippet.title,description:String(p.snippet.description||'').slice(0,1500),thumbnail:p.snippet.thumbnails?.medium?.url,count:p.contentDetails.itemCount,channel:c.name,tags:languageTags(p.snippet.title),kind:playlistKind(p.snippet.title)}));
  return out({playlists,next:d.nextPageToken||null,source:'YouTube',region:'IN'});
 }
 if(typeof body.playlist!=='string'||!/^[\w-]{10,100}$/.test(body.playlist))return out({},400);
 const ownership=await yt('playlists',{part:'snippet,status',id:body.playlist},key);if(ownership.items?.[0]?.snippet?.channelId!==cid||ownership.items?.[0]?.status?.privacyStatus!=='public')return out({error:'This playlist is not from the selected verified channel.'},403);
 const d=await yt('playlistItems',{part:'snippet,contentDetails',playlistId:body.playlist,maxResults:'50',...(page?{pageToken:page}:{})},key);
 const ids=(d.items||[]).map((x:any)=>x.contentDetails?.videoId).filter((x:any)=>/^[\w-]{11}$/.test(x));const videos=ids.length?await yt('videos',{part:'snippet,status,contentDetails',id:ids.join(',')},key):{items:[]};
 // A publisher playlist is not sufficient proof for arbitrary third-party uploads.
 const officialIds=new Set<string>();for(const ch of channels){try{officialIds.add(await channelId(ch,key));}catch{/* Unresolved uploader is excluded, never assumed official. */}}
 const map=new Map((videos.items||[]).map((v:any)=>[v.id,v]));const episodes=(d.items||[]).map((x:any)=>{const id=x.contentDetails?.videoId;const v:any=map.get(id);if(!v||!officialIds.has(v.snippet?.channelId)||!preferredAudio(v.snippet?.title||''))return null;const r=v.contentDetails?.regionRestriction;const regionBlocked=r?.blocked?.includes('IN')||Array.isArray(r?.allowed)&&!r.allowed.includes('IN');const available=v.status?.embeddable===true&&!regionBlocked&&v.status?.privacyStatus==='public';return{id,title:v.snippet.title,thumbnail:v.snippet.thumbnails?.medium?.url,position:x.snippet.position,channel:v.snippet.channelTitle,tags:languageTags(v.snippet.title),available,reason:regionBlocked?'Unavailable in India':!v.status?.embeddable?'YouTube embedding not allowed':undefined,duration:v.contentDetails?.duration};}).filter(Boolean);
 return out({episodes,next:d.nextPageToken||null,source:'YouTube',region:'IN',omitted:(d.items||[]).length-episodes.length});
 }catch(e){return out({error:e instanceof Error?e.message:'Catalog unavailable'},503);}
});
