import { Link, useLocation, useNavigate } from 'react-router-dom';
import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import pack from './sticker-pack.json';
import { useChat, type ChatMsg } from './ChatStore';
import { Avatar } from './ui';
import type { Person } from './model';
import { ArrowLeft, XIcon } from './icons';
import { MAX_PHOTOS, prepareImage } from './chatImages';
import { Thumb, Viewer } from './ChatPhotos';
import { GifPicker, GifMedia, GifCredit, useChatGifs, type Gif } from './ChatGifs';
import { EmojiPicker } from './EmojiPicker';
import { quickReactions } from './reactions';
import { ChatProfile } from './ChatProfile';
import { ChatAttachments } from './ChatAttachments';
import { ChatPins } from './ChatPins';
import { ScheduledChat } from './ScheduledChat';
import { ChatStatus } from './ChatStatus';
import { VoicePlayer, VoiceRecorder, Mic } from './VoiceNote';
import {OneYearCard,isOneYear} from './ChatOneYear';
import {ImageSuggestions,ImageCreditInfo,imageQuery,IMAGE_CREDIT,imageNeedsCredit} from './ChatImageSearch';
import {SongCard,SongSuggestions,musicQuery} from './ChatMusic';
import { WeatherScene,WeatherContext } from './Weather';
import {ChatWeatherCard,fetchChatWeather} from './ChatWeather';

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
const Heart = () => <svg width="46" height="46" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-9-5.6-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.4-9 12-9 12Z"/></svg>;
const Send = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.3 10l12 2-12 2Z" /></svg>;

const photoWord = (n: number) => n > 1 ? `${n} photos` : 'Photo';
function snippet(m: ChatMsg) { if(isOneYear(m.body)&&!m.images.length)return 'Our first year · Live timer'; if(m.images.length&&m.body.startsWith(IMAGE_CREDIT))return photoWord(m.images.length); if(m.weather)return `Weather: ${m.weather.place} · ${Math.round(m.weather.temperature)}°C`; if(m.song)return `Song: ${m.song.title} · ${m.song.artist}`; if(m.audio)return 'Voice note'; if (m.gif_id) return 'GIF'; if (m.images.length) return m.body ? `${photoWord(m.images.length)}: ${m.body.length > 70 ? m.body.slice(0, 70) + '…' : m.body}` : photoWord(m.images.length); return m.sticker ? `Sticker: ${stickerName(m.sticker)}` : m.body.length > 90 ? m.body.slice(0, 90) + '…' : m.body; }

