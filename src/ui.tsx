import React, { createContext, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Person, PersonId } from './model';
import { useStore } from './store';
import { Bell, Gear, ArrowLeft, Heart, ChevronLeft, ChevronRight, XIcon } from './icons';

// ticking clock
export function useNow(stepMs = 1000): Date {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), stepMs);
        return () => clearInterval(t);
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

export function TopBar({ back, backLabel, alert }: { back?: string; backLabel?: string; alert?: boolean }) {
    return (
        <header className="dd-topbar">
            <div className="dd-topbar-side">
                {back
                    ? <Link className="dd-iconbtn" to={back} aria-label={backLabel ?? 'Back'}><ArrowLeft /></Link>
                    : <span className="dd-iconbtn is-placeholder" />}
            </div>
            <Link to="/" className="dd-wordmark">Dear Diary <Heart size={15} /></Link>
            <div className="dd-topbar-side is-right">
                <Link className="dd-iconbtn" to="/notifications" aria-label="Notification preferences">
                    <Bell />
                    {alert && <span className="dd-dot" aria-label="New pages to read" />}
                </Link>
                <Link className="dd-iconbtn" to="/settings" aria-label="Profile and settings"><Gear /></Link>
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
            onClick={() => { setOpen(true); onOpen(`/pin/${person.id}`, 620); }}
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
                <img src={photos[idx].src} alt={photos[idx].alt} />
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

export function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="dd-toggle-row">
            <div>
                <div className="dd-toggle-label">{label}</div>
                <div className="dd-toggle-hint">{hint}</div>
            </div>
            <button type="button" role="switch" aria-checked={on} aria-label={label}
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
