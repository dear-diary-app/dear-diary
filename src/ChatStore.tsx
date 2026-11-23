import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { isGifId } from './ChatGifs';
import { useAppPresence } from './useAppPresence';
import { useChatTyping } from './useChatTyping';
import { isEmojiReaction, rememberReaction } from './reactions';
import {cleanSong,type Song} from './ChatMusic';
import { cleanVoice, uploadVoice, voiceExt, type Voice } from './chatAudio';
import { primeImage, removeImages, uploadImages } from './chatImages';

export interface ChatMsg {
    id: string; sender_id: string; recipient_id: string; body: string; sticker: string | null; gif_id: string | null; reply_to: string | null;
    reactions: Record<string, string>; created_at: string; seen_at: string | null; edited_at: string | null; images: string[]; state?: 'sending' | 'failed'; scheduled?: boolean; audio?: Voice | null; song?:Song|null;
}
const COLS = 'id, sender_id, recipient_id, body, sticker, gif_id, reply_to, reactions, created_at, seen_at, edited_at, images, scheduled, audio, song';
const PAGE = 60;
const byTime = (a: ChatMsg, b: ChatMsg) => a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1;
function clean(r: unknown): ChatMsg | null {
    const m = r as Partial<ChatMsg> | null;
    if (!m || typeof m.id !== 'string' || typeof m.sender_id !== 'string' || typeof m.created_at !== 'string') return null;
    return { song:cleanSong(m.song), audio:cleanVoice(m.audio), scheduled:m.scheduled===true, id: m.id, sender_id: m.sender_id, recipient_id: String(m.recipient_id ?? ''), body: typeof m.body === 'string' ? m.body : '', sticker: typeof m.sticker === 'string' ? m.sticker : null, gif_id: isGifId(m.gif_id) ? m.gif_id : null,
        reply_to: typeof m.reply_to === 'string' ? m.reply_to : null, reactions: m.reactions && typeof m.reactions === 'object' ? m.reactions as Record<string, string> : {},
        created_at: m.created_at, seen_at: typeof m.seen_at === 'string' ? m.seen_at : null, edited_at: typeof m.edited_at === 'string' ? m.edited_at : null,
        images: Array.isArray(m.images) ? (m.images as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 3) : [] };
}

// Removing a message also clears any reply quote that pointed at it, so no placeholder or stale text shows.
const dropMessage = (list: ChatMsg[], id: string) => list.filter(m => m.id !== id).map(m => m.reply_to === id ? { ...m, reply_to: null } : m);

export interface ChatApi {
    uid: string; messages: ChatMsg[]; loaded: boolean; loadError: boolean; hasMore: boolean; live: boolean; partnerTyping: boolean; partnerOnline: boolean; unread: number;
    send: (body: string, sticker?: string | null, replyTo?: string | null) => void;
    sendGif: (id: string, replyTo?: string | null, messageId?: string) => Promise<boolean>;
    sendSong: (song:Song,replyTo?:string|null)=>void;
    sendVoice: (blob: Blob, duration: number, mime: string, peaks: number[], replyTo?: string | null) => void;
    sendImages: (files: Blob[], body: string, replyTo?: string | null) => void;
    retry: (id: string) => void; discard: (id: string) => void; unsend: (id: string) => Promise<boolean>; edit: (id: string, body: string) => void; react: (id: string, emoji: string) => void;
    loadOlder: () => Promise<void>; typing: (on: boolean) => void; setViewing: (on: boolean) => void; reload: () => void;
}
const Ctx = createContext<ChatApi | null>(null);
export const useChat = () => useContext(Ctx)!;

