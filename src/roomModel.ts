export interface RoomMessage{id:string;sender:string;body:string;created_at:string}
export interface RoomState{id?:string;host?:boolean;video?:string|null;playing?:boolean;position?:number;version?:number;changed_at?:string;server_now:string;joined?:boolean;partner_online?:boolean;messages?:RoomMessage[];ended?:boolean}
export function youtubeId(value:string):string|null{
 const input=value.trim();if(/^[\w-]{11}$/.test(input))return input;
 try{const u=new URL(input);if(u.protocol!=='https:')return null;
 let id:string|null=null;if(u.hostname==='youtu.be')id=u.pathname.slice(1).split('/')[0];
 else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(u.hostname)){const parts=u.pathname.split('/');id=u.pathname==='/watch'?u.searchParams.get('v'):['embed','shorts','live'].includes(parts[1])?parts[2]:null;}
 return id&&/^[\w-]{11}$/.test(id)?id:null;}catch{return null;}
}
export function roomPosition(r:RoomState,now=Date.now(),offset=0){return Math.min(86400,Math.max(0,(r.position||0)+(r.playing?Math.max(0,(now+offset-Date.parse(r.changed_at||r.server_now))/1000):0)));}
export function roomCanAct(locked:boolean,joined:boolean){return !locked&&joined&&document.visibilityState==='visible'&&navigator.onLine&&!!document.querySelector('[data-dd-app-open="true"]');}
let apiPromise:Promise<any>|null=null;
export function youtubeAPI():Promise<any>{
 if((window as any).YT?.Player)return Promise.resolve((window as any).YT);
 if(apiPromise)return apiPromise;
 apiPromise=new Promise((resolve,reject)=>{const before=(window as any).onYouTubeIframeAPIReady;let timeout:number;
 const ready=()=>{clearTimeout(timeout);before?.();resolve((window as any).YT);};(window as any).onYouTubeIframeAPIReady=ready;
 let script=document.querySelector<HTMLScriptElement>('script[data-room-youtube]');if(!script){script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.dataset.roomYoutube='';script.referrerPolicy='strict-origin-when-cross-origin';document.head.append(script);}
 script.onerror=()=>{apiPromise=null;script?.remove();reject(Error('YouTube could not load. Check your connection.'));};timeout=window.setTimeout(()=>{apiPromise=null;script?.remove();reject(Error('YouTube took too long to load. Reopen Room to retry.'));},15000);
 });return apiPromise;
}
// Only a mounted Room with a genuinely PLAYING iframe can ask for the scoped idle exception.
export function roomWatching(active:boolean){document.documentElement.toggleAttribute('data-room-watching',active);window.dispatchEvent(new Event('dd-room-watching'));}
