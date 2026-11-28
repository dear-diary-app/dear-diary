// Search adapter derived from PyTubeSearch (MIT), copyright 2025 Malith Rukshan.
// See LICENSE-PyTubeSearch. Unofficial web parsing is deliberately isolated here.
export interface VideoResult {id:string;title:string;channel:string;thumbnail:string;duration:string}
export interface SearchProvider {name:string;search(query:string):Promise<VideoResult[]>}
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[\w-]{11}$/.test(id);
const text=(v:any)=>typeof v?.simpleText==='string'?v.simpleText:Array.isArray(v?.runs)?v.runs.map((r:any)=>typeof r?.text==='string'?r.text:'').join(''):'';
export function extractInitialData(html:string):any{
 const match=/(?:var\s+ytInitialData\s*=|window\["ytInitialData"\]\s*=|ytInitialData\s*=)\s*/.exec(html);
 if(!match)throw Error('SEARCH_UNAVAILABLE');
 const start=match.index+match[0].length;if(html[start]!=='{')throw Error('SEARCH_UNAVAILABLE');
 let depth=0,quoted=false,escaped=false;
 for(let i=start;i<html.length;i++){const c=html[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return JSON.parse(html.slice(start,i+1));}
 throw Error('SEARCH_UNAVAILABLE');
}
export function parseResults(data:any):VideoResult[]{
 const sections=data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
 if(!Array.isArray(sections))throw Error('SEARCH_UNAVAILABLE');
 const items:VideoResult[]=[];let recognized=false;
 for(const section of sections){const contents=section?.itemSectionRenderer?.contents;if(!Array.isArray(contents))continue;
 for(const item of contents){if(item?.backgroundPromoRenderer||item?.messageRenderer)recognized=true;
 const v=item?.videoRenderer;if(!v)continue;recognized=true;
 // First version excludes explicit live/upcoming streams. This is NOT an embed filter.
 if(v.upcomingEventData||v.badges?.some((b:any)=>b?.metadataBadgeRenderer?.style==='BADGE_STYLE_TYPE_LIVE_NOW')||v.thumbnailOverlays?.some((o:any)=>o?.thumbnailOverlayTimeStatusRenderer?.style==='LIVE'))continue;
 const id=v.videoId,title=text(v.title).slice(0,300);if(!validId(id)||!title)continue;
 items.push({id,title,channel:text(v.ownerText||v.shortBylineText).slice(0,180),thumbnail:`https://i.ytimg.com/vi/${id}/mqdefault.jpg`,duration:text(v.lengthText).slice(0,30)});
 }}
 if(!recognized)throw Error('SEARCH_UNAVAILABLE');return items.filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i).slice(0,10);
}
export async function bounded(url:string):Promise<string>{
 const response=await fetch(url,{signal:AbortSignal.timeout(10000),redirect:'error',headers:{'Accept-Language':'en-IN,en;q=0.8'}});
 if(!response.ok||!response.body)throw Error('SEARCH_UNAVAILABLE');
 const reader=response.body.getReader(),decoder=new TextDecoder();let result='',bytes=0;
 try{while(true){const{done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4*1024*1024)throw Error('SEARCH_UNAVAILABLE');result+=decoder.decode(value,{stream:true});}return result+decoder.decode();}finally{await reader.cancel().catch(()=>{});}
}
export const webProvider:SearchProvider={name:'unofficial-web',async search(query){const html=await bounded('https://www.youtube.com/results?search_query='+encodeURIComponent(query)+'&sp=EgIQAQ%3D%3D');return parseResults(extractInitialData(html));}};
export function officialProvider(key:string):SearchProvider{return{name:'official-api',async search(query){const params=new URLSearchParams({part:'snippet',type:'video',q:query,maxResults:'10',videoEmbeddable:'true',videoSyndicated:'true',safeSearch:'moderate',key});const data=JSON.parse(await bounded('https://www.googleapis.com/youtube/v3/search?'+params));if(!Array.isArray(data.items))throw Error('SEARCH_UNAVAILABLE');return data.items.filter((i:any)=>validId(i.id?.videoId)).map((i:any)=>({id:i.id.videoId,title:String(i.snippet?.title||'').slice(0,300),channel:String(i.snippet?.channelTitle||'').slice(0,180),thumbnail:`https://i.ytimg.com/vi/${i.id.videoId}/mqdefault.jpg`,duration:''}));}};}
