import {VoiceLockContext} from './VoiceLockContext';
import {ZoomPhoto} from './ZoomPhoto';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Person, PersonId } from './model';
import { useStore } from './store';
import { Bell, Gear, ArrowLeft, Heart, ChevronLeft, ChevronRight, XIcon, MessageCircle, ImagePlus } from './icons';

// ticking clock
export function useNow(stepMs = 1000): Date {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        let t:ReturnType<typeof setInterval>|undefined;
        const update=()=>{if(!document.hidden)setNow(new Date());};
        const visibility=()=>{if(t)clearInterval(t);t=undefined;if(!document.hidden){update();t=setInterval(update,stepMs);}};
        visibility();document.addEventListener('visibilitychange',visibility);
        return()=>{if(t)clearInterval(t);document.removeEventListener('visibilitychange',visibility);};
    }, [stepMs]);
    return now;
}

// delayed programmatic navigation
export function useGo() {
    const ref = React.useRef<HTMLSpanElement>(null);
    const [dest, setDest] = useState<string | null>(null);
    useEffect(() => {
        if (!dest) return;
        const t = setTimeout(() => {
            ref.current?.querySelector('a')?.click();
            setDest(null);
        }, 20);
        return () => clearTimeout(t);
    }, [dest]);
    const go = (to: string, delayMs = 0) => setTimeout(() => setDest(to), delayMs);
    const portal = <span ref={ref} style={{ display: 'none' }} aria-hidden="true">{dest ? <Link to={dest}>go</Link> : null}</span>;
    return { go, portal };
}

// ---------- shared UI ----------

export function TopBar({ back, backLabel, alert, social = false }: { back?: string; backLabel?: string; alert?: boolean; social?: boolean }) {
    const { pathname } = useLocation();
    const voiceLock=useContext(VoiceLockContext);
    const shortcut=pathname==='/'&&!!voiceLock;
    const lastTap=React.useRef<{time:number;x:number;y:number}|null>(null);
    const down=React.useRef<{x:number;y:number}|null>(null);
    const doubleTap=(e:React.MouseEvent<HTMLButtonElement>)=>{
        if(!voiceLock?.supported)return;
        if(down.current&&Math.hypot(e.clientX-down.current.x,e.clientY-down.current.y)>12){lastTap.current=null;return;}
        const now=performance.now(),last=lastTap.current;
        if(last&&now-last.time<=350&&Math.hypot(e.clientX-last.x,e.clientY-last.y)<=24){lastTap.current=null;voiceLock.setEnabled(!voiceLock.enabled);}
        else lastTap.current={time:now,x:e.clientX,y:e.clientY};
    };
    const options = pathname.startsWith('/settings') || pathname === '/notifications';
    return (
        <header className={`dd-topbar${social ? ' dd-home-socialbar' : ''}${back ? ' has-back' : ''}${shortcut ? ' has-voice-shortcut' : ''}`}>
            <div className="dd-topbar-side">
                {back
                    ? <Link className="dd-iconbtn" to={back} aria-label={backLabel ?? 'Back'}><ArrowLeft /></Link>
                    : <span className="dd-iconbtn is-placeholder" />}
            </div>
            <Link to="/" className="dd-wordmark"><img src={`${import.meta.env.BASE_URL}icons/diary-192.png`} width="32" height="32" alt="" /> <span>Dear Diary</span></Link>
            {shortcut&&<button type="button" className="dd-voice-shortcut" aria-label="Double tap to toggle voice lock" disabled={!voiceLock?.supported} onPointerDown={e=>{down.current={x:e.clientX,y:e.clientY};}} onPointerCancel={()=>{down.current=null;lastTap.current=null;}} onClick={doubleTap}/>}
            <div className="dd-topbar-side is-right">
                {social && <button type="button" className="dd-iconbtn" aria-label="Create a post" onClick={() => window.dispatchEvent(new Event("dd-create-feed-post"))}><ImagePlus size={24}/></button>}
                <Link className="dd-iconbtn" to={options ? "/notifications" : "/inbox"} aria-label={options ? "Notification preferences" : "Notification inbox"}>
                    {social ? <Heart size={25}/> : <Bell />}
                </Link>
                {social ? <Link className="dd-iconbtn" to="/chat" aria-label="Messages"><MessageCircle size={25}/></Link> : <Link className="dd-iconbtn" to="/settings" aria-label="Profile and settings"><Gear /></Link>}
            </div>
        </header>
    );
}

