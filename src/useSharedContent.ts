import{useEffect,useRef,useState}from'react';
import{supabase}from'./lib/supabase';
import{hasSharedContent,type SharedMessage}from'./sharedContent';
const COLS='id,sender_id,recipient_id,created_at,body,images,gif_id',PAGE=250;
const uuid=(s:unknown):s is string=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
function clean(r:any):SharedMessage|null{if(!r||!uuid(r.id)||!uuid(r.sender_id)||!uuid(r.recipient_id)||typeof r.created_at!=='string'||!/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(r.created_at)||!Number.isFinite(Date.parse(r.created_at)))return null;return{id:r.id,sender_id:r.sender_id,recipient_id:r.recipient_id,created_at:r.created_at,body:typeof r.body==='string'?r.body:'',images:Array.isArray(r.images)?r.images.filter((x:unknown):x is string=>typeof x==='string').slice(0,3):[],gif_id:typeof r.gif_id==='string'?r.gif_id:null};}
export function useSharedContent(uid:string){
 const[owner,setOwner]=useState(uid);const[rows,setRows]=useState<SharedMessage[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false),[checked,setChecked]=useState(0),[attempt,setAttempt]=useState(0);const refresh=useRef<()=>void>(()=>{});
 useEffect(()=>{
  let dead=false,generation=0,controller:AbortController|undefined,other='',channel:ReturnType<typeof supabase.channel>|undefined;let current=new Map<string,SharedMessage>(),changes=new Map<string,SharedMessage|null>();const initial=new AbortController();const initialTimeout=window.setTimeout(()=>initial.abort(),12000);
  const publish=()=>{if(!dead)setRows([...current.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id)));};
  const scan=async()=>{if(!other||dead)return;const version=++generation;controller?.abort();const c=new AbortController();controller=c;changes=new Map();setLoading(true);setError(false);setChecked(0);const all=new Map<string,SharedMessage>();let cursor:SharedMessage|null=null,n=0;
   try{for(;;){let q=supabase.from('chat_messages').select(COLS).in('sender_id',[uid,other]).in('recipient_id',[uid,other]).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(PAGE);if(cursor)q=q.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);const timeout=window.setTimeout(()=>c.abort(),12000);let result;try{result=await q.abortSignal(c.signal);}finally{window.clearTimeout(timeout);}const{data,error:e}=result;if(dead||version!==generation)return;if(e||!data)throw new Error('load');const page=data.map(clean);if(page.some(x=>!x))throw new Error('format');for(const m of page as SharedMessage[])if(hasSharedContent(m))all.set(m.id,m);n+=data.length;setChecked(n);if(data.length<PAGE)break;cursor=page[page.length-1]!;}
    if(dead||version!==generation)return;changes.forEach((m,id)=>{if(m&&hasSharedContent(m))all.set(id,m);else all.delete(id);});current=all;publish();
   }catch{if(!dead&&version===generation)setError(true);}finally{if(!dead&&version===generation)setLoading(false);}
  };
  refresh.current=()=>void scan();setOwner(uid);setRows([]);setLoading(true);setError(false);
  void(async()=>{try{const{data,error:e}=await supabase.from('friendship').select('user1_id,user2_id').abortSignal(initial.signal).maybeSingle();if(dead)return;if(e||!data)throw new Error('friend');other=data.user1_id===uid?data.user2_id:data.user1_id;if(!uuid(other))throw new Error('friend');
    channel=supabase.channel(`dd-shared-${uid}-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'chat_messages'},p=>{if(dead)return;if(p.eventType==='DELETE'){const id=(p.old as any)?.id;if(typeof id!=='string')return;changes.set(id,null);current.delete(id);publish();return;}const m=clean(p.new);if(!m||!((m.sender_id===uid&&m.recipient_id===other)||(m.sender_id===other&&m.recipient_id===uid)))return;changes.set(m.id,m);if(hasSharedContent(m))current.set(m.id,m);else current.delete(m.id);publish();}).subscribe(s=>{if(s==='SUBSCRIBED')void scan();});void scan();
   }catch{if(!dead){setError(true);setLoading(false);}}finally{window.clearTimeout(initialTimeout);}})();
  const wake=()=>{if(!document.hidden)void scan();};window.addEventListener('online',wake);window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);const timer=window.setInterval(wake,45000);
  return()=>{dead=true;generation++;initial.abort();window.clearTimeout(initialTimeout);controller?.abort();if(channel)void supabase.removeChannel(channel);window.clearInterval(timer);window.removeEventListener('online',wake);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);};
 },[uid,attempt]);
 return{rows:owner===uid?rows:[],loading:owner!==uid||loading,error:owner===uid&&error,checked:owner===uid?checked:0,retry:()=>setAttempt(n=>n+1),refresh:()=>refresh.current()};
}
