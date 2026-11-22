import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import pack from './sticker-pack.json';
import { useChat, type ChatMsg } from './ChatStore';
import { Avatar } from './ui';
import type { Person } from './model';
import { XIcon } from './icons';

const REACTS = ['❤️', '😂', '😭', '🥺', '✨', '🫶'];
const art = (id: string) => `${import.meta.env.BASE_URL}stickers/${id}.webp`;
const stickerName = (id: string) => pack.find(p => p.id === id)?.name ?? 'Sticker';
const known = (id: string | null) => !!id && pack.some(p => p.id === id);
const IST = 'Asia/Kolkata';
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: IST });
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: IST });
const dayFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST });
function dayLabel(iso: string) {
    const k = dayKey.format(new Date(iso));
    if (k === dayKey.format(new Date())) return 'Today';
    if (k === dayKey.format(new Date(Date.now() - 864e5))) return 'Yesterday';
    return dayFmt.format(new Date(iso));
}
const Reply = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v3" /></svg>;
const Send = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.3 10l12 2-12 2Z" /></svg>;
const Smile = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M8 14.2a4.5 4.5 0 0 0 8 0" /><path d="M9 9.5h.01M15 9.5h.01" strokeWidth="2.6" /></svg>;

function snippet(m: ChatMsg) { return m.sticker ? `Sticker: ${stickerName(m.sticker)}` : m.body.length > 90 ? m.body.slice(0, 90) + '…' : m.body; }

function Row({ m, mine, partner, original, selected, onSelect, onReply, onJump, flash, lastMine }: {
    m: ChatMsg; mine: boolean; partner: Person; original?: ChatMsg; selected: boolean; onSelect: () => void; onReply: () => void; onJump: (id: string) => void; flash: boolean; lastMine: boolean;
}) {
    const chat = useChat();
    const [dx, setDx] = useState(0);
    const [rest, setRest] = useState(true);
    const dxRef = useRef(0);
    const armed = useRef(false);
    const drag = useRef<{ x: number; y: number; id: number; on: boolean; moved: boolean } | null>(null);
    const REPLY_AT = 56, MAX = 84;
    const setX = (v: number) => { dxRef.current = v; setDx(v); };
    const down = (e: React.PointerEvent) => { if (e.button > 0) return; drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false, moved: false }; armed.current = false; };
    const move = (e: React.PointerEvent) => {
        const d = drag.current; if (!d || d.id !== e.pointerId) return;
        const ax = e.clientX - d.x, ay = e.clientY - d.y;
        if (!d.on) {
            if (Math.abs(ay) > 10 && Math.abs(ay) > Math.abs(ax)) { drag.current = null; return; }
            if (ax > 8 && ax > Math.abs(ay)) { d.on = true; d.moved = true; setRest(false); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ } }
        }
        if (d.on) {
            // Follows the finger, then stiffens past the reply point like Instagram.
            const raw = Math.max(0, ax - 8);
            const v = raw <= REPLY_AT ? raw : Math.min(MAX, REPLY_AT + (raw - REPLY_AT) * 0.35);
            setX(v);
            if (v >= REPLY_AT && !armed.current) { armed.current = true; try { navigator.vibrate?.(10); } catch { /* ignore */ } }
            else if (v < REPLY_AT - 6) armed.current = false;
        }
    };
    const up = (e: React.PointerEvent) => {
        const d = drag.current; if (!d || d.id !== e.pointerId) return;
        drag.current = null;
        const go = d.on && dxRef.current >= REPLY_AT;
        setRest(true); setX(0);
        if (go) onReply();
        else if (!d.moved) onSelect();
    };
    const cancel = () => { drag.current = null; setRest(true); setX(0); };
    const groups = useMemo(() => {
        const c = new Map<string, number>();
        Object.values(m.reactions).forEach(e => c.set(e, (c.get(e) ?? 0) + 1));
        return [...c.entries()];
    }, [m.reactions]);
    const mineReact = m.reactions[chat.uid];
    const sticker = m.sticker && known(m.sticker);
    return <div className={`dd-chat-row ${mine ? 'is-mine' : 'is-theirs'}${flash ? ' is-flash' : ''}`} data-id={m.id}>
        <span className={`dd-chat-swipe-icon${dx >= REPLY_AT ? ' is-armed' : ''}`} aria-hidden="true" style={{ opacity: Math.min(1, dx / 36), transform: `translateX(${Math.min(dx, REPLY_AT) * 0.35}px) scale(${0.5 + Math.min(1, dx / REPLY_AT) * 0.5})` }}><Reply /></span>
        <div className={`dd-chat-msg${sticker ? ' is-sticker' : ''}${m.state === 'failed' ? ' is-failed' : ''}${m.state === 'sending' ? ' is-sending' : ''}`}
            style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: rest ? 'transform .32s cubic-bezier(.2,1.3,.4,1)' : 'none' }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
            role="button" tabIndex={0} aria-label={`${mine ? 'Your' : `${partner.name}'s`} message: ${snippet(m)}. Press Enter for actions.`}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } else if (e.key === 'r') onReply(); }}>
            {m.reply_to && <button type="button" className="dd-chat-quote" disabled={!original} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); original && onJump(original.id); }}>
                <strong>{original ? (original.sender_id === chat.uid ? 'You' : partner.name) : 'Message'}</strong>
                <span>{original ? snippet(original) : 'Original message is not available'}</span>
            </button>}
            {sticker ? <img className="dd-chat-sticker" src={art(m.sticker!)} alt={stickerName(m.sticker!)} width="128" height="128" draggable={false} />
                : m.sticker ? <span className="dd-chat-text">Sticker</span> : <span className="dd-chat-text">{m.body}</span>}
            <span className="dd-chat-time">{timeFmt.format(new Date(m.created_at))}</span>
        </div>
        {groups.length > 0 && <div className="dd-chat-reacts">{groups.map(([e, n]) => <button key={e} type="button" className={mineReact === e ? 'is-mine' : ''} onClick={() => chat.react(m.id, e)} aria-label={`${e} ${n}. Tap to ${mineReact === e ? 'remove' : 'add'} your reaction`}>{e}{n > 1 ? ` ${n}` : ''}</button>)}</div>}
        {selected && <div className="dd-chat-actions" role="group" aria-label="Message actions">
            <div className="dd-chat-emojis">{REACTS.map(e => <button key={e} type="button" className={mineReact === e ? 'is-mine' : ''} onClick={() => { chat.react(m.id, e); onSelect(); }} aria-label={`React ${e}`}>{e}</button>)}</div>
            <div className="dd-chat-cmds">
                <button type="button" onClick={() => { onReply(); onSelect(); }}><Reply /> Reply</button>
                {!sticker && m.body && <button type="button" onClick={() => { void navigator.clipboard?.writeText(m.body).catch(() => {}); onSelect(); }}>Copy</button>}
                {mine && <button type="button" className="is-danger" onClick={() => { chat.unsend(m.id); }}>Unsend</button>}
            </div>
        </div>}
        {lastMine && mine && <p className="dd-chat-status" role="status">
            {m.state === 'failed' ? <>Not sent. <button type="button" onClick={() => chat.retry(m.id)}>Retry</button> <button type="button" onClick={() => chat.discard(m.id)}>Delete</button></>
                : m.state === 'sending' ? 'Sending...' : m.seen_at ? `Seen ${timeFmt.format(new Date(m.seen_at))}` : 'Sent'}
        </p>}
    </div>;
}

