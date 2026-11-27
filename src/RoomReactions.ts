import{useCallback,useEffect,useRef,useState}from'react';
import{supabase}from'./lib/supabase';
export const ROOM_EMOJIS=['❤️','😂','😍','🥹','🔥','👏','😮'];
type Reaction={id:string;emoji:string;lane:number};
// Client Broadcast is transient: no inserts, offline queue, history, or replay.
// Rate limits are UI/receiver protections, not server-enforced abuse prevention.
export function useRoomReactions(active:boolean,roomId?:string,partnerOnline=false){
 const[items,setItems]=useState<Reaction[]>([]),[connected,setConnected]=useState(false);
 const last=useRef(0),remoteLast=useRef(0),timers=useRef(new Set<ReturnType<typeof setTimeout>>()),channel=useRef<ReturnType<typeof supabase.channel>|null>(null),seen=useRef(new Set<string>());
 const show=useCallback((id:string,emoji:string)=>{if(seen.current.has(id))return;seen.current.add(id);if(seen.current.size>100)seen.current.delete(seen.current.values().next().value!);setItems(v=>[...v.slice(-7),{id,emoji,lane:Math.random()*7}]);const timer=setTimeout(()=>{setItems(v=>v.filter(x=>x.id!==id));timers.current.delete(timer);},2400);timers.current.add(timer);},[]);
 useEffect(()=>{setConnected(false);if(!active||!roomId)return;let live=true;const c=supabase.channel('dd-room-reactions-'+roomId,{config:{private:true,broadcast:{self:false,ack:true}}});channel.current=c;c.on('broadcast',{event:'reaction'},({payload})=>{const t=Date.now();if(!live||document.hidden||!payload||typeof payload.id!=='string'||payload.id.length>50||!ROOM_EMOJIS.includes(payload.emoji)||!Number.isFinite(payload.at)||Math.abs(t-payload.at)>5000||t-remoteLast.current<650)return;remoteLast.current=t;show(payload.id,payload.emoji);}).subscribe(status=>{if(live)setConnected(status==='SUBSCRIBED');});return()=>{live=false;channel.current=null;void supabase.removeChannel(c);};},[active,roomId,show]);
 const react=useCallback((emoji:string)=>{if(!active||!ROOM_EMOJIS.includes(emoji)||Date.now()-last.current<650)return;last.current=Date.now();const id=crypto.randomUUID();show(id,emoji);if(connected&&partnerOnline&&channel.current&&navigator.onLine)void channel.current.send({type:'broadcast',event:'reaction',payload:{id,emoji,at:Date.now()}}).catch(()=>{});},[active,connected,partnerOnline,show]);
 useEffect(()=>{if(!active)setItems([]);return()=>{timers.current.forEach(clearTimeout);timers.current.clear();};},[active]);return{items,react,connected};
}
