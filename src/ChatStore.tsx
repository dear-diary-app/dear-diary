import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

export interface ChatMsg {
    id: string; sender_id: string; recipient_id: string; body: string; sticker: string | null; reply_to: string | null;
    reactions: Record<string, string>; created_at: string; seen_at: string | null; state?: 'sending' | 'failed';
}
const COLS = 'id, sender_id, recipient_id, body, sticker, reply_to, reactions, created_at, seen_at';
const PAGE = 60;
const byTime = (a: ChatMsg, b: ChatMsg) => a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1;
function clean(r: unknown): ChatMsg | null {
    const m = r as Partial<ChatMsg> | null;
    if (!m || typeof m.id !== 'string' || typeof m.sender_id !== 'string' || typeof m.created_at !== 'string') return null;
    return { id: m.id, sender_id: m.sender_id, recipient_id: String(m.recipient_id ?? ''), body: typeof m.body === 'string' ? m.body : '', sticker: typeof m.sticker === 'string' ? m.sticker : null,
        reply_to: typeof m.reply_to === 'string' ? m.reply_to : null, reactions: m.reactions && typeof m.reactions === 'object' ? m.reactions as Record<string, string> : {},
        created_at: m.created_at, seen_at: typeof m.seen_at === 'string' ? m.seen_at : null };
}

export interface ChatApi {
    uid: string; messages: ChatMsg[]; loaded: boolean; loadError: boolean; hasMore: boolean; live: boolean; partnerTyping: boolean; unread: number;
    send: (body: string, sticker?: string | null, replyTo?: string | null) => void;
    retry: (id: string) => void; discard: (id: string) => void; unsend: (id: string) => void; react: (id: string, emoji: string) => void;
    loadOlder: () => Promise<void>; typing: (on: boolean) => void; setViewing: (on: boolean) => void; reload: () => void;
}
const Ctx = createContext<ChatApi | null>(null);
export const useChat = () => useContext(Ctx)!;

export function ChatProvider({ uid, children }: { uid: string; children: React.ReactNode }) {
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [live, setLive] = useState(false);
    const [partnerTyping, setPartnerTyping] = useState(false);
    const [viewing, setViewing] = useState(false);
    const [visible, setVisible] = useState(() => !document.hidden);
    const channel = useRef<RealtimeChannel | null>(null);
    const joined = useRef(false);
    const partner = useRef<string | null>(null);
    const list = useRef<ChatMsg[]>([]);
    const typingOff = useRef<number>();
    const lastTypingSent = useRef(0);
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
        let clear: number | undefined;
        (async () => {
            await fetchLatest();
            const { data: f } = await supabase.from('friendship').select('user1_id, user2_id').maybeSingle();
            if (dead || !f) return;
            const other = f.user1_id === uid ? f.user2_id : f.user1_id;
            partner.current = other;
            ch = supabase.channel(`dd-chat-${[uid, other].sort().join('-')}`, { config: { broadcast: { self: false } } })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, (p: { eventType: string; new: unknown; old: { id?: string } }) => {
                    if (p.eventType === 'DELETE') { const id = p.old?.id; if (id) setMessages(prev => prev.filter(m => m.id !== id)); return; }
                    merge([p.new]);
                    const m = clean(p.new);
                    if (m && m.sender_id !== uid) { setPartnerTyping(false); window.clearTimeout(clear); }
                })
                .on('broadcast', { event: 'typing' }, ({ payload }: { payload?: { uid?: string; on?: boolean } }) => {
                    if (payload?.uid !== other) return;
                    window.clearTimeout(clear);
                    setPartnerTyping(!!payload?.on);
                    if (payload?.on) clear = window.setTimeout(() => setPartnerTyping(false), 5000);
                })
                .subscribe((status: string) => {
                    const ok = status === 'SUBSCRIBED';
                    joined.current = ok; setLive(ok);
                    if (ok) void fetchLatest();
                });
            channel.current = ch;
        })();
        return () => { dead = true; joined.current = false; window.clearTimeout(clear); if (ch) void supabase.removeChannel(ch); channel.current = null; };
    }, [uid, fetchLatest, merge]);

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

    const insert = useCallback((m: ChatMsg) => {
        void Promise.resolve(supabase.from('chat_messages').insert({ id: m.id, body: m.body, sticker: m.sticker, reply_to: m.reply_to }).select(COLS).single()).then(({ data, error }) => {
            if (error || !data) { setMessages(prev => prev.map(x => x.id === m.id ? { ...x, state: 'failed' } : x)); return; }
            const row = clean(data);
            if (row) setMessages(prev => prev.map(x => x.id === m.id ? row : x).sort(byTime));
        });
    }, []);

    const api = useMemo<ChatApi>(() => ({
        uid, messages, loaded, loadError, hasMore, live, partnerTyping, unread: unseenIncoming, loadOlder,
        send: (body, sticker = null, replyTo = null) => {
            const text = body.trim().slice(0, 2000);
            if (!text && !sticker) return;
            const m: ChatMsg = { id: crypto.randomUUID(), sender_id: uid, recipient_id: partner.current ?? '', body: sticker ? '' : text, sticker, reply_to: replyTo, reactions: {}, created_at: new Date().toISOString(), seen_at: null, state: 'sending' };
            setMessages(prev => [...prev, m].sort(byTime));
            insert(m);
        },
        retry: id => { const m = list.current.find(x => x.id === id); if (!m) return; setMessages(prev => prev.map(x => x.id === id ? { ...x, state: 'sending' } : x)); insert(m); },
        discard: id => setMessages(prev => prev.filter(m => m.id !== id)),
        unsend: id => {
            const old = list.current.find(m => m.id === id);
            setMessages(prev => prev.filter(m => m.id !== id));
            void Promise.resolve(supabase.from('chat_messages').delete().eq('id', id)).then(({ error }) => { if (error && old) merge([old]); });
        },
        react: (id, emoji) => {
            setMessages(prev => prev.map(m => {
                if (m.id !== id) return m;
                const r = { ...m.reactions };
                if (r[uid] === emoji) delete r[uid]; else r[uid] = emoji;
                return { ...m, reactions: r };
            }));
            void Promise.resolve(supabase.rpc('chat_react', { p_id: id, p_emoji: emoji })).then(({ error }) => { if (error) void fetchLatest(); });
        },
        typing: on => {
            const ch = channel.current;
            window.clearTimeout(typingOff.current);
            if (!ch || !joined.current) return;
            const now = Date.now();
            if (on) {
                if (now - lastTypingSent.current > 2500) { lastTypingSent.current = now; void ch.send({ type: 'broadcast', event: 'typing', payload: { uid, on: true } }); }
                typingOff.current = window.setTimeout(() => { lastTypingSent.current = 0; void ch.send({ type: 'broadcast', event: 'typing', payload: { uid, on: false } }); }, 3000);
            } else { lastTypingSent.current = 0; void ch.send({ type: 'broadcast', event: 'typing', payload: { uid, on: false } }); }
        },
        setViewing, reload: () => { void fetchLatest(); },
    }), [uid, messages, loaded, loadError, hasMore, live, partnerTyping, unseenIncoming, loadOlder, insert, merge, fetchLatest]);
    return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
