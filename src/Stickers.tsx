import React, { useRef, useState } from 'react';
import pack from './sticker-pack.json';
export interface Sticker { id: string; art: string; x: number; y: number; size: number }
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export function cleanStickers(value: unknown): Sticker[] {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 16).filter(s => s && typeof s.id === 'string' && pack.some(p => p.id === s.art) && [s.x,s.y,s.size].every(Number.isFinite)).map(s => ({ id:s.id.slice(0,80), art:s.art, x:clamp(s.x,0,100), y:clamp(s.y,0,100), size:clamp(s.size,12,38) }));
}
const artUrl = (id: string) => `${import.meta.env.BASE_URL}stickers/${id}.webp`;
export function Stickers({ value, onChange }: { value: Sticker[]; onChange?: (v: Sticker[]) => void }) {
    const [open,setOpen] = useState(false);
    const [theme,setTheme] = useState('All');
    const [selected,setSelected] = useState<string | null>(null);
    const board = useRef<HTMLDivElement>(null);
    const drag = useRef<{ id:string; dx:number; dy:number } | null>(null);
    const resize = useRef<{ x:number; size:number } | null>(null);
    const current = useRef(value); current.current = value;
    const active = value.find(s => s.id === selected);
    function update(id:string, patch:Partial<Sticker>) { onChange?.(current.current.map(s => s.id === id ? { ...s,...patch } : s)); }
    const add = (art:string) => {
        if (value.length >= 16) return;
        const id = crypto.randomUUID();
        onChange?.([...value,{id,art,x:15+(value.length%4)*22,y:25+(Math.floor(value.length/4)%3)*23,size:23}]);
        setSelected(id);
    };
    if (!onChange && !value.length) return null;
    return <section className={`dd-stickers${onChange ? ' is-editable' : ''}`} aria-label="Journal stickers">
        {onChange && <><div className="dd-sticker-toolbar"><div><strong>A little decoration</strong><p>Make this corner of the page yours.</p></div><button type="button" className="dd-sticker-add" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close tray' : '+ Stickers'}</button></div>
        {open && <div className="dd-sticker-tray"><div className="dd-sticker-tabs" role="group" aria-label="Sticker themes">{['All','Botanical','Cozy','Celestial','Love'].map(t => <button type="button" key={t} aria-pressed={theme===t} onClick={() => setTheme(t)}>{t}</button>)}</div><div className="dd-sticker-grid">{pack.filter(s => theme==='All'||s.group===theme).map(s => <button key={s.id} type="button" disabled={value.length>=16} aria-label={`Add ${s.name}`} onClick={() => add(s.id)}><img src={artUrl(s.id)} alt="" loading="lazy" width="72" height="72"/><span>{s.name}</span></button>)}</div><p className="dd-sticker-help">{value.length}/16 on this page. Tap a sticker to add it.</p></div>}</>}
        <div className="dd-sticker-board" ref={board} onPointerDown={e => { if(e.target===e.currentTarget) setSelected(null); }}>
            {!value.length && onChange && <span className="dd-sticker-empty">A ribbon, a flower, a tiny memory...</span>}
            {value.map(s => { const name=pack.find(p=>p.id===s.art)?.name || 'Sticker'; return <button type="button" key={s.id} disabled={!onChange} className={`dd-placed-sticker${onChange&&selected===s.id?' is-selected':''}`} style={{left:`${s.x}%`,top:`${s.y}%`,width:`${s.size}%`}} aria-label={onChange ? `Move ${name}` : name}
                onPointerDown={e => { if(!onChange||!board.current) return; e.preventDefault();setSelected(s.id); const r=board.current.getBoundingClientRect();drag.current={id:s.id,dx:e.clientX-r.left-s.x*r.width/100,dy:e.clientY-r.top-s.y*r.height/100};e.currentTarget.setPointerCapture(e.pointerId); }}
                onPointerMove={e => { if(!onChange||drag.current?.id!==s.id||!board.current) return; const r=board.current.getBoundingClientRect();const half=s.size/2;const hy=half*r.width/r.height;update(s.id,{x:clamp((e.clientX-r.left-drag.current.dx)/r.width*100,half,100-half),y:clamp((e.clientY-r.top-drag.current.dy)/r.height*100,hy,100-hy)}); }}
                onPointerUp={() => {drag.current=null;}} onPointerCancel={() => {drag.current=null;}}
                onKeyDown={e => { if(!onChange) return; const delta:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(delta[e.key]) { e.preventDefault();setSelected(s.id);const [dx,dy]=delta[e.key];update(s.id,{x:clamp(s.x+dx,s.size/2,100-s.size/2),y:clamp(s.y+dy,s.size*2/3,100-s.size*2/3)}); } }}>
                <img src={artUrl(s.art)} alt={name} draggable={false} width="256" height="256"/>
            </button>;})}
            {onChange && active && <button type="button" className="dd-sticker-handle" aria-label="Resize selected sticker" style={{left:`calc(${active.x+active.size/2}% - 14px)`,top:`calc(${active.y+active.size*2/3}% - 14px)`}}
                onPointerDown={e => { e.preventDefault();e.stopPropagation();resize.current={x:e.clientX,size:active.size};e.currentTarget.setPointerCapture(e.pointerId); }}
                onPointerMove={e => {if(!resize.current||!board.current) return;const size=clamp(resize.current.size+(e.clientX-resize.current.x)/board.current.clientWidth*200,12,38);update(active.id,{size,x:clamp(active.x,size/2,100-size/2),y:clamp(active.y,size*2/3,100-size*2/3)});}}
                onPointerUp={() => {resize.current=null;}} onPointerCancel={() => {resize.current=null;}}
                onKeyDown={e => {if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const size=clamp(active.size+(e.key==='ArrowRight'?1:-1),12,38);update(active.id,{size,x:clamp(active.x,size/2,100-size/2),y:clamp(active.y,size*2/3,100-size*2/3)});}}}>↔</button>}
        </div>
        {onChange && <div className="dd-sticker-controls">{active ? <><label>Size <input type="range" aria-label="Sticker size" min="12" max="38" value={active.size} onChange={e => {const size=+e.target.value;update(active.id,{size,x:clamp(active.x,size/2,100-size/2),y:clamp(active.y,size*2/3,100-size*2/3)});}}/></label><button type="button" onClick={() => {onChange(value.filter(s => s.id!==active.id));setSelected(null);}}>Remove</button><button type="button" onClick={() => setSelected(null)}>Done</button></> : <p>Tap a sticker to select. Drag to move; drag the corner or use Size to resize.</p>}</div>}
    </section>;
}
