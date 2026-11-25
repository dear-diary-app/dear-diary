import {createClient} from 'npm:@supabase/supabase-js@2';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const trusted=(u:unknown)=>typeof u==='string'&&/^https:\/\/[a-z0-9.-]+\.(apple|mzstatic)\.com\//i.test(u)&&u.length<400;
const norm=(s:string)=>s.toLocaleLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const secret=Deno.env.get('DIARY_PUSH_CRON');if(!secret||req.headers.get('x-diary-cron')!==secret)return json({error:'unauthorized'},401);
 const now=new Date(),ist=new Date(now.getTime()+330*60000),day=ist.toISOString().slice(0,10),minutes=ist.getUTCHours()*60+ist.getUTCMinutes();
 if(minutes<1310||minutes>=1320)return json({skipped:'outside_window'});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data:tastes,error}=await db.from('song_taste').select('user_id,genres,languages,moods,artists,artist_selections').eq('enabled',true);
 if(error)return json({error:'settings_unavailable'},500);
 let checked=0;
 for(const taste of tastes||[]){
  const {data:done}=await db.from('diary_auto_song_runs').select('result').eq('user_id',taste.user_id).eq('day',day).maybeSingle();if(done&&done.result!=='retry')continue;
  const {data:entry,error:entryError}=await db.from('diary_entries').select('id,song').eq('user_id',taste.user_id).eq('entry_date',day).eq('status','draft').maybeSingle();if(entryError)continue;
  if(!entry||entry.song){await db.rpc('apply_diary_auto_song',{p_user:taste.user_id,p_song:null});continue;}
  const savedArtists=Array.isArray(taste.artist_selections)?taste.artist_selections.map((a:any)=>String(a.name||'').trim()).filter(Boolean):[];
  const artists=(savedArtists.length?savedArtists:String(taste.artists||'').split(/[,;\n]/).map(s=>s.trim()).filter(Boolean)).slice(0,20);
  // Rotate eligible artists so names beyond the first few are not ignored.
  const rotation=artists.length?((Math.floor(Date.now()/60000)+Math.floor(Date.now()/86400000)*11)%artists.length):0;
  const rotated=[...artists.slice(rotation),...artists.slice(0,rotation)];
  const sampled=rotated.slice(0,2);
  const terms=artists.length?[...sampled.map(a=>[a,taste.languages,taste.moods].filter(Boolean).join(' ')),...sampled]:[String(taste.genres||'')+' '+String(taste.languages||'')+' '+String(taste.moods||'')];
  let chosen:any=null,failed=false;const candidates:any[]=[];
  for(const term of terms.slice(0,4)){
   if(term.trim().length<2)continue;
   try{
    const url=new URL('https://itunes.apple.com/search');Object.entries({term,media:'music',entity:'song',limit:'25',country:'IN'}).forEach(([k,v])=>url.searchParams.set(k,v));
    const r=await fetch(url,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('search');const data=await r.json();
    for(const h of data.results||[]){
     if(h.kind!=='song'||!Number.isSafeInteger(h.trackId)||!trusted(h.previewUrl)||!trusted(h.artworkUrl100)||typeof h.trackViewUrl!=='string'||!/^https:\/\/(music|itunes)\.apple\.com\//.test(h.trackViewUrl))continue;
     if(artists.length&&!artists.some(a=>norm(h.artistName||'').includes(norm(a))))continue;
     const genre=norm(h.primaryGenreName||'');const text=norm([h.trackName,h.artistName,h.collectionName,h.primaryGenreName].join(' '));
     const wanted=String(taste.genres||'').split(/[,;\n]/).map(norm).filter(Boolean);const genreScore=wanted.filter(w=>genre.includes(w)||text.includes(w)).length;
     // Apple's catalogue has no dependable mood/lyric-language fields. These
     // guide the search and ranking, never become an invented strict guarantee.
     candidates.push({h,score:genreScore*4+(h.isStreamable?1:0)});
    }
   }catch{failed=true;}
  }
  candidates.sort((a,b)=>b.score-a.score);if(candidates.length){const pool=candidates.filter(c=>c.score===candidates[0].score);const h=pool[Math.floor(Math.random()*pool.length)].h;chosen={id:h.trackId,name:String(h.trackName).slice(0,120),artist:String(h.artistName).slice(0,120),art:h.artworkUrl100,url:h.previewUrl,store:h.trackViewUrl};}
  if(!chosen&&failed){await db.from('diary_auto_song_runs').upsert({user_id:taste.user_id,day,result:'retry',updated_at:new Date().toISOString()});continue;}
  await db.rpc('apply_diary_auto_song',{p_user:taste.user_id,p_song:chosen});checked++;
 }
 return json({checked});
});
