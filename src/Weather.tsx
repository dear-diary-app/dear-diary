import React,{createContext,useContext,useEffect,useRef,useState}from'react';
export type WeatherKind='sun'|'clear-night'|'cloud'|'rain'|'wind'|'storm'|'snow';
export type WeatherState={kind:WeatherKind|null;status:string;refresh:()=>void;animate:boolean};
export const WeatherContext=createContext<WeatherState>({kind:null,status:'',refresh:()=>{},animate:false});
const CACHE_MS=30*60*1000;
export function weatherKind(code:number,wind:number,day:boolean):WeatherKind{
 if(code>=95)return 'storm';
 if([71,73,75,77,85,86].includes(code))return 'snow';
 if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return 'rain';
 if(wind>=25)return 'wind';
 if([2,3,45,48].includes(code))return 'cloud';
 return day?'sun':'clear-night';
}
export function useWeather(uid:string,enabled:boolean):WeatherState{
 const[kind,setKind]=useState<WeatherKind|null>(null),[status,setStatus]=useState(''),[tick,setTick]=useState(0),[animate,setAnimate]=useState(false);
 const lastAttempt=useRef(0);
 const explicit=useRef(false),version=useRef(0),cache=useRef<{at:number;kind:WeatherKind}|null>(null);
 useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setAnimate(!mq.matches&&!(navigator as any).connection?.saveData&&(navigator.hardwareConcurrency||8)>2&&!document.hidden);update();mq.addEventListener('change',update);document.addEventListener('visibilitychange',update);return()=>{mq.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);};},[]);
 useEffect(()=>{cache.current=null;setKind(null);},[uid]);
 useEffect(()=>{
  const run=++version.current;let timer:number|undefined,controller:AbortController|undefined;
  if(!enabled){setKind(null);setStatus('Weather is off.');return;}
  const update=async()=>{
   if(document.hidden)return;
   if(!explicit.current&&lastAttempt.current&&Date.now()-lastAttempt.current<CACHE_MS)return;
   if(cache.current&&Date.now()-cache.current.at<CACHE_MS){setKind(cache.current.kind);setStatus('Weather updated. Refreshes about every 30 minutes while open.');return;}
   if(!navigator.geolocation){setStatus('Location is not supported here. Your fixed theme stays on.');return;}
   if(!explicit.current){
    try{const permission=await navigator.permissions.query({name:'geolocation'});if(permission.state!=='granted'){setStatus('Tap Enable / refresh weather to allow location. Your fixed theme stays on.');return;}}
    catch{setStatus('Tap Enable / refresh weather to allow location.');return;}
   }
   if(run!==version.current)return;
   explicit.current=false;lastAttempt.current=Date.now();setStatus('Finding local weather...');
   navigator.geolocation.getCurrentPosition(async position=>{
    if(run!==version.current)return;
    // Round to about a 5 km grid; never persist coordinates or send account IDs.
    const lat=Math.round(position.coords.latitude*20)/20,lon=Math.round(position.coords.longitude*20)/20;
    controller=new AbortController();const timeout=window.setTimeout(()=>controller?.abort(),12000);
    try{
     const url=new URL('https://api.open-meteo.com/v1/forecast');url.search=new URLSearchParams({latitude:String(lat),longitude:String(lon),current:'weather_code,wind_speed_10m,is_day',forecast_days:'1'}).toString();
     const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('weather');const data=await response.json(),c=data.current;
     if(!c||!Number.isFinite(c.weather_code)||!Number.isFinite(c.wind_speed_10m)||![0,1].includes(c.is_day))throw Error('weather');
     if(run!==version.current)return;const next=weatherKind(c.weather_code,c.wind_speed_10m,c.is_day===1);cache.current={at:Date.now(),kind:next};setKind(next);setStatus('Weather updated. Refreshes about every 30 minutes while open.');
    }catch{if(run===version.current)setStatus(cache.current?'Weather refresh failed. Showing the last weather from this visit.':'Weather is unavailable. Your fixed theme stays on. Try again later.');}
    finally{window.clearTimeout(timeout);}
   },error=>{if(run!==version.current)return;setStatus(error.code===1?'Location was not allowed. Your fixed theme stays on. You can allow location in browser settings and try again.':'Could not find your location. Your fixed theme stays on. Try again later.');},{enableHighAccuracy:false,timeout:12000,maximumAge:15*60*1000});
  };
  void update();timer=window.setInterval(()=>void update(),60000);const visible=()=>{if(!document.hidden)void update();};document.addEventListener('visibilitychange',visible);
  return()=>{version.current++;window.clearInterval(timer);controller?.abort();document.removeEventListener('visibilitychange',visible);};
 },[enabled,uid,tick]);
 return{kind,status,animate,refresh:()=>{explicit.current=true;cache.current=null;setTick(n=>n+1);}};
}
export function WeatherScene({chat=false}:{chat?:boolean}){
 const weather=useContext(WeatherContext);if(!weather.kind)return null;
 return <div className={`dd-weather-scene${chat?' is-chat':''} weather-${weather.kind}${weather.animate?' is-moving':''}`} aria-hidden="true"><div className="dd-weather-orb"/><div className="dd-weather-cloud c1"/><div className="dd-weather-cloud c2"/>{Array.from({length:weather.kind==='rain'||weather.kind==='storm'?22:weather.kind==='snow'?16:7},(_,i)=><i key={i} style={{'--wx-i':i,'--wx-x':`${(i*37+7)%100}%`,'--wx-delay':`${-i*.37}s`} as React.CSSProperties}/>)}</div>;
}
