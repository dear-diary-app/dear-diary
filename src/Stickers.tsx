import React, { useRef, useState } from 'react';
import pack from './sticker-pack.json';
export interface Sticker { id: string; art: string; x: number; y: number; size: number; rotation?: number }
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const angle = (v: number) => ((v + 180) % 360 + 360) % 360 - 180;
export function cleanStickers(value: unknown): Sticker[] {
    if (!Array.isArray(value)) return [];
    return value.slice(0,16).filter(s => s && typeof s.id==='string' && pack.some(p => p.id===s.art) && [s.x,s.y,s.size].every(Number.isFinite)).map(s => ({id:s.id.slice(0,80),art:s.art,x:clamp(s.x,0,100),y:clamp(s.y,0,100),size:clamp(s.size,12,38),rotation:Number.isFinite(s.rotation)?angle(s.rotation):0}));
}
const artUrl = (id: string) => `${import.meta.env.BASE_URL}stickers/${id}.webp`;
type Point = { x:number; y:number };
type Gesture = { id:string; start:Sticker; points:Map<number,Point>; center:Point; distance:number; angle:number };
export function Stickers({ value, onChange, text='', onTextChange, label='Diary page', placeholder='' }: { value:Sticker[]; onChange?:(v:Sticker[])=>void; text?:string; onTextChange?:(text:string)=>void; label?:string; placeholder?:string }) {
    const [open,setOpen]=useState(false),[theme,setTheme]=useState('All'),[selected,setSelected]=useState<string|null>(null);
    const board=useRef<HTMLDivElement>(null);
    const gesture=useRef<Gesture|null>(null);
    const handle=useRef<{start:Sticker;x:number;angle:number;mode:'size'|'rotation'}|null>(null);
    const current=useRef(value);current.current=value;
    const active=value.find(s=>s.id===selected);
    function bounded(s:Sticker):Sticker {
        if(!board.current) return s;
        const r=board.current.getBoundingClientRect(),rad=(s.rotation??0)*Math.PI/180;
        const half=s.size/2*(Math.abs(Math.cos(rad))+Math.abs(Math.sin(rad)));
        return {...s,x:clamp(s.x,half,100-half),y:clamp(s.y,half*r.width/r.height,100-half*r.width/r.height)};
    }
    function update(id:string,patch:Partial<Sticker>) {
        const next=current.current.map(s=>s.id===id?bounded({...s,...patch}):s);current.current=next;onChange?.(next);
    }
    function measures(points:Map<number,Point>) {
        const p=[...points.values()];const a=p[0],b=p[1]??a;
        return {center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.hypot(b.x-a.x,b.y-a.y),angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
    }
    function rebase(g:Gesture) {const s=current.current.find(s=>s.id===g.id);if(s)Object.assign(g,{start:{...s},...measures(g.points)});}
    function pointerDown(e:React.PointerEvent<HTMLButtonElement>,s:Sticker) {
        if(!onChange||!board.current) return;e.preventDefault();e.stopPropagation();setSelected(s.id);
        if(gesture.current?.id!==s.id)gesture.current={id:s.id,start:{...s},points:new Map(),center:{x:0,y:0},distance:0,angle:0};
        const g=gesture.current!;g.points.set(e.pointerId,{x:e.clientX,y:e.clientY});rebase(g);e.currentTarget.setPointerCapture(e.pointerId);
    }
    function pointerMove(e:React.PointerEvent<HTMLButtonElement>) {
        const g=gesture.current;if(!g?.points.has(e.pointerId)||!board.current)return;
        g.points.set(e.pointerId,{x:e.clientX,y:e.clientY});const m=measures(g.points),r=board.current.getBoundingClientRect();
        update(g.id,{x:g.start.x+(m.center.x-g.center.x)/r.width*100,y:g.start.y+(m.center.y-g.center.y)/r.height*100,size:g.points.size>=2&&g.distance>0?clamp(g.start.size*m.distance/g.distance,12,38):g.start.size,rotation:g.points.size>=2?angle((g.start.rotation??0)+angle(m.angle-g.angle)):g.start.rotation??0});
    }
    function pointerEnd(e:React.PointerEvent<HTMLButtonElement>) {const g=gesture.current;if(!g)return;g.points.delete(e.pointerId);if(g.points.size)rebase(g);else gesture.current=null;}
    function beginHandle(e:React.PointerEvent<HTMLButtonElement>,mode:'size'|'rotation') {
        if(!active||!board.current)return;e.preventDefault();e.stopPropagation();const r=board.current.getBoundingClientRect();
        handle.current={start:{...active},x:e.clientX,angle:Math.atan2(e.clientY-r.top-active.y*r.height/100,e.clientX-r.left-active.x*r.width/100)*180/Math.PI,mode};e.currentTarget.setPointerCapture(e.pointerId);
    }
    function moveHandle(e:React.PointerEvent<HTMLButtonElement>) {
        const h=handle.current;if(!h||!board.current)return;const r=board.current.getBoundingClientRect();
        if(h.mode==='size')update(h.start.id,{size:clamp(h.start.size+(e.clientX-h.x)/r.width*200,12,38)});
        else update(h.start.id,{rotation:angle((h.start.rotation??0)+Math.atan2(e.clientY-r.top-h.start.y*r.height/100,e.clientX-r.left-h.start.x*r.width/100)*180/Math.PI-h.angle)});
    }
    return <section className={`dd-journal${onChange?' is-editable':''}`} aria-label="Journal page">
        {onChange&&<><div className="dd-sticker-toolbar"><div><strong>Make the page yours</strong><p>Stickers can go anywhere, even over your words.</p></div><button type="button" className="dd-sticker-add" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Close tray':'+ Stickers'}</button></div>
        {open&&<div className="dd-sticker-tray"><div className="dd-sticker-tabs" role="group" aria-label="Sticker themes">{['All','Botanical','Cozy','Celestial','Love'].map(t=><button type="button" key={t} aria-pressed={theme===t} onClick={()=>setTheme(t)}>{t}</button>)}</div><div className="dd-sticker-grid">{pack.filter(s=>theme==='All'||s.group===theme).map(s=><button key={s.id} type="button" disabled={value.length>=16} aria-label={`Add ${s.name}`} onClick={()=>{if(value.length>=16)return;const id=crypto.randomUUID();onChange([...value,{id,art:s.id,x:22+value.length%3*27,y:25+Math.floor(value.length/3)%3*22,size:23,rotation:0}]);setSelected(id);}}><img src={artUrl(s.id)} alt="" loading="lazy" width="72" height="72"/><span>{s.name}</span></button>)}</div><p className="dd-sticker-help">{value.length}/16 on this page. Tap a sticker to add it.</p></div>}</>}
        <div className="dd-paper dd-journal-paper" ref={board}>
            <p className={`dd-page-text${onTextChange?' is-mirror':''}`} aria-hidden={onTextChange?true:undefined}>{text+'\n'}</p>
            {onTextChange&&<textarea className="dd-page-input" value={text} onChange={e=>onTextChange(e.target.value)} onPointerDown={e=>{setSelected(null);e.currentTarget.focus();}} onFocus={()=>setSelected(null)} aria-label={label} placeholder={placeholder} spellCheck />}
            <div className="dd-sticker-overlay">
                {value.map(s=>{const name=pack.find(p=>p.id===s.art)?.name??'Sticker';return <button type="button" key={s.id} disabled={!onChange} className={`dd-placed-sticker${onChange&&selected===s.id?' is-selected':''}`} style={{left:`${s.x}%`,top:`${s.y}%`,width:`${s.size}%`,transform:`translate(-50%,-50%) rotate(${s.rotation??0}deg)`}} aria-label={onChange?`Move ${name}`:name}
                    onPointerDown={e=>pointerDown(e,s)} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
                    onKeyDown={e=>{if(!onChange)return;const d:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(d[e.key]){e.preventDefault();setSelected(s.id);update(s.id,{x:s.x+d[e.key][0],y:s.y+d[e.key][1]});}}}>
                    <img src={artUrl(s.art)} alt={name} draggable={false} width="256" height="256"/>
                </button>;})}
                {onChange&&active&&(['size','rotation'] as const).map(mode=><button key={mode} type="button" className={`dd-sticker-handle is-${mode}`} aria-label={mode==='size'?'Resize selected sticker':'Rotate selected sticker'} style={{left:`calc(${active.x}% + ${mode==='size'?active.size/2:0}cqw - 14px)`,top:`calc(${active.y}% ${mode==='size'?'+':'-'} ${active.size/2}cqw - 14px)`}} onPointerDown={e=>beginHandle(e,mode)} onPointerMove={moveHandle} onPointerUp={()=>{handle.current=null;}} onPointerCancel={()=>{handle.current=null;}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();update(active.id,mode==='size'?{size:clamp(active.size+(e.key==='ArrowRight'?1:-1),12,38)}:{rotation:angle((active.rotation??0)+(e.key==='ArrowRight'?1:-1))});}}}>{mode==='size'?'↔':'↻'}</button>)}
            </div>
        </div>
        {onChange&&<div className="dd-sticker-controls">{active?<><label>Size<input type="range" aria-label="Sticker size" min="12" max="38" step="0.1" value={active.size} onChange={e=>update(active.id,{size:+e.target.value})}/></label><label>Rotate<input type="range" aria-label="Sticker rotation" min="-180" max="180" value={Math.round(active.rotation??0)} onChange={e=>update(active.id,{rotation:+e.target.value})}/><output>{Math.round(active.rotation??0)}°</output></label><div className="dd-sticker-actions"><button type="button" onClick={()=>{onChange(value.filter(s=>s.id!==active.id));setSelected(null);}}>Remove</button><button type="button" onClick={()=>setSelected(null)}>Done</button></div></>:<p>Drag a sticker anywhere. Pinch to resize, twist to rotate. Tap uncovered words to write.</p>}</div>}
    </section>;
}
