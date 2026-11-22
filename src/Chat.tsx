import { useLocation, useNavigate } from 'react-router-dom';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import pack from './sticker-pack.json';
import { useChat, type ChatMsg } from './ChatStore';
import { Avatar } from './ui';
import type { Person } from './model';
import { ArrowLeft, XIcon } from './icons';
import { MAX_PHOTOS, prepareImage } from './chatImages';
import { ImageIcon, Thumb, Viewer } from './ChatPhotos';
import { EmojiPicker } from './EmojiPicker';
import { quickReactions } from './reactions';

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
const Pencil = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
const Send = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.3 10l12 2-12 2Z" /></svg>;
const Smile = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M8 14.2a4.5 4.5 0 0 0 8 0" /><path d="M9 9.5h.01M15 9.5h.01" strokeWidth="2.6" /></svg>;

const photoWord = (n: number) => n > 1 ? `${n} photos` : 'Photo';
function snippet(m: ChatMsg) { if (m.images.length) return m.body ? `${photoWord(m.images.length)}: ${m.body.length > 70 ? m.body.slice(0, 70) + '…' : m.body}` : photoWord(m.images.length); return m.sticker ? `Sticker: ${stickerName(m.sticker)}` : m.body.length > 90 ? m.body.slice(0, 90) + '…' : m.body; }