function Row({ arrive, m, mine, partner, original, selected, onSelect, onTap, onOpen, onPhoto, onReply, onJump, onMore, gif, gifError, retryGif, flash, lastMine }: {
    arrive: boolean; gif?: Gif | null; gifError: string; retryGif: () => void;
    m: ChatMsg; mine: boolean; partner: Person; original?: ChatMsg; selected: boolean; onSelect: () => void; onTap: () => void; onPhoto: (paths: string[], i: number) => void; onOpen: () => void; onReply: () => void; onJump: (id: string) => void; onMore: () => void; flash: boolean; lastMine: boolean;
}) {
    const chat = useChat();
    const [dx, setDx] = useState(0);
    const [rest, setRest] = useState(true);
    const dxRef = useRef(0);
    const armed = useRef(false);
    const drag = useRef<{ x: number; y: number; id: number; on: boolean; moved: boolean; long: boolean } | null>(null);
    const hold = useRef<number>();
    const lastTap = useRef<{time:number;x:number;y:number;scroll:number}|null>(null);
    const [heartPop,setHeartPop] = useState(0);
    const heartTimer = useRef<number>();
    useEffect(()=>()=>{window.clearTimeout(hold.current);window.clearTimeout(heartTimer.current);},[]);
    const interactive = (target:EventTarget) => target instanceof Element && !!target.closest('button,a,input,textarea,video,audio,.dd-chat-thumb,.dd-chat-gif');
    const tapHeart = (e:React.PointerEvent) => {
        const now=performance.now(),scroll=(e.currentTarget.closest('.dd-chat-list') as HTMLElement)?.scrollTop??0,previous=lastTap.current;
        if(previous&&now-previous.time<=300&&Math.hypot(e.clientX-previous.x,e.clientY-previous.y)<=24&&Math.abs(scroll-previous.scroll)<3){
            lastTap.current=null;
            const adding=m.reactions[chat.uid]!=='❤️';chat.react(m.id,'❤️');
            if(adding){setHeartPop(n=>n+1);window.clearTimeout(heartTimer.current);heartTimer.current=window.setTimeout(()=>setHeartPop(0),600);}
            else setHeartPop(0);
        } else lastTap.current={time:now,x:e.clientX,y:e.clientY,scroll};
    };
    const noClick = useRef(0);
    const clearHold = () => { window.clearTimeout(hold.current); };
    const REPLY_AT = 56, MAX = 84;
    // Friend's messages swipe right, your own swipe left, like Instagram.
    const dir = mine ? -1 : 1;
    const setX = (v: number) => { dxRef.current = v; setDx(v); };
    const arrival = useRef<Animation>();
    const down = (e: React.PointerEvent) => { arrival.current?.cancel(); if(interactive(e.target))lastTap.current=null; if (e.button > 0 || !e.isPrimary || (e.target instanceof Element&&!!e.target.closest('button,a,input,textarea'))) { lastTap.current=null;clearHold();drag.current=null;return; } drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false, moved: false, long: false }; armed.current = false;
        clearHold();
        // Press and hold opens the reactions and actions, like Instagram.
        hold.current = window.setTimeout(() => { const d = drag.current; if (!d || d.on) return; d.long = true;lastTap.current=null; noClick.current = Date.now(); try { navigator.vibrate?.(12); } catch { /* ignore */ } onOpen(); }, 450); };
    const move = (e: React.PointerEvent) => {
        const d = drag.current; if (!d || d.id !== e.pointerId) return;
        const ax = (e.clientX - d.x) * dir, ay = e.clientY - d.y;
        if (Math.abs(e.clientX - d.x) > 9 || Math.abs(ay) > 9) { clearHold();lastTap.current=null;d.moved=true; }
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
        else if (!d.moved&&!interactive(e.target)) { onTap();tapHeart(e); }
    };
    const cancel = () => { lastTap.current=null;clearHold(); if (drag.current?.long) { drag.current = null; return; } drag.current = null; setRest(true); setX(0); };
    const rowEl = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {if(!arrive||!rowEl.current||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;arrival.current=rowEl.current.animate([{opacity:.35,transform:`translate3d(${mine?8:-8}px,10px,0)`},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:230,easing:'cubic-bezier(.2,.75,.25,1)'});return()=>arrival.current?.cancel();},[]);
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
            style={{ transform: dx ? `translateX(${dx * dir}px)` : undefined, transition: rest ? 'transform .26s cubic-bezier(.2,.8,.25,1)' : 'none' }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onContextMenu={e => e.preventDefault()}
            role="button" tabIndex={0} aria-label={`${mine ? 'Your' : `${partner.name}'s`} message: ${snippet(m)}. Press Enter for actions.`}
            onKeyDown={e => { if(e.target!==e.currentTarget)return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } else if (e.key === 'r') { e.preventDefault(); onReply(); } }}>
            {heartPop>0&&<span key={heartPop} className="dd-heart-pop" aria-hidden="true"><Heart/></span>}
            {m.reply_to && <button type="button" className="dd-chat-quote" disabled={!original} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); original && onJump(original.id); }}>
                <strong>{original ? (original.sender_id === chat.uid ? 'You' : partner.name) : 'Message'}</strong>
                <span>{original ? snippet(original) : 'Original message is not available'}</span>
            </button>}
            {isOneYear(m.body)&&!m.images.length&&!m.song&&!m.weather&&!m.audio&&!m.sticker&&!m.gif_id&&<OneYearCard/>}
            {m.weather && <ChatWeatherCard weather={m.weather}/>}
            {m.song && <SongCard song={m.song}/>}
            {m.audio && (m.state?<span className="dd-chat-text">🎙 Voice note · {Math.round(m.audio.duration)}s</span>:<VoicePlayer voice={m.audio}/>)}
            {m.images.length > 0 && <div className={`dd-chat-photos n${m.images.length}`}>{m.images.map((p, i) => <Thumb key={p} path={p} index={i} total={m.images.length} sending={m.state === 'sending'} onOpen={k => { if (Date.now() - noClick.current > 600) onPhoto(m.images, k); }} />)}{m.body.startsWith(IMAGE_CREDIT)&&imageNeedsCredit(m.body)&&<ImageCreditInfo body={m.body}/>}</div>}
            {m.gif_id && <div className="dd-chat-gif">{gif ? <><GifMedia gif={gif}/><GifCredit gif={gif}/></> : <div className="dd-gif-placeholder">{gif === null ? 'GIF is unavailable.' : gifError || 'Loading GIF...'}{gifError && <button type="button" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();retryGif();}}>Retry GIF</button>}</div>}</div>}
            {sticker ? <img className="dd-chat-sticker" src={art(m.sticker!)} alt={stickerName(m.sticker!)} width="128" height="128" draggable={false} />
                : m.sticker ? <span className="dd-chat-text">Sticker</span> : m.body ? (isOneYear(m.body)&&!m.images.length?null:m.images.length>0&&m.body.startsWith(IMAGE_CREDIT)?null:<span className="dd-chat-text">{m.body}</span>) : null}
            <span className="dd-chat-time">{m.scheduled?'Scheduled · ':''}{m.edited_at && !sticker ? 'edited · ' : ''}{timeFmt.format(new Date(m.created_at))}</span>
        </div>
        {groups.length > 0 && <div className="dd-chat-reacts">{groups.map(([e, n]) => <button key={`${e}:${n}`} type="button" className={mineReact === e ? 'is-mine' : ''} onClick={() => chat.react(m.id, e)} aria-label={`${e} ${n}. Tap to ${mineReact === e ? 'remove' : 'add'} your reaction`}>{e}{n > 1 ? ` ${n}` : ''}</button>)}</div>}
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
    const weatherContext=useContext(WeatherContext),weatherSending=useRef(false),weatherController=useRef<AbortController>();
    const [weatherBusy,setWeatherBusy]=useState(false);
    useEffect(()=>()=>weatherController.current?.abort(),[]);
    const chat = useChat();
    const navigate = useNavigate();
    // Go back to wherever the chat was opened from; if it was opened directly, go home.
    const leave = () => { if ((window.history.state?.idx ?? 0) > 0) navigate(-1); else navigate('/', { replace: true }); };
    const [text, setText] = useState('');
    const [recording,setRecording]=useState(false);
    useEffect(()=>{setRecording(false);},[useLocation().pathname]);
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [pinnedIds,setPinnedIds]=useState<Set<string>>(new Set());
    const [pinRequest,setPinRequest]=useState<{id:string;pin:boolean;n:number}|null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [emojiFor, setEmojiFor] = useState<string | null>(null);
    const [viewer, setViewer] = useState<{ paths: string[]; i: number } | null>(null);
    const [staged, setStaged] = useState<{ id: string; blob: Blob; url: string }[]>([]);
    const [note, setNote] = useState('');
    const [scheduleRequest,setScheduleRequest]=useState(0);
    const sendHold=useRef<number>();const sendHeld=useRef(false);const sendOrigin=useRef({x:0,y:0});
    useEffect(()=>()=>window.clearTimeout(sendHold.current),[]);
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
    const gifs = useChatGifs(chat.messages.flatMap(m => m.gif_id ? [m.gif_id] : []));
    const [trayOpen, setTrayOpen] = useState(false);
    const [gifSending,setGifSending]=useState(false);
    const [flash, setFlash] = useState<string | null>(null);
    const [belowIds,setBelowIds] = useState<string[]>([]);
    const arrivalBaseline=useRef<{ready:boolean;ids:Set<string>;latest:string}>({ready:false,ids:new Set(),latest:''});
    const jumpingToBottom=useRef(false);
    const [awayFromBottom,setAwayFromBottom] = useState(false);
    const setNewBelow = (v:boolean) => {if(!v)setBelowIds([]);};
    const scroller = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLTextAreaElement>(null);
    const route = useLocation();
    const profileOpen = route.pathname === '/chat/profile';
    const wasProfile = useRef(false);
    useEffect(() => { if (!profileOpen && wasProfile.current) document.querySelector<HTMLAnchorElement>('.dd-chat-contact')?.focus({ preventScroll: true }); wasProfile.current = profileOpen; }, [profileOpen]);
    useEffect(() => {
        const focus = () => input.current?.focus();
        if (new URLSearchParams(route.search).get('compose') === '1') focus();
        window.addEventListener('dd-chat-compose', focus);
        return () => window.removeEventListener('dd-chat-compose', focus);
    }, [route.key, route.search]);
    const seenMessages = useRef(new Set<string>()), animationReady = useRef(false), newestSeen = useRef('');
    const arrivals = new Set<string>();
    if(animationReady.current&&!document.hidden&&!profileOpen)for(const m of chat.messages)if(!seenMessages.current.has(m.id)&&(m.state==='sending'||m.created_at>newestSeen.current))arrivals.add(m.id);
    useLayoutEffect(()=>{if(!chat.loaded)return;for(const m of chat.messages){seenMessages.current.add(m.id);if(m.created_at>newestSeen.current)newestSeen.current=m.created_at;}animationReady.current=true;},[chat.loaded,chat.messages]);
    useEffect(()=>()=>chat.typing(false),[chat.typing]);
    useEffect(()=>{if(profileOpen)chat.typing(false);},[profileOpen,chat.typing]);
    const stick = useRef(true);
    const prevLen = useRef(0);
    const prevLastId=useRef<string>();
    const { setViewing } = chat;
    useEffect(() => { setViewing(!profileOpen); return () => setViewing(false); }, [setViewing, profileOpen]);

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
    const newBelowCount=belowIds.filter(id=>byId.has(id)).length;
    // An unsent message leaves nothing behind: close anything that was pointing at it, without a word.

    useEffect(() => {
        if (!chat.loaded) return;
        if (selected && !byId.has(selected)) setSelected(null);
        if (replyTo && !byId.has(replyTo)) setReplyTo(null);
        if (editing && !byId.has(editing)) { setEditing(null); setText(''); }
        if (emojiFor && !byId.has(emojiFor)) { setEmojiFor(null); if (window.history.state?.ddEmoji) window.history.back(); }
        if (viewer && !chat.messages.some(m => m.images.length && m.images[0] === viewer.paths[0])) { if (window.history.state?.ddv) window.history.back(); else setViewer(null); }
    }, [byId, chat.loaded, chat.messages, selected, replyTo, editing, viewer, emojiFor]);
    const lastMineId = useMemo(() => { for (let i = chat.messages.length - 1; i >= 0; i--) if (chat.messages[i].sender_id === chat.uid) return chat.messages[i].id; return null; }, [chat.messages, chat.uid]);
    const [resumeTick,setResumeTick]=useState(0);
    const resumeKey=`dd_chat_place_${chat.uid}`;
    const resume=useRef<{id?:string;offset?:number;bottom?:boolean;top?:number}|null>(null),resumeDone=useRef(false),resumeLoading=useRef(false),resumePages=useRef(0);
    useState(()=>{try{resume.current=JSON.parse(localStorage.getItem(resumeKey)||'null');}catch{}return null;});
    useLayoutEffect(()=>{
        if(!chat.loaded||resumeDone.current)return;
        const el=scroller.current,r=resume.current;if(!el||!r||r.bottom){resumeDone.current=true;return;}
        const row=r.id?el.querySelector<HTMLElement>(`[data-id="${CSS.escape(r.id)}"]`):null;
        if(!row&&chat.hasMore&&resumePages.current<20){stick.current=false;if(!resumeLoading.current){resumeLoading.current=true;resumePages.current++;void chat.loadOlder().finally(()=>{resumeLoading.current=false;setResumeTick(n=>n+1);});}return;}
        resumeDone.current=true;stick.current=false;
        requestAnimationFrame(()=>{if(row)el.scrollTop+=row.getBoundingClientRect().top-el.getBoundingClientRect().top-(r.offset||0);else el.scrollTop=r.top||0;});
    },[chat.loaded,chat.messages,chat.hasMore,resumeTick]);
    useEffect(()=>{
        const save=()=>{const el=scroller.current;if(!el||!resumeDone.current)return;const top=el.getBoundingClientRect().top;const row=[...el.querySelectorAll<HTMLElement>('.dd-chat-row[data-id]')].find(r=>r.getBoundingClientRect().bottom>top+18);try{localStorage.setItem(resumeKey,JSON.stringify({id:row?.dataset.id,offset:row?row.getBoundingClientRect().top-top:0,bottom:el.scrollHeight-el.scrollTop-el.clientHeight<80,top:el.scrollTop}));}catch{}};
        document.addEventListener('visibilitychange',save);window.addEventListener('pagehide',save);const el=scroller.current;let timer:number|undefined;const scroll=()=>{clearTimeout(timer);timer=window.setTimeout(save,200);};el?.addEventListener('scroll',scroll,{passive:true});return()=>{save();clearTimeout(timer);el?.removeEventListener('scroll',scroll);document.removeEventListener('visibilitychange',save);window.removeEventListener('pagehide',save);};
    },[resumeKey]);
    const toBottom = (smooth = false) => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' }); };
    useLayoutEffect(() => {
        const grew = chat.messages.length > prevLen.current;
        const last = chat.messages[chat.messages.length - 1];
        if ((!resume.current || resumeDone.current) && (stick.current || (grew && last?.id!==prevLastId.current && last?.sender_id === chat.uid))) { toBottom(prevLen.current > 0); setNewBelow(false); }
        prevLen.current = chat.messages.length;prevLastId.current=last?.id;
    }, [chat.messages, chat.partnerTyping, chat.uid]);
    useLayoutEffect(() => { if (chat.loaded && (!resume.current || resume.current.bottom)) toBottom(); }, [chat.loaded]);
    // Baseline existing/history messages once. Only newly added incoming IDs count.
    // Equal timestamps are allowed, and receipts/edits/duplicate deliveries do not recount IDs.
    useLayoutEffect(()=>{
        if(!chat.loaded)return;
        const base=arrivalBaseline.current;
        const fresh=chat.messages.filter(m=>!base.ids.has(m.id)&&m.sender_id!==chat.uid&&m.created_at>=base.latest);
        if(base.ready&&!stick.current&&!jumpingToBottom.current&&!document.hidden&&!profileOpen&&fresh.length){
            setBelowIds(ids=>[...new Set([...ids,...fresh.map(m=>m.id)])]);
        }
        for(const m of chat.messages){base.ids.add(m.id);if(m.created_at>base.latest)base.latest=m.created_at;}
        base.ready=true;
    },[chat.messages,chat.loaded,chat.uid,profileOpen]);
    const measureBelow=useCallback(()=>{
        const el=scroller.current;if(!el)return;
        if(resume.current&&!resume.current.bottom&&!resumeDone.current){stick.current=false;return;}
        const distance=el.scrollHeight-el.scrollTop-el.clientHeight;
        const near=distance<80;stick.current=near;setAwayFromBottom(distance>120);
        if(near){jumpingToBottom.current=false;setBelowIds(ids=>ids.length?[]:ids);}
    },[]);
    useEffect(()=>{
        const el=scroller.current;if(!el)return;let frame=0,idle:number|undefined,scrolling=false;
        const finish=()=>{scrolling=false;el.classList.remove('is-scrolling');window.dispatchEvent(new CustomEvent('dd-chat-scroll',{detail:false}));};
        const scroll=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;measureBelow();});if(!scrolling){scrolling=true;el.classList.add('is-scrolling');window.dispatchEvent(new CustomEvent('dd-chat-scroll',{detail:true}));}window.clearTimeout(idle);idle=window.setTimeout(finish,180);};
        el.addEventListener('scroll',scroll,{passive:true});return()=>{el.removeEventListener('scroll',scroll);cancelAnimationFrame(frame);window.clearTimeout(idle);if(scrolling)finish();};
    },[measureBelow]);
    useLayoutEffect(()=>{
        const el=scroller.current;if(!el)return;
        const observer=new ResizeObserver(measureBelow);observer.observe(el);
        el.querySelectorAll('.dd-chat-row[data-id]').forEach(row=>observer.observe(row));
        measureBelow();return()=>observer.disconnect();
    },[chat.messages,chat.partnerTyping,measureBelow]);
    useLayoutEffect(() => { if (stick.current) toBottom(); }, [vh, replyTo, trayOpen]);

    const grow = () => { const el = input.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden'; if (stick.current) toBottom(); };
    const submit = () => {
        if (!text.trim() && !staged.length) return;
        if(!editing&&!staged.length&&imageQuery(text)!==null){say('Tap an image in the suggestions to send it.');return;}
        if(!editing&&!staged.length&&musicQuery(text)!==null){say('Tap a song in the suggestions to send it.');return;}
        if(!editing&&!staged.length&&text.trim().toLowerCase()==='/weather'){
            if(weatherSending.current)return;
            const city=weatherContext.city;if(!city){say('Set a weather city in Settings first, then send /weather.');return;}
            weatherSending.current=true;setWeatherBusy(true);chat.typing(false);say('Getting current weather…');const ctl=new AbortController();weatherController.current=ctl;const timeout=window.setTimeout(()=>ctl.abort(),12000);const reply=replyTo;
            void fetchChatWeather(city,ctl.signal).then(weather=>{if(ctl.signal.aborted)return;chat.sendWeather(weather,reply);setText(current=>current.trim().toLowerCase()==='/weather'?'':current);setReplyTo(current=>current===reply?null:current);setNote('');stick.current=true;requestAnimationFrame(grow);}).catch(()=>{if(weatherController.current===ctl)say('Could not get fresh weather. Check your connection and send /weather again.');}).finally(()=>{clearTimeout(timeout);weatherSending.current=false;setWeatherBusy(false);});return;
        }
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
        el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); setFlash(id); window.setTimeout(() => setFlash(null), 1400);
    };
    useLayoutEffect(() => { if (stick.current) toBottom(); }, [gifs.items]);
    const startReply = (id: string) => { setEditing(null); setReplyTo(id); setSelected(null); input.current?.focus(); };
    const selMsg = selected ? byId.get(selected) : undefined;
    const isText = !!selMsg && !selMsg.sticker && !selMsg.gif_id && !selMsg.audio && !selMsg.song && !selMsg.weather && !!selMsg.body && !isOneYear(selMsg.body) && !(selMsg.images.length>0&&selMsg.body.startsWith(IMAGE_CREDIT));
    const canEdit = isText && selMsg!.sender_id === chat.uid && !selMsg!.state;
    const canUnsend = !!selMsg && selMsg.sender_id === chat.uid && selMsg.state !== 'sending';
    const startEdit = () => { if (!selMsg) return; setTrayOpen(false); clearStaged(); setReplyTo(null); setEditing(selMsg.id); setText(selMsg.body); setSelected(null); requestAnimationFrame(() => { grow(); const el = input.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }); };
    const stopEdit = () => { setEditing(null); setText(''); requestAnimationFrame(grow); };
    const copySel = () => { if (selMsg) void navigator.clipboard?.writeText(selMsg.body).catch(() => {}); setSelected(null); };
    const original = replyTo ? byId.get(replyTo) : undefined;
    const items: React.ReactNode[] = [];
    let lastDay = '';
    chat.messages.forEach(m => {
        const d = dayKey.format(new Date(m.created_at));
        if (d !== lastDay) { lastDay = d; items.push(<p key={`d${d}`} className="dd-chat-day"><span>{dayLabel(m.created_at)}</span></p>); }
        items.push(<Row key={m.id} arrive={arrivals.has(m.id)} m={m} mine={m.sender_id === chat.uid} partner={partner} original={m.reply_to ? byId.get(m.reply_to) : undefined}
            selected={selected === m.id} gif={m.gif_id ? gifs.items[m.gif_id] : undefined} gifError={gifs.error} retryGif={gifs.retry} onSelect={() => setSelected(s => s === m.id ? null : m.id)} onTap={() => setSelected(null)} onOpen={() => setSelected(m.id)} onPhoto={(paths, i) => setViewer({ paths, i })} onReply={() => startReply(m.id)} onMore={() => { input.current?.blur(); setEmojiFor(m.id); }} onJump={jump} flash={flash === m.id} lastMine={m.id === lastMineId} />);
    });

    return <><main {...(profileOpen ? { inert: '' } : {})} aria-hidden={profileOpen || undefined} className="dd-chat" style={vh ? { height: vh } : undefined} aria-label={`Chat with ${partner.name}`}
        onPointerDownCapture={e => { if (selected && !(e.target as Element).closest('.dd-chat-actions, .dd-chat-head-actions, .dd-chat-back, .dd-emoji-picker')) setSelected(null); }}>
        <WeatherScene chat/><header className="dd-chat-head">
            <button type="button" className="dd-chat-back" onClick={() => selected ? setSelected(null) : leave()} aria-label={selected ? "Cancel selection" : "Back"}><ArrowLeft size={22} /></button>
            {selected ? <div className="dd-chat-selection"><h1>1 selected</h1><p>Choose a reaction</p></div> : <Link to="/chat/profile" state={{ ddChatProfile: true }} className="dd-chat-contact" aria-label={`View ${partner.name}'s profile`} onClick={()=>input.current?.blur()}><Avatar person={partner} size="sm" />
            <div className={`dd-contact-label${chat.partnerOnline?' is-online':''}`}><h1>{partner.name}</h1><p aria-live="polite" aria-hidden={!chat.partnerOnline||undefined}>Online</p></div></Link>}
            {!selMsg && <ChatStatus partner={partner} online={chat.partnerOnline}/>}
            {selMsg && !selMsg.state && <div className="dd-chat-head-actions">
                <button type="button" className="dd-chat-more" aria-label="Message options" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg></button>
                {menuOpen && <><button type="button" className="dd-chat-menu-scrim" aria-label="Close menu" onClick={() => { setMenuOpen(false); setSelected(null); }} />
                    <div className="dd-chat-menu" role="menu">
                        <button type="button" role="menuitem" onClick={()=>{const id=selMsg.id;setPinRequest({id,pin:!pinnedIds.has(id),n:Date.now()});setMenuOpen(false);setSelected(null);}}>{pinnedIds.has(selMsg.id)?'Unpin':'Pin'}</button>
                        {isText && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); copySel(); }}>Copy</button>}
                        {canEdit && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); startEdit(); }}>Edit</button>}
                        {canUnsend && <button type="button" role="menuitem" className="is-danger" onClick={() => { setMenuOpen(false); const id=selMsg.id; setSelected(null); say('Unsending...'); void chat.unsend(id).then(ok=>say(ok?'':'Could not unsend. Check your connection and try again.')); }}>Unsend</button>}
                    </div></>}
            </div>}
        </header>
        <ChatPins uid={chat.uid} request={pinRequest} onState={setPinnedIds} onJump={async id=>{stick.current=false;for(let i=0;i<21;i++){const el=scroller.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);if(el){jump(id);return true;}if(i===20)return false;await chat.loadOlder();await new Promise(r=>setTimeout(r,40));}return false;}}/>
        <div className={`dd-chat-list${selected ? ' has-held' : ''}`} ref={scroller} onPointerDown={()=>{jumpingToBottom.current=false;}} onWheel={()=>{jumpingToBottom.current=false;}} onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
            {chat.hasMore && <button type="button" className="dd-chat-older" onClick={() => { const el = scroller.current; const h = el?.scrollHeight ?? 0; void chat.loadOlder().then(() => requestAnimationFrame(() => { if (el) el.scrollTop += el.scrollHeight - h; })); }}>Load earlier messages</button>}
            {!chat.loaded && !chat.loadError && <p className="dd-chat-empty" role="status">Opening your chat...</p>}
            {chat.loadError && <p className="dd-chat-empty" role="alert">Could not load the chat. <button type="button" className="dd-chat-link" onClick={chat.reload}>Try again</button></p>}
            {chat.loaded && chat.messages.length === 0 && <div className="dd-chat-empty"><img src={art('rose-heart')} alt="" width="84" height="84" /><p>Say hi to {partner.name}. Only the two of you can see this chat.</p></div>}
            {items}
            {chat.partnerTyping && !profileOpen && <div className="dd-chat-row is-theirs dd-typing-row" role="status" aria-label={`${partner.name} is typing`}><div className="dd-chat-msg dd-chat-typing-bubble"><span className="dd-typing-word">typing</span><span className="dd-typing-dots" aria-hidden="true"><i /><i /><i /></span></div></div>}
        </div>
        {viewer && <Viewer paths={viewer.paths} start={viewer.i} onClose={() => setViewer(null)} />}
        {emojiFor && byId.has(emojiFor) && <EmojiPicker uid={chat.uid} selected={byId.get(emojiFor)?.reactions[chat.uid]} onPick={e => chat.react(emojiFor, e)} onClose={() => { setEmojiFor(null); setSelected(null); }} />}
        <div className="dd-chat-compose">
            <button type="button" className={`dd-chat-bottom${awayFromBottom&&!selected&&!emojiFor&&!viewer&&!profileOpen&&!trayOpen?' is-visible':''}`} aria-label={newBelowCount?`Scroll to latest message, ${newBelowCount} new ${newBelowCount===1?'message':'messages'}`:'Scroll to latest message'} tabIndex={awayFromBottom&&!selected&&!emojiFor&&!viewer&&!profileOpen&&!trayOpen?0:-1} aria-hidden={!(awayFromBottom&&!selected&&!emojiFor&&!viewer&&!profileOpen&&!trayOpen)||undefined} onPointerDown={e=>e.preventDefault()} onClick={()=>{jumpingToBottom.current=true;setNewBelow(false);stick.current=true;toBottom(true);}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>{newBelowCount>0&&<span className="dd-chat-bottom-count" aria-hidden="true">{newBelowCount>99?'99+':newBelowCount}</span>}</button>
            <ScheduledChat draft={text} blocked={!!replyTo||!!editing||staged.length>0||(isOneYear(text)||imageQuery(text)!==null||musicQuery(text)!==null||text.trim().toLowerCase()==='/weather')} request={scheduleRequest} onSaved={()=>{setText('');chat.typing(false);requestAnimationFrame(grow);}}/>
            {editing && <div className="dd-chat-replybar"><Pencil /><div><strong>Editing message</strong><span>Change the text, then tap send</span></div>
                <button type="button" onPointerDown={e => e.preventDefault()} onClick={stopEdit} aria-label="Cancel edit"><XIcon size={16} /></button></div>}
            {replyTo && <div className="dd-chat-replybar"><Reply /><div><strong>Replying to {original ? (original.sender_id === chat.uid ? 'yourself' : partner.name) : 'message'}</strong><span>{original ? snippet(original) : 'Original message is not available'}</span></div>
                <button type="button" onPointerDown={e => e.preventDefault()} onClick={() => setReplyTo(null)} aria-label="Cancel reply"><XIcon size={16} /></button></div>}
            {staged.length > 0 && <div className="dd-chat-staged" aria-label="Photos to send">{staged.map((x, i) => <div key={x.id} className="dd-chat-staged-item"><img src={x.url} alt={`Photo ${i + 1} to send`} draggable={false} /><button type="button" onPointerDown={e => e.preventDefault()} onClick={() => setStaged(prev => { URL.revokeObjectURL(x.url); return prev.filter(y => y.id !== x.id); })} aria-label={`Remove photo ${i + 1}`}><XIcon size={14} /></button></div>)}<span>{staged.length}/{MAX_PHOTOS}</span></div>}
            {note && <p className="dd-chat-note" role="status">{note}</p>}
            {!editing&&!staged.length&&!recording&&!profileOpen&&imageQuery(text)!==null&&<ImageSuggestions query={imageQuery(text)!} onSend={(blob,caption)=>{chat.sendImages([blob],caption,replyTo);chat.typing(false);setText('');setReplyTo(null);setNote('');stick.current=true;requestAnimationFrame(()=>{grow();input.current?.focus();});}}/>}
            {!editing&&!staged.length&&!recording&&!profileOpen&&musicQuery(text)!==null&&<SongSuggestions query={musicQuery(text)!} onSend={song=>{chat.sendSong(song,replyTo);chat.typing(false);setText('');setReplyTo(null);setNote('');stick.current=true;requestAnimationFrame(()=>{grow();input.current?.focus();});}}/>}
            {trayOpen && <GifPicker onBusyChange={setGifSending} height={Math.max(160, Math.min(330, (vh ?? window.innerHeight) * .45))} onClose={() => setTrayOpen(false)} onSend={async (id,messageId) => { const ok=await chat.sendGif(id, replyTo,messageId); if(ok){chat.typing(false); setReplyTo(null); setTrayOpen(false); stick.current = true;} return ok; }} />}
            {recording&&!profileOpen?<VoiceRecorder onClose={()=>setRecording(false)} onSend={(blob,duration,mime,peaks)=>{chat.sendVoice(blob,duration,mime,peaks,replyTo);setReplyTo(null);stick.current=true;}}/>:<div className="dd-chat-bar">
                <ChatAttachments compact={text.length>0} gifDisabled={gifSending||!!editing||staged.length>0} disabled={gifSending||!!editing} trayOpen={trayOpen} onGif={()=>{input.current?.blur();setTrayOpen(o=>!o);}} onPhoto={()=>fileInput.current?.click()}/>
                <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={e => { void pick(e.target.files); }} />
                <textarea ref={input} rows={1} value={text} maxLength={2000} placeholder="Message" aria-label={`Message ${partner.name}`} enterKeyHint="enter"
                    onChange={e => { setText(e.target.value); grow(); chat.typing(!!e.target.value.trim()); }}
                    onFocus={() => { document.documentElement.classList.add('dd-chat-typing'); if(!gifSending)setTrayOpen(false); }}
                    onBlur={() => { document.documentElement.classList.remove('dd-chat-typing'); chat.typing(false); }}
                    />
                {!text.trim()&&!staged.length&&!editing&&<button type="button" className="dd-chat-send" aria-label="Record voice note" onClick={()=>{input.current?.blur();chat.typing(false);setTrayOpen(false);setRecording(true);}}><span className="dd-compose-icon-fade" key="mic"><Mic/></span></button>}
                {(!!text.trim()||staged.length>0||!!editing)&&<button type="button" className="dd-chat-send" aria-label="Send message" disabled={weatherBusy||(!text.trim() && !staged.length)} onPointerDown={e=>{e.preventDefault();sendHeld.current=false;sendOrigin.current={x:e.clientX,y:e.clientY};try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}window.clearTimeout(sendHold.current);sendHold.current=window.setTimeout(()=>{sendHeld.current=true;chat.typing(false);input.current?.blur();setScheduleRequest(n=>n+1);},500);}} onPointerMove={e=>{if(Math.hypot(e.clientX-sendOrigin.current.x,e.clientY-sendOrigin.current.y)>12)window.clearTimeout(sendHold.current);}} onPointerUp={()=>window.clearTimeout(sendHold.current)} onPointerCancel={()=>window.clearTimeout(sendHold.current)} onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{if(e.key==='ArrowUp'&&e.altKey){e.preventDefault();chat.typing(false);setScheduleRequest(n=>n+1);}}} onClick={()=>{window.clearTimeout(sendHold.current);if(sendHeld.current){sendHeld.current=false;return;}submit();}}><span className="dd-compose-icon-fade" key="send"><Send /></span></button>}
            </div>}
        </div>
    </main>{profileOpen&&<ChatProfile partner={partner}/>}</>;
}
