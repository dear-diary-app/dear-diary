import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from './icons';
import { useChatImage } from './chatImages';

export const ImageIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 9" /></svg>;

export function Thumb({ path, index, total, sending, onOpen }: { path: string; index: number; total: number; sending: boolean; onOpen: (i: number) => void }) {
    const { url, failed, retry } = useChatImage(path);
    return <div className={`dd-chat-thumb${url ? '' : ' is-loading'}`} onClick={() => { if (url) onOpen(index); else if (failed) retry(); }}>
        {url && <img src={url} alt={`Photo ${index + 1} of ${total}`} draggable={false} onContextMenu={e => e.preventDefault()} />}
        {!url && failed && <span className="dd-chat-thumb-note">Tap to retry</span>}
        {sending && <span className="dd-chat-thumb-spin" role="status" aria-label="Sending" />}
    </div>;
}

function Slide({ path, n, total }: { path: string; n: number; total: number }) {
    const { url, failed, retry } = useChatImage(path);
    return <div className="dd-viewer-slide">{url
        ? <img src={url} alt={`Photo ${n} of ${total}`} draggable={false} onContextMenu={e => e.preventDefault()} />
        : <span className="dd-viewer-note" onClick={failed ? retry : undefined}>{failed ? 'Could not load. Tap to retry' : 'Loading...'}</span>}</div>;
}

export function Viewer({ paths, start, onClose }: { paths: string[]; start: number; onClose: () => void }) {
    const track = useRef<HTMLDivElement>(null);
    const [at, setAt] = useState(start);
    const close = () => { if (window.history.state?.ddv) window.history.back(); else onClose(); };
    const closeRef = useRef(close);
    closeRef.current = close;
    useEffect(() => { const el = track.current; if (el) el.scrollLeft = start * el.clientWidth; }, [start]);
    useEffect(() => {
        // Phone Back closes the viewer instead of leaving the chat.
        window.history.pushState({ ...(window.history.state ?? {}), ddv: 1 }, '');
        const pop = () => onClose();
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
        window.addEventListener('popstate', pop); window.addEventListener('keydown', key);
        return () => { window.removeEventListener('popstate', pop); window.removeEventListener('keydown', key); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div className="dd-viewer" role="dialog" aria-modal="true" aria-label="Photo viewer">
        <div className="dd-viewer-top"><button type="button" onClick={close} aria-label="Back"><ArrowLeft size={22} /></button>{paths.length > 1 && <span aria-live="polite">{at + 1} / {paths.length}</span>}</div>
        <div className="dd-viewer-track" ref={track} onScroll={e => { const el = e.currentTarget; setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}
            onClick={e => { if ((e.target as HTMLElement).tagName !== 'IMG') close(); }}>
            {paths.map((p, i) => <Slide key={p} path={p} n={i + 1} total={paths.length} />)}
        </div>
    </div>;
}
