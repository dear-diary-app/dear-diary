import React,{useEffect,useState}from'react';
import{useAIPreferences}from'./AISettings';
export const SLASH_COMMANDS=[
 {command:'/truthdare',fill:'/truthdare',hint:'A private challenge with optional answers'},
 {command:'/1year',fill:'/1year',hint:'Our first-year timer'},
 {command:'/ask',fill:'/ask ',hint:'Daily yes/no question'},
 {command:'/ddai-',fill:'/ddai- ',hint:'Private AI question'},
 {command:'/image-',fill:'/image-',hint:'Find an image'},
 {command:'/music-',fill:'/music-',hint:'Find a song'},
 {command:'/weather',fill:'/weather',hint:'Share current weather'},
];
export function SlashCommands({uid,value,onPick}:{uid:string;value:string;onPick:(text:string)=>void}){const{prefs}=useAIPreferences(uid),[dismissed,setDismissed]=useState<string|null>(null);const prefix=value.toLowerCase();const rows=/^\/[a-z0-9-]*$/i.test(value)?SLASH_COMMANDS.filter(c=>c.command.startsWith(prefix)):[];useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setDismissed(value);};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[value]);if(!rows.length||dismissed===value)return null;return <section className="dd-slash-commands" aria-label="Slash commands"><header><span>Shortcuts</span><button type="button" aria-label="Close shortcuts" onPointerDown={e=>e.preventDefault()} onClick={()=>setDismissed(value)}>×</button></header><div>{rows.map(c=>{const ai=c.command==='/ddai-',disabled=ai&&!prefs?.ddai_enabled;return <button key={c.command} type="button" disabled={disabled} onPointerDown={e=>e.preventDefault()} onClick={()=>{setDismissed(c.fill);onPick(c.fill);}}><strong>{c.command}</strong><span>{ai?prefs?(prefs.ddai_enabled?'Private AI question':'Off in Settings'):'Checking AI settings…':c.hint}</span></button>;})}</div></section>;}