function Row({ m, mine, partner, original, selected, onSelect, onTap, onOpen, onPhoto, onReply, onJump, onMore, flash, lastMine }: {
    m: ChatMsg; mine: boolean; partner: Person; original?: ChatMsg; selected: boolean; onSelect: () => void; onTap: () => void; onPhoto: (paths: string[], i: number) => void; onOpen: () => void; onReply: () => void; onJump: (id: string) => void; onMore: () => void; flash: boolean; lastMine: boolean;
}) {
    const chat = useChat();
    const [dx, setDx] = useState(0);
    const [rest, setRest] = useState(true);
    const dxRef = useRef(0);
    const armed = useRef(false);
    const drag = useRef<{ x: number; y: number; id: number; on: boolean; moved: boolean; long: boolean } | null>(null);
    const hold = useRef<number>();
    const noClick = useRef(0);
    const clearHold = () => { window.clearTimeout(hold.current); };
    const REPLY_AT = 56, MAX = 84;
    // Friend's messages swipe right, your own swipe left, like Instagram.
    const dir = mine ? -1 : 1;
    const setX = (v: number) => { dxRef.current = v; setDx(v); };
    const down = (e: React.PointerEvent) => { if (e.button > 0) return; drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false, moved: false, long: false }; armed.current = false;
        clearHold();
        // Press and hold opens the reactions and actions, like Instagram.
        hold.current = window.setTimeout(() => { const d = drag.current; if (!d || d.on) return; d.long = true; noClick.current = Date.now(); try { navigator.vibrate?.(12); } catch { /* ignore */ } onOpen(); }, 450); };
    const move = (e: React.PointerEvent) => {
        const d = drag.current; if (!d || d.id !== e.pointerId) return;
        const ax = (e.clientX - d.x) * dir, ay = e.clientY - d.y;
        if (Math.abs(e.clientX - d.x) > 9 || Math.abs(ay) > 9) clearHold();
        if (d.long) return;
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
        drag.current = null; clearHold();
        if (d.long) return;
        const go = d.on && dxRef.current >= REPLY_AT;
        if (d.on) noClick.current = Date.now();
        setRest(true); setX(0);
        if (go) onReply();
        else if (!d.moved) onTap();
    };
    const cancel = () => { clearHold(); if (drag.current?.long) { drag.current = null; return; } drag.current = null; setRest(true); setX(0); };
    const rowEl = useRef<HTMLDivElement>(null);
    const [below, setBelow] = useState(false);
    // Keep the reaction bar right above the held message; if there is no room at the top of the list, scroll a little, else show it below.
    useLayoutEffect(() => {
        if (!selected) { setBelow(false); return; }
        const row = rowEl.current, sc = row?.closest('.dd-chat-list') as HTMLElement | null;
        if (!row || !sc) return;
        const NEED = 80;
        let space = row.getBoundingClientRect().top - sc.getBoundingClientRect().top;
        if (space < NEED) { sc.scrollTop -= NEED - space; space = row.getBoundingClientRect().top - sc.getBoundingClientRect().top; }
        setBelow(space < NEED - 4);
    }, [selected]);
    const groups = useMemo(() => {
        const c = new Map<string, number>();
        Object.values(m.reactions).forEach(e => c.set(e, (c.get(e) ?? 0) + 1));
        return [...c.entries()];
    }, [m.reactions]);
    const mineReact = m.reactions[chat.uid];
    const quick = useMemo(() => quickReactions(chat.uid, mineReact), [chat.uid, mineReact, selected]);
    useLayoutEffect(() => {
        if (!selected) return;
        const sc = rowEl.current?.querySelector('.dd-reaction-scroll');
        const chosen = sc?.querySelector('[aria-pressed=true]');
        if (sc && chosen) sc.scrollLeft += chosen.getBoundingClientRect().left - sc.getBoundingClientRect().left - sc.clientWidth / 2 + chosen.clientWidth / 2;
    }, [selected, mineReact]);
    const sticker = m.sticker && known(m.sticker);
    return <div ref={rowEl} className={`dd-chat-row ${mine ? 'is-mine' : 'is-theirs'}${flash ? ' is-flash' : ''}${selected ? ' is-held' : ''}`} data-id={m.id}>
        <span className={`dd-chat-swipe-icon${mine ? ' is-right' : ''}${dx >= REPLY_AT ? ' is-armed' : ''}`} aria-hidden="true" style={{ opacity: Math.min(1, dx / 36), transform: `translateX(${Math.min(dx, REPLY_AT) * 0.35 * dir}px) scale(${0.5 + Math.min(1, dx / REPLY_AT) * 0.5})` }}><Reply /></span>
        <div className={`dd-chat-msg${sticker ? ' is-sticker' : ''}${m.images.length ? ' has-photos' : ''}${m.state === 'failed' ? ' is-failed' : ''}${m.state === 'sending' ? ' is-sending' : ''}`}
            style={{ transform: dx ? `translateX(${dx * dir}px)` : undefined, transition: rest ? 'transform .32s cubic-bezier(.2,1.3,.4,1)' : 'none' }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onContextMenu={e => e.preventDefault()}
            role="button" tabIndex={0} aria-label={`${mine ? 'Your' : `${partner.name}'s`} message: ${snippet(m)}. Press Enter for actions.`}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } else if (e.key === 'r') onReply(); }}>
            {m.reply_to && <button type="button" className="dd-chat-quote" disabled={!original} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); original && onJump(original.id); }}>
                <strong>{original ? (original.sender_id === chat.uid ? 'You' : partner.name) : 'Message'}</strong>
                <span>{original ? snippet(original) : 'Original message is not available'}</span>
            </button>}
            {m.images.length > 0 && <div className={`dd-chat-photos n${m.images.length}`}>{m.images.map((p, i) => <Thumb key={p} path={p} index={i} total={m.images.length} sending={m.state === 'sending'} onOpen={k => { if (Date.now() - noClick.current > 600) onPhoto(m.images, k); }} />)}</div>}
            {sticker ? <img className="dd-chat-sticker" src={art(m.sticker!)} alt={stickerName(m.sticker!)} width="128" height="128" draggable={false} />
                : m.sticker ? <span className="dd-chat-text">Sticker</span> : m.body ? <span className="dd-chat-text">{m.body}</span> : null}
            <span className="dd-chat-time">{m.edited_at && !sticker ? 'edited · ' : ''}{timeFmt.format(new Date(m.created_at))}</span>
        </div>
        {groups.length > 0 && <div className="dd-chat-reacts">{groups.map(([e, n]) => <button key={e} type="button" className={mineReact === e ? 'is-mine' : ''} onClick={() => chat.react(m.id, e)} aria-label={`${e} ${n}. Tap to ${mineReact === e ? 'remove' : 'add'} your reaction`}>{e}{n > 1 ? ` ${n}` : ''}</button>)}</div>}
        {selected && <div className={`dd-chat-actions${below ? ' is-below' : ''}`} role="group" aria-label="Message actions">
            <div className="dd-chat-emojis">
                <div className="dd-reaction-scroll" aria-label="Quick reactions">{quick.map(e => <button key={e} type="button" className={mineReact === e ? 'is-mine' : ''} aria-pressed={mineReact === e} onClick={() => { chat.react(m.id, e); onSelect(); }} aria-label={`React ${e}`}>{e}</button>)}</div>
                <button type="button" className="dd-reaction-plus" aria-label="More reactions" onClick={onMore}>+</button>
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
    const navigate = useNavigate();
    // Go back to wherever the chat was opened from; if it was opened directly, go home.
    const leave = () => { if ((window.history.state?.idx ?? 0) > 0) navigate(-1); else navigate('/', { replace: true }); };
    const [text, setText] = useState('');
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [emojiFor, setEmojiFor] = useState<string | null>(null);
    const [viewer, setViewer] = useState<{ paths: string[]; i: number } | null>(null);
    const [staged, setStaged] = useState<{ id: string; blob: Blob; url: string }[]>([]);
    const [note, setNote] = useState('');
    const fileInput = useRef<HTMLInputElement>(null);
    const noteTimer = useRef<number>();
    const say = (t: string) => { setNote(t); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(''), 3200); };
    const clearStaged = () => setStaged(prev => { prev.forEach(x => URL.revokeObjectURL(x.url)); return []; });
    useEffect(() => () => window.clearTimeout(noteTimer.current), []);
    const pick = async (list: FileList | null) => {
        const files = Array.from(list ?? []);
        if (fileInput.current) fileInput.current.value = '';
        if (!files.length) return;
        if (files.some(f => f.type.startsWith('video/'))) { say('Videos can not be sent. Please choose photos only.'); return; }
        if (files.some(f => !f.type.startsWith('image/') || /svg/i.test(f.type))) { say('Only photos can be sent.'); return; }
        if (staged.length + files.length > MAX_PHOTOS) { say(`You can send up to ${MAX_PHOTOS} photos at a time.`); return; }
        try {
            const blobs = await Promise.all(files.map(f => prepareImage(f)));
            setEditing(null); setTrayOpen(false);
            setStaged(prev => [...prev, ...blobs.map(b => ({ id: crypto.randomUUID(), blob: b, url: URL.createObjectURL(b) }))].slice(0, MAX_PHOTOS));
            stick.current = true;
        } catch (e) { say((e as Error).message === 'big' ? 'That photo is too large. Please choose a smaller one.' : 'Could not read that photo. Try a different one.'); }
    };
    useEffect(() => { setMenuOpen(false); }, [selected]);
    const [trayOpen, setTrayOpen] = useState(false);
    const [group, setGroup] = useState('All');
    const [flash, setFlash] = useState<string | null>(null);
    const [belowIds, setBelowIds] = useState<string[]>([]);
    const lastTs = useRef('');
    const setNewBelow = (v: boolean) => { if (!v) setBelowIds([]); };
    const scroller = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLTextAreaElement>(null);
    const route = useLocation();
    useEffect(() => {
        const focus = () => input.current?.focus();
        if (new URLSearchParams(route.search).get('compose') === '1') focus();
        window.addEventListener('dd-chat-compose', focus);
        return () => window.removeEventListener('dd-chat-compose', focus);
    }, [route.key, route.search]);
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
    // An unsent message leaves nothing behind: close anything that was pointing at it, without a word.
    const newBelow = belowIds.some(id => byId.has(id));
    useEffect(() => {
        if (!chat.loaded) return;
        if (selected && !byId.has(selected)) setSelected(null);
        if (replyTo && !byId.has(replyTo)) setReplyTo(null);
        if (editing && !byId.has(editing)) { setEditing(null); setText(''); }
        if (emojiFor && !byId.has(emojiFor)) { setEmojiFor(null); if (window.history.state?.ddEmoji) window.history.back(); }
        if (viewer && !chat.messages.some(m => m.images.length && m.images[0] === viewer.paths[0])) { if (window.history.state?.ddv) window.history.back(); else setViewer(null); }
    }, [byId, chat.loaded, chat.messages, selected, replyTo, editing, viewer, emojiFor]);
    const lastMineId = useMemo(() => { for (let i = chat.messages.length - 1; i >= 0; i--) if (chat.messages[i].sender_id === chat.uid) return chat.messages[i].id; return null; }, [chat.messages, chat.uid]);
    const toBottom = (smooth = false) => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); };
    useLayoutEffect(() => {
        const grew = chat.messages.length > prevLen.current;
        const last = chat.messages[chat.messages.length - 1];
        const fresh = chat.messages.filter(m => m.created_at > lastTs.current && m.sender_id !== chat.uid).map(m => m.id);
        if (stick.current || (grew && last?.sender_id === chat.uid)) { toBottom(prevLen.current > 0); setNewBelow(false); }
        else if (fresh.length) setBelowIds(prev => [...prev, ...fresh]);
        prevLen.current = chat.messages.length;
        if (last && last.created_at > lastTs.current) lastTs.current = last.created_at;
    }, [chat.messages, chat.partnerTyping, chat.uid]);
    useLayoutEffect(() => { if (chat.loaded) toBottom(); }, [chat.loaded]);
    useLayoutEffect(() => { if (stick.current) toBottom(); }, [vh, replyTo, trayOpen]);

    const grow = () => { const el = input.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden'; };
    const submit = () => {
        if (!text.trim() && !staged.length) return;
        setNote('');
        if (staged.length && !editing) {
            chat.sendImages(staged.map(x => x.blob), text, replyTo); chat.typing(false);
            clearStaged(); setText(''); setReplyTo(null); stick.current = true;
            requestAnimationFrame(() => { grow(); input.current?.focus(); });
            return;
        }
        if (editing) { chat.edit(editing, text); setEditing(null); setText(''); chat.typing(false); requestAnimationFrame(grow); return; }
        chat.send(text, null, replyTo); chat.typing(false);
        setText(''); setReplyTo(null); stick.current = true;
        requestAnimationFrame(() => { grow(); input.current?.focus(); });
    };
    const jump = (id: string) => {
        const el = scroller.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setFlash(id); window.setTimeout(() => setFlash(null), 1400);
    };
    const startReply = (id: string) => { setEditing(null); setReplyTo(id); setSelected(null); input.current?.focus(); };
    const selMsg = selected ? byId.get(selected) : undefined;
    const isText = !!selMsg && !selMsg.sticker && !!selMsg.body;
    const canEdit = isText && selMsg!.sender_id === chat.uid && !selMsg!.state;
    const canUnsend = !!selMsg && selMsg.sender_id === chat.uid;
    const startEdit = () => { if (!selMsg) return; clearStaged(); setReplyTo(null); setEditing(selMsg.id); setText(selMsg.body); setSelected(null); requestAnimationFrame(() => { grow(); const el = input.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }); };
    const stopEdit = () => { setEditing(null); setText(''); requestAnimationFrame(grow); };
    const copySel = () => { if (selMsg) void navigator.clipboard?.writeText(selMsg.body).catch(() => {}); setSelected(null); };
    const original = replyTo ? byId.get(replyTo) : undefined;
    const items: React.ReactNode[] = [];
    let lastDay = '';
    chat.messages.forEach(m => {
        const d = dayKey.format(new Date(m.created_at));
        if (d !== lastDay) { lastDay = d; items.push(<p key={`d${d}`} className="dd-chat-day"><span>{dayLabel(m.created_at)}</span></p>); }
        items.push(<Row key={m.id} m={m} mine={m.sender_id === chat.uid} partner={partner} original={m.reply_to ? byId.get(m.reply_to) : undefined}
            selected={selected === m.id} onSelect={() => setSelected(s => s === m.id ? null : m.id)} onTap={() => setSelected(null)} onOpen={() => setSelected(m.id)} onPhoto={(paths, i) => setViewer({ paths, i })} onReply={() => startReply(m.id)} onMore={() => { input.current?.blur(); setEmojiFor(m.id); }} onJump={jump} flash={flash === m.id} lastMine={m.id === lastMineId} />);
    });
    const groups = ['All', ...Array.from(new Set(pack.map(p => p.group)))];

    return <main className="dd-chat" style={vh ? { height: vh } : undefined} aria-label={`Chat with ${partner.name}`}
        onPointerDownCapture={e => { if (selected && !(e.target as Element).closest('.dd-chat-actions, .dd-chat-head-actions, .dd-chat-back, .dd-emoji-picker')) setSelected(null); }}>
        <header className="dd-chat-head">
            <button type="button" className="dd-chat-back" onClick={() => selected ? setSelected(null) : leave()} aria-label={selected ? "Cancel selection" : "Back"}><ArrowLeft size={22} /></button>
            {selected ? <div className="dd-chat-selection"><h1>1 selected</h1><p>Choose a reaction</p></div> : <><Avatar person={partner} size="sm" />
            <div><h1>{partner.name}</h1><p aria-live="polite">{chat.partnerTyping ? <span className="dd-chat-typing-label">typing<i>.</i><i>.</i><i>.</i></span> : chat.live ? 'Private chat' : 'Connecting...'}</p></div></>}
            {selMsg && (isText || canUnsend) && <div className="dd-chat-head-actions">
                <button type="button" className="dd-chat-more" aria-label="Message options" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg></button>
                {menuOpen && <><button type="button" className="dd-chat-menu-scrim" aria-label="Close menu" onClick={() => { setMenuOpen(false); setSelected(null); }} />
                    <div className="dd-chat-menu" role="menu">
                        {isText && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); copySel(); }}>Copy</button>}
                        {canEdit && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); startEdit(); }}>Edit</button>}
                        {canUnsend && <button type="button" role="menuitem" className="is-danger" onClick={() => { setMenuOpen(false); chat.unsend(selMsg.id); setSelected(null); }}>Unsend</button>}
                    </div></>}
            </div>}
        </header>
        <div className={`dd-chat-list${selected ? ' has-held' : ''}`} ref={scroller} onScroll={e => { const el = e.currentTarget; const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80; stick.current = near; if (near) setNewBelow(false); }} onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
            {chat.hasMore && <button type="button" className="dd-chat-older" onClick={() => { const el = scroller.current; const h = el?.scrollHeight ?? 0; void chat.loadOlder().then(() => requestAnimationFrame(() => { if (el) el.scrollTop += el.scrollHeight - h; })); }}>Load earlier messages</button>}
            {!chat.loaded && !chat.loadError && <p className="dd-chat-empty" role="status">Opening your chat...</p>}
            {chat.loadError && <p className="dd-chat-empty" role="alert">Could not load the chat. <button type="button" className="dd-chat-link" onClick={chat.reload}>Try again</button></p>}
            {chat.loaded && chat.messages.length === 0 && <div className="dd-chat-empty"><img src={art('rose-heart')} alt="" width="84" height="84" /><p>Say hi to {partner.name}. Only the two of you can see this chat.</p></div>}
            {items}
            {chat.partnerTyping && <div className="dd-chat-row is-theirs"><div className="dd-chat-msg dd-chat-typing-bubble" aria-hidden="true"><i /><i /><i /></div></div>}
        </div>
        {viewer && <Viewer paths={viewer.paths} start={viewer.i} onClose={() => setViewer(null)} />}
        {emojiFor && byId.has(emojiFor) && <EmojiPicker uid={chat.uid} selected={byId.get(emojiFor)?.reactions[chat.uid]} onPick={e => chat.react(emojiFor, e)} onClose={() => { setEmojiFor(null); setSelected(null); }} />}
        {newBelow && <button type="button" className="dd-chat-new" onClick={() => { toBottom(true); setNewBelow(false); stick.current = true; }}>New messages ↓</button>}
        <div className="dd-chat-compose">
            {editing && <div className="dd-chat-replybar"><Pencil /><div><strong>Editing message</strong><span>Change the text, then tap send</span></div>
                <button type="button" onPointerDown={e => e.preventDefault()} onClick={stopEdit} aria-label="Cancel edit"><XIcon size={16} /></button></div>}
            {replyTo && <div className="dd-chat-replybar"><Reply /><div><strong>Replying to {original ? (original.sender_id === chat.uid ? 'yourself' : partner.name) : 'message'}</strong><span>{original ? snippet(original) : 'Original message is not available'}</span></div>
                <button type="button" onPointerDown={e => e.preventDefault()} onClick={() => setReplyTo(null)} aria-label="Cancel reply"><XIcon size={16} /></button></div>}
            {staged.length > 0 && <div className="dd-chat-staged" aria-label="Photos to send">{staged.map((x, i) => <div key={x.id} className="dd-chat-staged-item"><img src={x.url} alt={`Photo ${i + 1} to send`} draggable={false} /><button type="button" onPointerDown={e => e.preventDefault()} onClick={() => setStaged(prev => { URL.revokeObjectURL(x.url); return prev.filter(y => y.id !== x.id); })} aria-label={`Remove photo ${i + 1}`}><XIcon size={14} /></button></div>)}<span>{staged.length}/{MAX_PHOTOS}</span></div>}
            {note && <p className="dd-chat-note" role="status">{note}</p>}
            {trayOpen && <div className="dd-chat-tray">
                <div className="dd-chat-tray-tabs" role="group" aria-label="Sticker themes">{groups.map(g => <button type="button" key={g} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>)}</div>
                <div className="dd-chat-tray-grid">{pack.filter(s => group === 'All' || s.group === group).map(s => <button key={s.id} type="button" aria-label={`Send ${s.name}`} onClick={() => { chat.send('', s.id, replyTo); setReplyTo(null); setTrayOpen(false); stick.current = true; }}><img src={art(s.id)} alt="" width="64" height="64" loading="lazy" /></button>)}</div>
            </div>}
            <div className="dd-chat-bar">
                <button type="button" className={`dd-chat-iconbtn${trayOpen ? ' is-on' : ''}`} aria-label={trayOpen ? 'Close stickers' : 'Open stickers'} aria-expanded={trayOpen} onClick={() => { setTrayOpen(o => !o); }}><Smile /></button>
                <button type="button" className="dd-chat-iconbtn" aria-label="Send photos" onClick={() => { if (editing) { say('Finish editing first.'); return; } fileInput.current?.click(); }}><ImageIcon /></button>
                <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={e => { void pick(e.target.files); }} />
                <textarea ref={input} rows={1} value={text} maxLength={2000} placeholder="Message" aria-label={`Message ${partner.name}`} enterKeyHint="send"
                    onChange={e => { setText(e.target.value); grow(); chat.typing(!!e.target.value.trim()); }}
                    onFocus={() => { document.documentElement.classList.add('dd-chat-typing'); setTrayOpen(false); }}
                    onBlur={() => { document.documentElement.classList.remove('dd-chat-typing'); chat.typing(false); }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); submit(); } }} />
                <button type="button" className="dd-chat-send" aria-label="Send message" disabled={!text.trim() && !staged.length} onPointerDown={e => e.preventDefault()} onClick={submit}><Send /></button>
            </div>
        </div>
    </main>;
}
