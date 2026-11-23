import React,{createContext,useContext,useEffect,useRef,useState}from'react';
export type WeatherKind='sun'|'clear-night'|'cloud'|'rain'|'wind'|'storm'|'snow';
export type WeatherCity={id:number;name:string;region:string;country:string;latitude:number;longitude:number};
const cityKey=(uid:string)=>`dd_weather_city_${uid}`;
const cleanCity=(value:any):WeatherCity|null=>value&&Number.isFinite(value.id)&&typeof value.name==='string'&&typeof value.region==='string'&&typeof value.country==='string'&&Number.isFinite(value.latitude)&&Math.abs(value.latitude)<=90&&Number.isFinite(value.longitude)&&Math.abs(value.longitude)<=180?{id:value.id,name:value.name.slice(0,100),region:value.region.slice(0,100),country:value.country.slice(0,100),latitude:Math.round(value.latitude*20)/20,longitude:Math.round(value.longitude*20)/20}:null;
export type WeatherState={updatedAt:number|null;day:boolean;kind:WeatherKind|null;status:string;refresh:()=>void;animate:boolean;city:WeatherCity|null;setCity:(city:WeatherCity|null)=>void};
export const WeatherContext=createContext<WeatherState>({updatedAt:null,day:true,kind:null,status:'',refresh:()=>{},animate:false,city:null,setCity:()=>{}});
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
 const[updatedAt,setUpdatedAt]=useState<number|null>(null),[day,setDay]=useState(true);
 const[kind,setKind]=useState<WeatherKind|null>(null),[status,setStatus]=useState(''),[tick,setTick]=useState(0),[animate,setAnimate]=useState(false);
 const [city,setCityState]=useState<WeatherCity|null>(()=>{try{return cleanCity(JSON.parse(localStorage.getItem(cityKey(uid))||'null'));}catch{return null;}});
 const setCity=(value:WeatherCity|null)=>{const next=cleanCity(value);setCityState(next);cache.current=null;lastAttempt.current=0;setKind(null);setUpdatedAt(null);try{if(next)localStorage.setItem(cityKey(uid),JSON.stringify(next));else localStorage.removeItem(cityKey(uid));}catch{};if(!next)explicit.current=true;setTick(n=>n+1);};
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
   const load=async(lat:number,lon:number)=>{
    if(run!==version.current)return;
    controller=new AbortController();const timeout=window.setTimeout(()=>controller?.abort(),12000);
    try{
     const url=new URL('https://api.open-meteo.com/v1/forecast');url.search=new URLSearchParams({latitude:String(lat),longitude:String(lon),current:'weather_code,wind_speed_10m,is_day',forecast_days:'1'}).toString();
     const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('weather');const data=await response.json(),c=data.current;
     if(!c||!Number.isFinite(c.weather_code)||!Number.isFinite(c.wind_speed_10m)||![0,1].includes(c.is_day))throw Error('weather');
     if(run!==version.current)return;const next=weatherKind(c.weather_code,c.wind_speed_10m,c.is_day===1);cache.current={at:Date.now(),kind:next};setKind(next);setDay(c.is_day===1);setUpdatedAt(Date.now());setStatus('Weather updated. Refreshes about every 30 minutes while open.');
    }catch(error){if(run===version.current)setStatus(`${cache.current?'Showing the last weather from this visit. ':''}${error instanceof DOMException&&error.name==='AbortError'?'Weather request timed out.':'Weather request failed or was blocked by the network.'} Check your connection and tap refresh.`);}
    finally{window.clearTimeout(timeout);}
   };
   if(city){explicit.current=false;lastAttempt.current=Date.now();setStatus(`Finding weather for ${city.name}...`);void load(city.latitude,city.longitude);return;}
   if(!navigator.geolocation){setStatus('Location is not supported here. Search for a city below.');return;}
   if(!explicit.current){
    try{const permission=await navigator.permissions.query({name:'geolocation'});if(permission.state!=='granted'){setStatus('Allow device location or search for a city below.');return;}}
    catch{setStatus('Allow device location or search for a city below.');return;}
   }
   if(run!==version.current)return;explicit.current=false;lastAttempt.current=Date.now();setStatus('Finding local weather...');
   navigator.geolocation.getCurrentPosition(position=>{
    if(run!==version.current)return;void load(Math.round(position.coords.latitude*20)/20,Math.round(position.coords.longitude*20)/20);
   },error=>{if(run!==version.current)return;setStatus(error.code===1?'Location was not allowed. Your selected theme stays on. Search for a city below, or allow location in browser settings.':'Could not find your location. Search for a city below or try again later.');},{enableHighAccuracy:false,timeout:12000,maximumAge:15*60*1000});
  };
  void update();timer=window.setInterval(()=>void update(),60000);const visible=()=>{if(!document.hidden)void update();};document.addEventListener('visibilitychange',visible);
  return()=>{version.current++;window.clearInterval(timer);controller?.abort();document.removeEventListener('visibilitychange',visible);};
 },[enabled,uid,tick,city]);
 return{updatedAt,day,kind,status,animate,city,setCity,refresh:()=>{explicit.current=true;cache.current=null;setTick(n=>n+1);}};
}
export function WeatherScene({chat=false}:{chat?:boolean}){
 const weather=useContext(WeatherContext);if(!weather.kind)return null;
 return <div className={`dd-weather-scene${chat?' is-chat':''} weather-${weather.kind}${weather.animate?' is-moving':''}`} aria-hidden="true"><div className="dd-weather-orb"/><div className="dd-weather-cloud c1"/><div className="dd-weather-cloud c2"/>{Array.from({length:weather.kind==='rain'||weather.kind==='storm'?22:weather.kind==='snow'?16:7},(_,i)=><i key={i} style={{'--wx-i':i,'--wx-x':`${(i*37+7)%100}%`,'--wx-delay':`${-i*.37}s`} as React.CSSProperties}/>)}</div>;
}

export const weatherLabel=(kind:WeatherKind)=>({'sun':'Sunny','clear-night':'Clear night','cloud':'Cloudy / foggy','rain':'Rain','wind':'Windy','storm':'Thunderstorm','snow':'Snow'}[kind]);
export function WeatherSummary(){const w=useContext(WeatherContext);return <div className="dd-weather-summary" role="status">{w.kind&&<strong>{weatherLabel(w.kind)}{w.updatedAt?` · updated ${new Date(w.updatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:''}</strong>}<span>{w.status}</span>{w.kind&&<small>{w.animate?'Animated background':'Still background (reduced motion, data saver or low-power device)'}</small>}</div>;}