export function Avatar({ person, size = '' }: { person: Person; size?: 'lg' | 'sm' | '' }) {
    const store = useStore();
    const photo = store.avatarPhotos[person.id];
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [photo]);
    return <span className={`dd-avatar${size ? ` dd-avatar-${size}` : ''} dd-av-${store.avatars[person.id]}`}>
        {photo && !failed ? <img src={photo} alt={`${person.name}'s profile picture`} onError={() => setFailed(true)} /> : person.initial}
    </span>;
}

export function Book({ person, avatar, unread, onOpen }: { person: Person; avatar: number; unread: string | null; onOpen: (to: string, delay: number) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <button type="button" className={`dd-bookwrap${open ? ' is-open' : ''}`}
            onClick={() => { setOpen(true); onOpen(`/pin/${person.id}`, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280); }}
            aria-label={`Open ${person.name}'s diary`}>
            <span className="dd-book">
                <span className="dd-book-pages" />
                <span className={`dd-book-cover dd-hue-${person.hue}`}>
                    <span className="dd-stitch">
                        <span className="dd-cover-heart"><Heart size={17} /></span>
                        <Avatar person={person} />
                        <span className="dd-cover-title">{person.name}&rsquo;s Diary</span>
                        <span className="dd-cover-hint">tap to open</span>
                    </span>
                    {unread && <span className="dd-badge"><Bell size={13} /> new page</span>}
                </span>
            </span>
        </button>
    );
}

export function Chip({ icon, children, tone }: { icon?: React.ReactNode; children: React.ReactNode; tone?: 'pink' | 'lavender' | 'sage' | 'plain' }) {
    return <span className={`dd-chip dd-chip-${tone ?? 'plain'}`}>{icon}{children}</span>;
}

function PhotoViewer({ photos, start, title, onClose }: { photos: { src: string; alt: string }[]; start: number; title: string; onClose: () => void }) {
    const [idx, setIdx] = useState(start);
    return (
        <div className="dd-viewer" role="dialog" aria-label={title} onClick={onClose}>
            <div className="dd-viewer-inner" onClick={e => e.stopPropagation()}>
                <ZoomPhoto src={photos[idx].src} alt={photos[idx].alt} onSwipe={d=>setIdx(i=>Math.max(0,Math.min(photos.length-1,i+d)))}/>
                <div className="dd-viewer-bar">
                    <button type="button" className="dd-iconbtn" disabled={idx === 0} onClick={() => setIdx(i => i - 1)} aria-label="Previous photo"><ChevronLeft /></button>
                    <span>{idx + 1} / {photos.length}</span>
                    <button type="button" className="dd-iconbtn" disabled={idx === photos.length - 1} onClick={() => setIdx(i => i + 1)} aria-label="Next photo"><ChevronRight /></button>
                    <button type="button" className="dd-iconbtn" onClick={onClose} aria-label="Close"><XIcon size={16} /></button>
                </div>
            </div>
        </div>
    );
}

export function PhotoGallery({ photos, title, onRemove }: { photos: string[]; title: string; onRemove?: (idx: number) => void }) {
    const [openAt, setOpenAt] = useState<number | null>(null);
    if (photos.length === 0) return null;
    return (
        <>
            <div className="dd-photos">
                {photos.map((src, i) => (
                    <span key={i} className="dd-photo">
                        <button type="button" onClick={() => setOpenAt(i)} aria-label={`Open photo ${i + 1}`}>
                            <img src={src} alt={`Diary photo ${i + 1}`} loading="lazy" />
                        </button>
                        {onRemove && (
                            <button type="button" className="dd-photo-x" onClick={() => onRemove(i)} aria-label={`Remove photo ${i + 1}`}>
                                &times;
                            </button>
                        )}
                    </span>
                ))}
            </div>
            {openAt !== null && (
                <PhotoViewer
                    photos={photos.map((src, i) => ({ src, alt: `Diary photo ${i + 1}` }))}
                    start={openAt}
                    title={title}
                    onClose={() => setOpenAt(null)}
                />
            )}
        </>
    );
}

export function Toggle({ label, hint, on, onChange, disabled = false }: { label: string; hint: string; on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="dd-toggle-row">
            <div>
                <div className="dd-toggle-label">{label}</div>
                <div className="dd-toggle-hint">{hint}</div>
            </div>
            <button type="button" role="switch" disabled={disabled} aria-checked={on} aria-label={label}
                className={`dd-switch${on ? ' is-on' : ''}`} onClick={() => onChange(!on)}>
                <span className="dd-switch-knob" />
            </button>
        </div>
    );
}

export function EmptyNote({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
    return (
        <div className="dd-empty">
            <span className="dd-empty-icon">{icon}</span>
            <p className="dd-empty-title">{title}</p>
            {children && <p className="dd-empty-sub">{children}</p>}
        </div>
    );
}
