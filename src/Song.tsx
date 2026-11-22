import React, { useEffect, useRef, useState } from 'react';
import { Check, Search, XIcon } from './icons';

// A song is only a pointer to Apple's free 30-second preview. No audio is stored by the diary.
export interface Song { id: number; name: string; artist: string; art: string; url: string }
const trusted = (u: unknown): u is string => typeof u === 'string' && /^https:\/\/[a-z0-9.-]+\.(mzstatic|apple)\.com\//i.test(u) && u.length < 400;
export function cleanSong(v: unknown): Song | null {
    const s = v as Partial<Song> | null;
    if (!s || typeof s !== 'object' || !Number.isFinite(s.id) || typeof s.name !== 'string' || typeof s.artist !== 'string' || !trusted(s.art) || !trusted(s.url)) return null;
    return { id: Number(s.id), name: s.name.slice(0, 120), artist: s.artist.slice(0, 120), art: s.art, url: s.url };
}

const Play = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>;
const Pause = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1.2" /><rect x="13.5" y="5" width="4.5" height="14" rx="1.2" /></svg>;
const Note = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 17.5V6.3a1 1 0 0 1 .76-.97l9-2.25A1 1 0 0 1 20 4.05V15.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="6.5" cy="17.5" r="3" /><circle cx="17.5" cy="15.5" r="3" /></svg>;

// One song at a time, and it stops when the app is hidden.
let active: { audio: HTMLAudioElement; stop: () => void } | null = null;
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) active?.stop(); });
function usePreview(url: string) {
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [failed, setFailed] = useState(false);
    const audio = useRef<HTMLAudioElement | null>(null);
    const stop = () => { audio.current?.pause(); setPlaying(false); };
    useEffect(() => () => { audio.current?.pause(); if (active?.audio === audio.current) active = null; }, []);
    useEffect(() => { audio.current?.pause(); audio.current = null; setPlaying(false); setProgress(0); setFailed(false); }, [url]);
    const toggle = () => {
        if (!audio.current) {
            const a = new Audio(url); a.preload = 'none';
            a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
            a.onended = () => { setPlaying(false); setProgress(0); };
            a.onerror = () => { setPlaying(false); setFailed(true); };
            audio.current = a;
        }
        const a = audio.current;
        if (!a.paused) { stop(); return; }
        if (active && active.audio !== a) active.stop();
        active = { audio: a, stop };
        setFailed(false);
        a.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); setFailed(true); });
    };
    return { playing, progress, failed, toggle };
}

export function SongPill({ song, onRemove }: { song: Song; onRemove?: () => void }) {
    const p = usePreview(song.url);
    return <div className={`dd-song${p.playing ? ' is-playing' : ''}`}>
        <button type="button" className="dd-song-main" onClick={p.toggle} aria-label={`${p.playing ? 'Pause' : 'Play'} ${song.name} by ${song.artist}`}>
            <img src={song.art} alt="" width="48" height="48" />
            <span className="dd-song-text"><strong>{song.name}</strong><small><Note /> {song.artist}</small></span>
            <span className="dd-song-play">{p.playing ? <Pause /> : <Play />}</span>
        </button>
        {onRemove && <button type="button" className="dd-song-remove" onClick={onRemove} aria-label="Remove song"><XIcon size={16} /></button>}
        <span className="dd-song-bar" aria-hidden="true"><i style={{ width: `${p.progress * 100}%` }} /></span>
        {p.failed && <small className="dd-song-error" role="status">Could not play this preview. Check your connection.</small>}
    </div>;
}

interface Hit { trackId: number; trackName: string; artistName: string; artworkUrl100: string; previewUrl?: string }
function Result({ hit, chosen, onPick }: { hit: Hit; chosen: boolean; onPick: () => void }) {
    const p = usePreview(hit.previewUrl ?? '');
    return <li className="dd-song-hit">
        <button type="button" className="dd-song-hit-play" onClick={p.toggle} aria-label={`${p.playing ? 'Pause' : 'Listen to'} ${hit.trackName}`}><img src={hit.artworkUrl100} alt="" width="44" height="44" loading="lazy" /><span>{p.playing ? <Pause /> : <Play />}</span></button>
        <span className="dd-song-text"><strong>{hit.trackName}</strong><small>{hit.artistName}</small></span>
        <button type="button" className="dd-song-use" onClick={onPick}>{chosen ? <><Check size={14} /> Added</> : 'Use'}</button>
    </li>;
}

export function SongPicker({ song, onChange }: { song?: Song | null; onChange: (s: Song | null) => void }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [hits, setHits] = useState<Hit[]>([]);
    const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
    useEffect(() => {
        const term = q.trim();
        if (term.length < 2) { setHits([]); setState('idle'); return; }
        const ctl = new AbortController();
        setState('loading');
        const t = window.setTimeout(() => {
            fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=15&country=IN`, { signal: ctl.signal })
                .then(r => { if (!r.ok) throw new Error('search'); return r.json(); })
                .then((d: { results?: Hit[] }) => { setHits((d.results ?? []).filter(h => h.previewUrl && h.trackId && trusted(h.previewUrl))); setState('idle'); })
                .catch(e => { if (e?.name !== 'AbortError') setState('error'); });
        }, 450);
        return () => { window.clearTimeout(t); ctl.abort(); };
    }, [q]);
    const pick = (h: Hit) => {
        const s = cleanSong({ id: h.trackId, name: h.trackName, artist: h.artistName, art: h.artworkUrl100.replace('100x100', '200x200'), url: h.previewUrl });
        if (s) { onChange(s); setOpen(false); setQ(''); }
    };
    return <section className="dd-songbox" aria-label="Song for this page">
        {song ? <SongPill song={song} onRemove={() => onChange(null)} />
            : <button type="button" className="dd-song-add" aria-expanded={open} onClick={() => setOpen(!open)}><Note /> {open ? 'Close' : 'Add a song'}</button>}
        {song && <button type="button" className="dd-song-change" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close' : 'Change song'}</button>}
        {open && <div className="dd-song-panel">
            <label className="dd-song-search"><Search size={16} /><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Song or artist, English or Hindi" aria-label="Search for a song" autoFocus /></label>
            {state === 'loading' && <p className="dd-song-note" role="status">Searching...</p>}
            {state === 'error' && <p className="dd-song-note" role="status">Search did not work. Check your connection and try again.</p>}
            {state === 'idle' && q.trim().length >= 2 && hits.length === 0 && <p className="dd-song-note">No songs found. Try the artist name too.</p>}
            {hits.length > 0 && <ul className="dd-song-list">{hits.map(h => <Result key={h.trackId} hit={h} chosen={song?.id === h.trackId} onPick={() => pick(h)} />)}</ul>}
            <p className="dd-song-note">Readers hear a 30-second preview of the song. Search runs through Apple Music.</p>
        </div>}
    </section>;
}