export function ChatView({ partner }: { partner: Person }) {
    const chat = useChat();
    const [text, setText] = useState('');
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [trayOpen, setTrayOpen] = useState(false);
    const [group, setGroup] = useState('All');
    const [flash, setFlash] = useState<string | null>(null);
    const [newBelow, setNewBelow] = useState(false);
    const scroller = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLTextAreaElement>(null);
    const stick = useRef(true);
    const prevLen = useRef(0);
    const { setViewing } = chat;
    useEffect(() => { setViewing(true); return () => setViewing(false); }, [setViewing]);

    // Keep the layout above the phone keyboard and hide the dock while typing.
    const [vh, setVh] = useState<number | null>(null);
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const on = () => setVh(Math.round(vv.height));
        on(); vv.addEventListener('resize', on);
        return () => vv.removeEventListener('resize', on);
    }, []);
    useEffect(() => () => document.documentElement.classList.remove('dd-chat-typing'), []);

    const byId = useMemo(() => new Map(chat.messages.map(m => [m.id, m])), [chat.messages]);
    const lastMineId = useMemo(() => { for (let i = chat.messages.length - 1; i >= 0; i--) if (chat.messages[i].sender_id === chat.uid) return chat.messages[i].id; return null; }, [chat.messages, chat.uid]);
    const toBottom = (smooth = false) => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); };
    useLayoutEffect(() => {
        const grew = chat.messages.length > prevLen.current;
        const last = chat.messages[chat.messages.length - 1];
        if (stick.current || (grew && last?.sender_id === chat.uid)) { toBottom(prevLen.current > 0); setNewBelow(false); }
        else if (grew) setNewBelow(true);
        prevLen.current = chat.messages.length;
    }, [chat.messages, chat.partnerTyping, chat.uid]);
    useLayoutEffect(() => { if (chat.loaded) toBottom(); }, [chat.loaded]);
    useLayoutEffect(() => { if (stick.current) toBottom(); }, [vh, replyTo, trayOpen]);

    const grow = () => { const el = input.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; };
    const submit = () => {
        if (!text.trim()) return;
        chat.send(text, null, replyTo); chat.typing(false);
        setText(''); setReplyTo(null); stick.current = true;
        requestAnimationFrame(() => { grow(); input.current?.focus(); });
    };
    const jump = (id: string) => {
        const el = scroller.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setFlash(id); window.setTimeout(() => setFlash(null), 1400);
    };
    const startReply = (id: string) => { setReplyTo(id); setSelected(null); input.current?.focus(); };
    const original = replyTo ? byId.get(replyTo) : undefined;
    const items: React.ReactNode[] = [];
    let lastDay = '';
    chat.messages.forEach(m => {
        const d = dayKey.format(new Date(m.created_at));
        if (d !== lastDay) { lastDay = d; items.push(<p key={`d${d}`} className="dd-chat-day"><span>{dayLabel(m.created_at)}</span></p>); }
        items.push(<Row key={m.id} m={m} mine={m.sender_id === chat.uid} partner={partner} original={m.reply_to ? byId.get(m.reply_to) : undefined}
            selected={selected === m.id} onSelect={() => setSelected(s => s === m.id ? null : m.id)} onReply={() => startReply(m.id)} onJump={jump} flash={flash === m.id} lastMine={m.id === lastMineId} />);
    });
    const groups = ['All', ...Array.from(new Set(pack.map(p => p.group)))];

    return <main className="dd-chat" style={vh ? { height: vh } : undefined} aria-label={`Chat with ${partner.name}`}>
        <header className="dd-chat-head">
            <Avatar person={partner} size="sm" />
            <div><h1>{partner.name}</h1><p aria-live="polite">{chat.partnerTyping ? <span className="dd-chat-typing-label">typing<i>.</i><i>.</i><i>.</i></span> : chat.live ? 'Private chat' : 'Connecting...'}</p></div>
        </header>
        <div className="dd-chat-list" ref={scroller} onScroll={e => { const el = e.currentTarget; const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80; stick.current = near; if (near) setNewBelow(false); }} onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
            {chat.hasMore && <button type="button" className="dd-chat-older" onClick={() => { const el = scroller.current; const h = el?.scrollHeight ?? 0; void chat.loadOlder().then(() => requestAnimationFrame(() => { if (el) el.scrollTop += el.scrollHeight - h; })); }}>Load earlier messages</button>}
            {!chat.loaded && !chat.loadError && <p className="dd-chat-empty" role="status">Opening your chat...</p>}
            {chat.loadError && <p className="dd-chat-empty" role="alert">Could not load the chat. <button type="button" className="dd-chat-link" onClick={chat.reload}>Try again</button></p>}
            {chat.loaded && chat.messages.length === 0 && <div className="dd-chat-empty"><img src={art('rose-heart')} alt="" width="84" height="84" /><p>Say hi to {partner.name}. Only the two of you can see this chat.</p></div>}
            {items}
            {chat.partnerTyping && <div className="dd-chat-row is-theirs"><div className="dd-chat-msg dd-chat-typing-bubble" aria-hidden="true"><i /><i /><i /></div></div>}
        </div>
        {newBelow && <button type="button" className="dd-chat-new" onClick={() => { toBottom(true); setNewBelow(false); stick.current = true; }}>New messages ↓</button>}
        <div className="dd-chat-compose">
            {replyTo && <div className="dd-chat-replybar"><Reply /><div><strong>Replying to {original ? (original.sender_id === chat.uid ? 'yourself' : partner.name) : 'message'}</strong><span>{original ? snippet(original) : 'Original message is not available'}</span></div>
                <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><XIcon size={16} /></button></div>}
            {trayOpen && <div className="dd-chat-tray">
                <div className="dd-chat-tray-tabs" role="group" aria-label="Sticker themes">{groups.map(g => <button type="button" key={g} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>)}</div>
                <div className="dd-chat-tray-grid">{pack.filter(s => group === 'All' || s.group === group).map(s => <button key={s.id} type="button" aria-label={`Send ${s.name}`} onClick={() => { chat.send('', s.id, replyTo); setReplyTo(null); setTrayOpen(false); stick.current = true; }}><img src={art(s.id)} alt="" width="64" height="64" loading="lazy" /></button>)}</div>
            </div>}
            <div className="dd-chat-bar">
                <button type="button" className={`dd-chat-iconbtn${trayOpen ? ' is-on' : ''}`} aria-label={trayOpen ? 'Close stickers' : 'Open stickers'} aria-expanded={trayOpen} onClick={() => { setTrayOpen(o => !o); }}><Smile /></button>
                <textarea ref={input} rows={1} value={text} maxLength={2000} placeholder="Message" aria-label={`Message ${partner.name}`} enterKeyHint="send"
                    onChange={e => { setText(e.target.value); grow(); chat.typing(!!e.target.value.trim()); }}
                    onFocus={() => { document.documentElement.classList.add('dd-chat-typing'); setTrayOpen(false); }}
                    onBlur={() => { document.documentElement.classList.remove('dd-chat-typing'); chat.typing(false); }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); submit(); } }} />
                <button type="button" className="dd-chat-send" aria-label="Send message" disabled={!text.trim()} onPointerDown={e => e.preventDefault()} onClick={submit}><Send /></button>
            </div>
        </div>
    </main>;
}
