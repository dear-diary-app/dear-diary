import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_REACTIONS, frequentReactions } from './reactions';
import { XIcon } from './icons';
type Catalogue = [string, [string, string][]][];
const ICONS = ['☺', '♧', '♨', '⚽', '✈', '⌁', '♡', '⚑'];
export function EmojiPicker({ uid, selected, onPick, onClose }: { uid: string; selected?: string; onPick: (e: string) => void; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null), scroll = useRef<HTMLDivElement>(null);
    const gesture = useRef<{ id: number; y: number; last: number; time: number; speed: number } | null>(null);
    const dismissTimer = useRef<ReturnType<typeof setTimeout>>();
    const [drag, setDrag] = useState<{ y: number; active: boolean } | null>(null);
    const [data, setData] = useState<Catalogue | null>(null), [error, setError] = useState(false);
    const [query, setQuery] = useState(''), [category, setCategory] = useState(0), [limit, setLimit] = useState(160);
    const [viewport, setViewport] = useState({ height: window.visualViewport?.height ?? window.innerHeight, bottom: 0 });
    const [frequent] = useState(() => frequentReactions(uid));
    const load = () => { setError(false); void import('./emoji-data.json').then(m => setData(m.default as Catalogue)).catch(() => setError(true)); };
    useEffect(load, []);
    useEffect(() => {
        const vv = window.visualViewport;
        const resize = () => setViewport({ height: vv?.height ?? window.innerHeight, bottom: vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0 });
        resize(); vv?.addEventListener('resize', resize); vv?.addEventListener('scroll', resize); window.addEventListener('resize', resize);
        return () => { vv?.removeEventListener('resize', resize); vv?.removeEventListener('scroll', resize); window.removeEventListener('resize', resize); };
    }, []);
    const closeRef = useRef(onClose); closeRef.current = onClose;
    const close = () => { if (window.history.state?.ddEmoji) window.history.back(); else closeRef.current(); };
    useEffect(() => {
        dialog.current?.showModal();
        const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
        // Android's browser refresh gesture belongs to the root viewport, not the dialog.
        // Suppress it only while this modal owns the screen, then restore the exact styles.
        const roots = [document.documentElement, document.body];
        const overscroll = roots.map(el => [el.style.getPropertyValue('overscroll-behavior-y'), el.style.getPropertyPriority('overscroll-behavior-y')]);
        roots.forEach(el => el.style.setProperty('overscroll-behavior-y', 'none'));
        window.history.pushState({ ...(window.history.state ?? {}), ddEmoji: 1 }, '');
        const pop = () => closeRef.current(); window.addEventListener('popstate', pop);
        return () => {
            window.removeEventListener('popstate', pop); document.body.style.overflow = previous;
            roots.forEach((el, i) => { const [value, priority] = overscroll[i]; if (value) el.style.setProperty('overscroll-behavior-y', value, priority); else el.style.removeProperty('overscroll-behavior-y'); });
            clearTimeout(dismissTimer.current);
        };
    }, []);
    const results = useMemo(() => { if (!data) return []; const q = query.trim().toLowerCase(); return q ? data.flatMap(([group, rows]) => rows.filter(([e,n]) => e === q || q.split(/\s+/).every(word => `${n} ${group}`.toLowerCase().includes(word)))) : data[category][1]; }, [data, category, query]);
    const names = useMemo(() => new Map(data?.flatMap(([, rows]) => rows) ?? []), [data]);
    const choose = (e: string) => { onPick(e); close(); };
    const button = (e: string, name?: string) => <button key={e} type="button" className={selected === e ? 'is-chosen' : ''} aria-label={name || names.get(e) || e} title={name || names.get(e) || e} aria-pressed={selected === e} onClick={() => choose(e)}>{e}</button>;
    const dragEnd = (e: React.PointerEvent<HTMLElement>, cancel = false) => {
        const g = gesture.current; if (!g || g.id !== e.pointerId) return;
        gesture.current = null;
        const y = Math.max(0, e.clientY - g.y);
        const quick = performance.now() - g.time < 100 && g.speed > .65 && y > 24;
        if (!cancel && (y >= 72 || quick)) {
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            setDrag({ y: (dialog.current?.offsetHeight ?? 610) + 24, active: false });
            dismissTimer.current = setTimeout(close, reduce ? 0 : 180);
        } else setDrag({ y: 0, active: false });
    };
    const resetScroll = () => { setLimit(160); scroll.current?.scrollTo({ top: 0 }); };
    return <dialog ref={dialog} className="dd-emoji-picker" style={{ height: Math.min(610, viewport.height * .78), maxHeight: Math.max(180, viewport.height - 16), bottom: viewport.bottom, ...(drag ? { animation: 'none', transform: `translateY(${drag.y}px)`, transition: drag.active ? 'none' : undefined } : {}) }} aria-labelledby="emoji-picker-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(); } }}>
        <div className="dd-emoji-drag" onPointerDown={e => {
            if (!e.isPrimary || e.button !== 0 || (e.target as Element).closest('button')) return;
            gesture.current = { id: e.pointerId, y: e.clientY, last: e.clientY, time: performance.now(), speed: 0 };
            e.currentTarget.setPointerCapture(e.pointerId); setDrag({ y: 0, active: true });
        }} onPointerMove={e => {
            const g = gesture.current; if (!g || g.id !== e.pointerId) return;
            const now = performance.now(); g.speed = (e.clientY - g.last) / Math.max(1, now - g.time); g.last = e.clientY; g.time = now;
            setDrag({ y: Math.max(0, e.clientY - g.y), active: true });
        }} onPointerUp={e => dragEnd(e)} onPointerCancel={e => dragEnd(e, true)} onLostPointerCapture={e => { if (gesture.current?.id === e.pointerId) { gesture.current = null; setDrag({ y: 0, active: false }); } }}>
            <div className="dd-emoji-grip" aria-hidden="true" />
            <header className="dd-emoji-title"><h2 id="emoji-picker-title">React to message</h2><button type="button" onClick={close} autoFocus aria-label="Close emoji picker"><XIcon size={20} /></button></header>
        </div>
        <label className="dd-emoji-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search emoji" aria-label="Search emoji" value={query} onChange={e => { setQuery(e.target.value); resetScroll(); }} /></label>
        <div ref={scroll} className="dd-emoji-scroll" onScroll={e => { const el = e.currentTarget; if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) setLimit(n => Math.min(n + 160, results.length)); }}>
            {!query && category === 0 && <>
                <section><h3>Default reactions</h3><div className="dd-emoji-grid">{DEFAULT_REACTIONS.map(e => button(e))}</div></section>
                <section><h3>Frequently used</h3>{frequent.length ? <div className="dd-emoji-grid">{frequent.map(e => button(e))}</div> : <p className="dd-emoji-hint">Your reactions will appear here. Saved only for your account on this device.</p>}</section>
            </>}
            {!data ? <p className="dd-emoji-hint" role="status">{error ? <>Could not load emoji. <button type="button" onClick={load}>Retry</button></> : 'Opening emoji...'}</p> : <section><h3>{query ? `Search results (${results.length})` : data[category][0]}</h3><div className="dd-emoji-grid">{results.slice(0,limit).map(([e,n]) => button(e,n))}</div>{!results.length && <p className="dd-emoji-hint">No matching emoji. Try a name like heart, smile or cat.</p>}{limit < results.length && <button type="button" className="dd-emoji-more" onClick={() => setLimit(n => n + 160)}>Show more emoji</button>}</section>}
        </div>
        <nav className="dd-emoji-categories" aria-label="Emoji categories">{(data ?? ['Smileys & People','Animals','Food','Activity','Travel','Objects','Symbols','Flags'].map(g => [g,[]] as [string, [string,string][]])).map(([g], i) => <button key={g} type="button" aria-label={g} title={g} aria-pressed={!query && category === i} onClick={() => { setCategory(i); setQuery(''); resetScroll(); }}>{ICONS[i]}</button>)}</nav>
    </dialog>;
}