export function ChatProvider({ uid, children }: { uid: string; children: React.ReactNode }) {
    const partnerOnline = useAppPresence(uid);
    const nav = useNavigate();
    const loc = useLocation();
    const pathRef = useRef(loc.pathname);
    pathRef.current = loc.pathname;
    useEffect(() => {
        // A tapped chat notification asks the open app to show the chat, but never leaves a diary page being written.
        const onMsg = (e: MessageEvent) => { if (e.data?.type !== 'diary-open-chat' || (e.data.account_id && e.data.account_id !== uid) || pathRef.current.startsWith('/write/')) return;
            if (e.data.compose) { nav('/chat?compose=1', { state: { composeAt: Date.now() } }); window.dispatchEvent(new Event('dd-chat-compose')); }
            else if (pathRef.current !== '/chat') nav('/chat'); };
        navigator.serviceWorker?.addEventListener('message', onMsg);
        return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
    }, [nav, uid]);
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [live, setLive] = useState(false);
    const [viewing, setViewing] = useState(false);
    const [visible, setVisible] = useState(() => !document.hidden);
    const channel = useRef<RealtimeChannel | null>(null);
    const joined = useRef(false);
    const partner = useRef<string | null>(null);
    const list = useRef<ChatMsg[]>([]);
    const { partnerTyping, typing, receive: receiveTyping, clear: clearTyping, stop: stopTyping } = useChatTyping(uid, channel, joined);
    list.current = messages;

    const merge = useCallback((rows: unknown[]) => {
        const next = rows.map(clean).filter((m): m is ChatMsg => !!m);
        if (!next.length) return;
        setMessages(prev => {
            const map = new Map(prev.map(m => [m.id, m]));
            next.forEach(m => { const old = map.get(m.id); map.set(m.id, { ...m, state: old?.state === 'failed' ? 'failed' : undefined }); });
            return [...map.values()].sort(byTime);
        });
    }, []);

    const fetchLatest = useCallback(async () => {
        const { data, error } = await supabase.from('chat_messages').select(COLS).order('created_at', { ascending: false }).limit(PAGE);
        if (error || !data) { setLoadError(prev => prev || list.current.length === 0); return; }
        setLoadError(false);
        const rows = (data as unknown[]).map(clean).filter((m): m is ChatMsg => !!m);
        const oldest = rows.length === PAGE ? rows[rows.length - 1].created_at : '';
        setHasMore(h => (rows.length === PAGE ? true : list.current.length > rows.length ? h : false));
        setMessages(prev => {
            const map = new Map(prev.map(m => [m.id, m]));
            const fresh = new Set(rows.map(r => r.id));
            // A message that is inside the fetched window but missing from it was unsent.
            prev.forEach(m => { if (!m.state && !fresh.has(m.id) && (oldest === '' || m.created_at >= oldest)) map.delete(m.id); });
            rows.forEach(m => { const old = map.get(m.id); map.set(m.id, { ...m, state: old?.state === 'failed' ? 'failed' : undefined }); });
            return [...map.values()].sort(byTime);
        });
        setLoaded(true);
    }, []);

    const loadOlder = useCallback(async () => {
        const first = list.current.find(m => !m.state);
        if (!first) return;
        const { data } = await supabase.from('chat_messages').select(COLS).lt('created_at', first.created_at).order('created_at', { ascending: false }).limit(PAGE);
        if (!data) return;
        setHasMore(data.length === PAGE);
        merge(data as unknown[]);
    }, [merge]);

    // Connection: live changes plus a broadcast channel for the typing dots. Polling covers any gap.
    useEffect(() => {
        let dead = false;
        let ch: RealtimeChannel | null = null;
        const publish=(e:Event)=>{const d=(e as CustomEvent).detail;if(d?.uid===uid&&joined.current)void ch?.send({type:'broadcast',event:'presence-change',payload:{uid}});};
        window.addEventListener('dd-presence-published',publish);
        (async () => {
            await fetchLatest();
            const { data: f } = await supabase.from('friendship').select('user1_id, user2_id').maybeSingle();
            if (dead || !f) return;
            const other = f.user1_id === uid ? f.user2_id : f.user1_id;
            partner.current = other;
            ch = supabase.channel(`dd-chat-${[uid, other].sort().join('-')}`, { config: { broadcast: { self: false } } })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, (p: { eventType: string; new: unknown; old: { id?: string } }) => {
                    if (p.eventType === 'DELETE') { const id = p.old?.id; if (id) setMessages(prev => dropMessage(prev, id)); return; }
                    merge([p.new]);
                    const m = clean(p.new);
                    if (m && m.sender_id !== uid) { clearTyping(); }
                })
                .on('broadcast',{event:'presence-change'},({payload}:{payload?:{uid?:string}})=>{if(payload?.uid===other)window.dispatchEvent(new Event('dd-presence-check'));})
                .on('broadcast', { event: 'typing' }, ({ payload }: { payload?: { uid?: string; on?: boolean } }) => {
                    if (payload?.uid !== other) return;
                    receiveTyping(payload?.on === true);
                })
                .subscribe((status: string) => {
                    const ok = status === 'SUBSCRIBED';
                    joined.current = ok; setLive(ok);
                    if (ok) {void fetchLatest();window.dispatchEvent(new Event('dd-presence-reconnect'));} else { clearTyping(); stopTyping(); }
                });
            channel.current = ch;
        })();
        return () => { dead = true;window.removeEventListener('dd-presence-published',publish); stopTyping(); clearTyping(); joined.current = false; if (ch) void supabase.removeChannel(ch); channel.current = null; };
    }, [uid, fetchLatest, merge, receiveTyping, clearTyping, stopTyping]);

    useEffect(() => {
        const wake = () => { setVisible(!document.hidden); if (!document.hidden) void fetchLatest(); };
        document.addEventListener('visibilitychange', wake);
        window.addEventListener('online', wake);
        window.addEventListener('focus', wake);
        const poll = window.setInterval(() => { if (!document.hidden) void fetchLatest(); }, live ? 45000 : 4000);
        return () => { document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); window.removeEventListener('focus', wake); window.clearInterval(poll); };
    }, [live, fetchLatest]);

    const unseenIncoming = useMemo(() => messages.filter(m => m.sender_id !== uid && !m.seen_at).length, [messages, uid]);
    const marking = useRef(false);
    useEffect(() => {
        if (!viewing || !visible || !unseenIncoming || marking.current) return;
        marking.current = true;
        const stamp = new Date().toISOString();
        void Promise.resolve(supabase.rpc('chat_mark_seen')).then(({ error }) => {
            marking.current = false;
            if (!error) setMessages(prev => prev.map(m => m.sender_id !== uid && !m.seen_at ? { ...m, seen_at: stamp } : m));
        });
    }, [viewing, visible, unseenIncoming, uid]);

    const pendingAudio = useRef(new Map<string, Blob>());
    const sendWithVoice = async (m: ChatMsg, blob: Blob) => { try { if (!m.audio || !await uploadVoice(m.audio, blob)) throw Error(); await insert(m); } catch { setMessages(prev=>prev.map(x=>x.id===m.id?{...x,state:'failed'}:x)); } };
    const pending = useRef(new Map<string, Blob[]>());
    // Photos upload first (private bucket), then the message row points at them.
    const sendWithPhotos = useCallback(async (m: ChatMsg, blobs: Blob[]) => {
        const paths = await uploadImages(m.sender_id, m.id, blobs);
        if (!paths) { setMessages(prev => prev.map(x => x.id === m.id ? { ...x, state: 'failed' } : x)); return; }
        pending.current.delete(m.id);
        insert({ ...m, images: paths });
    }, []);
    const insert = useCallback(async (m: ChatMsg): Promise<boolean> => {
        try {
            let { data, error } = await supabase.from('chat_messages').insert({ id: m.id, body: m.body, sticker: m.sticker, gif_id: m.gif_id, reply_to: m.reply_to, images: m.images, audio: m.audio || null, song:m.song||null }).select(COLS).single();
            // A retry after a lost response reuses the same id, never a second message.
            if (error?.code === '23505') {
                const existing = await supabase.from('chat_messages').select(COLS).eq('id', m.id).single();
                if (existing.data?.sender_id === m.sender_id && existing.data?.gif_id === m.gif_id && (existing.data?.song?.id||null)===(m.song?.id||null) && (existing.data?.audio?.path||null)===(m.audio?.path||null)) { data = existing.data; error = existing.error; }
            }
            const row = !error && data ? clean(data) : null;
            if (!row) { setMessages(prev => prev.map(x => x.id === m.id ? { ...x, state: 'failed' } : x)); return false; }
            pendingAudio.current.delete(m.id);
            setMessages(prev => prev.map(x => x.id === m.id ? row : x).sort(byTime));
            return true;
        } catch { setMessages(prev => prev.map(x => x.id === m.id ? { ...x, state: 'failed' } : x)); return false; }
    }, []);

    const api = useMemo<ChatApi>(() => ({
        uid, messages, loaded, loadError, hasMore, live, partnerTyping, partnerOnline, unread: unseenIncoming, loadOlder,
        send: (body, sticker = null, replyTo = null) => {
            const text = body.trim().slice(0, 2000);
            if (!text && !sticker) return;
            const m: ChatMsg = { id: crypto.randomUUID(), sender_id: uid, recipient_id: partner.current ?? '', body: sticker ? '' : text, sticker, gif_id: null, reply_to: replyTo, reactions: {}, created_at: new Date().toISOString(), seen_at: null, edited_at: null, images: [], state: 'sending' };
            setMessages(prev => [...prev, m].sort(byTime));
            insert(m);
        },
        sendGif: async (gif_id, replyTo = null, messageId = crypto.randomUUID()) => {
            if (!isGifId(gif_id)) return false;
            const m: ChatMsg = { id: messageId, sender_id: uid, recipient_id: partner.current ?? '', body: '', sticker: null, gif_id, reply_to: replyTo, reactions: {}, created_at: new Date().toISOString(), seen_at: null, edited_at: null, images: [], state: 'sending' };
            setMessages(prev => [...prev.filter(x => x.id !== m.id), m].sort(byTime));
            return await insert(m);
        },
        sendSong: (value,replyTo=null)=>{const song=cleanSong(value);if(!song)return;const m:ChatMsg={id:crypto.randomUUID(),sender_id:uid,recipient_id:partner.current??'',body:'',sticker:null,gif_id:null,song,reply_to:replyTo,reactions:{},created_at:new Date().toISOString(),seen_at:null,edited_at:null,images:[],state:'sending'};setMessages(prev=>[...prev,m].sort(byTime));void insert(m);},
        sendVoice: (blob,duration,mime,peaks,replyTo=null) => {
            const id=crypto.randomUUID(),audio=cleanVoice({path:`${uid}/${id}.${voiceExt(mime)}`,duration,mime,peaks});
            if(!audio||!blob.size||blob.size>5*1024*1024)return;
            const m:ChatMsg={id,sender_id:uid,recipient_id:partner.current??'',body:'',sticker:null,gif_id:null,audio,reply_to:replyTo,reactions:{},created_at:new Date().toISOString(),seen_at:null,edited_at:null,images:[],state:'sending'};
            pendingAudio.current.set(id,blob);setMessages(prev=>[...prev,m].sort(byTime));void sendWithVoice(m,blob);
        },
        sendImages: (files, body, replyTo = null) => {
            const blobs = files.slice(0, 3);
            if (!blobs.length) return;
            const id = crypto.randomUUID();
            const paths = blobs.map((_, i) => `${uid}/${id}-${i}.jpg`);
            paths.forEach((p, i) => primeImage(p, URL.createObjectURL(blobs[i])));
            const m: ChatMsg = { id, sender_id: uid, recipient_id: partner.current ?? '', body: body.trim().slice(0, 2000), sticker: null, gif_id: null, reply_to: replyTo, reactions: {}, created_at: new Date().toISOString(), seen_at: null, edited_at: null, images: paths, state: 'sending' };
            pending.current.set(id, blobs);
            setMessages(prev => [...prev, m].sort(byTime));
            void sendWithPhotos(m, blobs);
        },
        retry: id => {
            const m = list.current.find(x => x.id === id); if (!m) return;
            setMessages(prev => prev.map(x => x.id === id ? { ...x, state: 'sending' } : x));
            const voiceBlob=pendingAudio.current.get(id);if(voiceBlob){void sendWithVoice(m,voiceBlob);return;}
            const blobs = pending.current.get(id);
            if (blobs) void sendWithPhotos(m, blobs); else insert(m);
        },
        discard: id => { const m=list.current.find(x=>x.id===id);if(m?.audio)void supabase.rpc('chat_remove_voice',{p_id:id,p_path:m.audio.path});pendingAudio.current.delete(id);pending.current.delete(id); setMessages(prev => prev.filter(m => m.id !== id)); },
        unsend: async id => {
            const old = list.current.find(m => m.id === id);
            if (!old || old.sender_id !== uid || old.state === 'sending') return false;
            if (old.audio) { try { const r=await supabase.rpc('chat_remove_voice',{p_id:id,p_path:old.audio.path});if(r.error)return false;pendingAudio.current.delete(id);setMessages(prev=>dropMessage(prev,id));return true; } catch{return false;} }
            if (old.state === 'failed') { pending.current.delete(id); setMessages(prev => dropMessage(prev, id)); return true; }
            try {
                const { error } = await supabase.from('chat_messages').delete().eq('id', id);
                if (error) return false;
                setMessages(prev => dropMessage(prev, id));
                if (old.images.length) removeImages(old.images);
                return true;
            } catch { return false; }
        },
        edit: (id, body) => {
            const text = body.trim().slice(0, 2000);
            const old = list.current.find(m => m.id === id);
            if (!old || old.song || old.audio || old.sticker || old.gif_id || !text || text === old.body) return;
            setMessages(prev => prev.map(m => m.id === id ? { ...m, body: text, edited_at: new Date().toISOString() } : m));
            void Promise.resolve(supabase.rpc('chat_edit', { p_id: id, p_body: text })).then(({ error }) => { if (error) merge([old]); });
        },
        react: (id, emoji) => {
            if (!isEmojiReaction(emoji)) return;
            if (list.current.find(m => m.id === id)?.reactions[uid] !== emoji) rememberReaction(uid, emoji);
            setMessages(prev => prev.map(m => {
                if (m.id !== id) return m;
                const r = { ...m.reactions };
                if (r[uid] === emoji) delete r[uid]; else r[uid] = emoji;
                return { ...m, reactions: r };
            }));
            void Promise.resolve(supabase.rpc('chat_react', { p_id: id, p_emoji: emoji })).then(({ error }) => { if (error) void fetchLatest(); });
        },
        typing,
        setViewing, reload: () => { void fetchLatest(); },
    }), [uid, messages, loaded, loadError, hasMore, live, partnerTyping, partnerOnline, unseenIncoming, typing, loadOlder, insert, sendWithPhotos, merge, fetchLatest]);
    return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
