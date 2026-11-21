import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Entry, PersonId, ekey, isReadable, latestReadable, otherId, todayKey } from './model';

// ---------- auth ----------

interface Auth {
    session: Session | null;
    me: PersonId | null;
    ready: boolean;
    signIn: (email: string, password: string) => Promise<string | null>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<string | null>;
}

const AuthCtx = createContext<Auth | null>(null);
export const useAuth = () => useContext(AuthCtx)!;

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [me, setMe] = useState<PersonId | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
        return () => sub.subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!session) { setMe(null); return; }
        supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle()
            .then(({ data }) => {
                const u = data?.username;
                setMe(u === 'joydeep' || u === 'aruba' ? u : null);
            });
    }, [session?.user.id]);

    const auth: Auth = {
        session, me, ready,
        signIn: async (email, password) => {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            return error ? error.message : null;
        },
        signOut: async () => { await supabase.auth.signOut(); },
        resetPassword: async (email) => {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/#reset',
            });
            return error ? error.message : null;
        },
    };
    return <AuthCtx.Provider value={auth}>{children}</AuthCtx.Provider>;
}

// ---------- diary store (Supabase-backed) ----------

export interface Store {
    loading: boolean;
    entries: Record<string, Entry>;
    saveText: (p: PersonId, d: string, text: string) => void;
    addPhoto: (p: PersonId, d: string, file: File) => Promise<void>;
    removePhoto: (p: PersonId, d: string, idx: number) => void;
    reactions: Record<string, Record<string, string>>;
    toggleReact: (owner: PersonId, d: string, reader: PersonId, emoji: string) => void;
    readSet: Record<string, true>;
    markRead: (owner: PersonId, d: string, reader: PersonId) => void;
    unreadLatest: (reader: PersonId, now: Date) => string | null;
    unreadAny: (now: Date) => boolean;
    avatars: Record<PersonId, number>;
    setAvatar: (p: PersonId, n: number) => void;
    notifPrefs: Record<string, boolean>;
    setNotifPref: (k: string, v: boolean) => void;
}

const StoreCtx = createContext<Store | null>(null);
export const useStore = () => useContext(StoreCtx)!;

interface Row { id: string; user_id: string; entry_date: string; content: string; status: string }
interface PhotoRow { id: string; entry_id: string; storage_path: string; sort_order: number }
interface ReactionRow { entry_id: string; user_id: string; reaction_type: string }

export function StoreProvider({ me, children }: { me: PersonId; children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<Record<string, Entry>>({});
    const [reactions, setReactions] = useState<Record<string, Record<string, string>>>({});
    const [readSet, setReadSet] = useState<Record<string, true>>({});
    const [avatars, setAvatars] = useState<Record<PersonId, number>>({ joydeep: 0, aruba: 1 });
    const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({ open: true, lock: true, published: true, reaction: true });
    const entryIds = useRef<Record<string, string>>({}); // ekey -> entry id
    const photoIds = useRef<Record<string, string[]>>({}); // ekey -> photo ids in order
    const userIds = useRef<Record<PersonId, string>>({} as Record<PersonId, string>);
    const saveTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    async function loadAll() {
        setLoading(true);
        const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url');
        (profs ?? []).forEach((pr: any) => {
            if (pr.username === 'joydeep' || pr.username === 'aruba') {
                userIds.current[pr.username as PersonId] = pr.id;
                const m = /^av:(\d+)$/.exec(pr.avatar_url ?? '');
                if (m) setAvatars(prev => ({ ...prev, [pr.username]: +m[1] }));
            }
        });
        const uid = userIds.current[me];
        if (uid) {
            const { data: settings } = await supabase.from('app_settings').select('notifications').eq('user_id', uid).maybeSingle();
            if (settings?.notifications) setNotifPrefs(prev => ({ ...prev, ...(settings.notifications as Record<string, boolean>) }));
        }
        await reloadEntries();
        setLoading(false);
    }

    async function reloadEntries() {
        const { data: rows } = await supabase.from('diary_entries').select('id, user_id, entry_date, content, status');
        const list = (rows ?? []) as Row[];
        const byId: Record<string, PersonId> = {};
        (Object.entries(userIds.current) as [PersonId, string][]).forEach(([p, id]) => { byId[id] = p; });
        const next: Record<string, Entry> = {};
        entryIds.current = {};
        list.forEach(r => {
            const person = byId[r.user_id];
            if (!person) return;
            const k = ekey(person, r.entry_date);
            next[k] = { date: r.entry_date, person, text: r.content, photos: [], status: r.status as Entry['status'] };
            entryIds.current[k] = r.id;
        });
        const ids = list.map(r => r.id);
        if (ids.length) {
            const { data: photos } = await supabase.from('entry_photos').select('id, entry_id, storage_path, sort_order').in('entry_id', ids).order('sort_order');
            const { data: reacts } = await supabase.from('reactions').select('entry_id, user_id, reaction_type').in('entry_id', ids);
            const rnext: Record<string, Record<string, string>> = {};
            (reacts ?? []).forEach((r: ReactionRow) => {
                const k = Object.keys(entryIds.current).find(key => entryIds.current[key] === r.entry_id);
                const rp = byId[r.user_id];
                if (k && rp) rnext[k] = { ...(rnext[k] ?? {}), [rp]: r.reaction_type };
            });
            setReactions(rnext);
            for (const ph of (photos ?? []) as PhotoRow[]) {
                const k = Object.keys(entryIds.current).find(key => entryIds.current[key] === ph.entry_id);
                if (!k) continue;
                const { data: signed } = await supabase.storage.from('diary-photos').createSignedUrl(ph.storage_path, 3600);
                if (signed?.signedUrl) {
                    const e = next[k];
                    e.photos = [...e.photos, signed.signedUrl];
                    photoIds.current[k] = [...(photoIds.current[k] ?? []), ph.id];
                }
            }
        }
        setEntries(next);
    }

    useEffect(() => { loadAll(); }, [me]);

    async function ensureEntryId(p: PersonId, d: string): Promise<string | null> {
        const k = ekey(p, d);
        if (entryIds.current[k]) return entryIds.current[k];
        const uid = userIds.current[p];
        if (!uid) return null;
        const { data, error } = await supabase.from('diary_entries')
            .upsert({ user_id: uid, entry_date: d, content: entries[k]?.text ?? '', status: 'draft' }, { onConflict: 'user_id,entry_date' })
            .select('id').single();
        if (error || !data) return null;
        entryIds.current[k] = data.id;
        return data.id;
    }

    const store: Store = {
        loading, entries, reactions, readSet, avatars, notifPrefs,
        saveText: (p, d, text) => {
            setEntries(prev => ({ ...prev, [ekey(p, d)]: { date: d, person: p, text, photos: prev[ekey(p, d)]?.photos ?? [], status: prev[ekey(p, d)]?.status ?? 'draft' } }));
            const k = ekey(p, d);
            clearTimeout(saveTimer.current[k]);
            saveTimer.current[k] = setTimeout(async () => {
                const uid = userIds.current[p];
                if (!uid) return;
                const { data } = await supabase.from('diary_entries')
                    .upsert({ user_id: uid, entry_date: d, content: text, status: 'draft' }, { onConflict: 'user_id,entry_date' })
                    .select('id').single();
                if (data) entryIds.current[k] = data.id;
            }, 700);
        },
        addPhoto: async (p, d, file) => {
            const k = ekey(p, d);
            const entryId = await ensureEntryId(p, d);
            const uid = userIds.current[p];
            if (!entryId || !uid) return;
            const path = `${uid}/${entryId}/${crypto.randomUUID()}`;
            const { error } = await supabase.storage.from('diary-photos').upload(path, file);
            if (error) return;
            const { data: row } = await supabase.from('entry_photos')
                .insert({ entry_id: entryId, storage_path: path, sort_order: (photoIds.current[k] ?? []).length })
                .select('id').single();
            const { data: signed } = await supabase.storage.from('diary-photos').createSignedUrl(path, 3600);
            if (signed?.signedUrl && row) {
                setEntries(prev => ({ ...prev, [k]: { ...prev[k], photos: [...(prev[k]?.photos ?? []), signed.signedUrl] } }));
                photoIds.current[k] = [...(photoIds.current[k] ?? []), row.id];
            }
        },
        removePhoto: (p, d, idx) => {
            const k = ekey(p, d);
            const id = photoIds.current[k]?.[idx];
            if (id) supabase.from('entry_photos').delete().eq('id', id).then(() => {});
            photoIds.current[k] = (photoIds.current[k] ?? []).filter((_, i) => i !== idx);
            setEntries(prev => {
                const cur = prev[k];
                if (!cur) return prev;
                return { ...prev, [k]: { ...cur, photos: cur.photos.filter((_, i) => i !== idx) } };
            });
        },
        toggleReact: (owner, d, reader, emoji) => {
            const k = ekey(owner, d);
            const cur = { ...(reactions[k] ?? {}) };
            const removing = cur[reader] === emoji;
            if (removing) delete cur[reader]; else cur[reader] = emoji;
            setReactions(prev => ({ ...prev, [k]: cur }));
            const entryId = entryIds.current[k];
            const uid = userIds.current[reader];
            if (!entryId || !uid) return;
            if (removing) supabase.from('reactions').delete().eq('entry_id', entryId).eq('user_id', uid).then(() => {});
            else supabase.from('reactions').upsert({ entry_id: entryId, user_id: uid, reaction_type: emoji }, { onConflict: 'entry_id,user_id' }).then(() => {});
        },
        markRead: (owner, d, reader) => setReadSet(prev => ({ ...prev, [`${owner}|${d}|${reader}`]: true })),
        unreadLatest: (reader, now) => {
            const owner = otherId(reader);
            const latest = latestReadable(now);
            const e = entries[ekey(owner, latest)];
            return e && e.status === 'published' && !readSet[`${owner}|${latest}|${reader}`] ? latest : null;
        },
        unreadAny: now => Boolean(
            (['joydeep', 'aruba'] as PersonId[]).some(r => {
                const owner = otherId(r);
                const latest = latestReadable(now);
                const e = entries[ekey(owner, latest)];
                return e && e.status === 'published' && !readSet[`${owner}|${latest}|${r}`];
            })),
        setAvatar: (p, n) => {
            setAvatars(prev => ({ ...prev, [p]: n }));
            const uid = userIds.current[p];
            if (uid) supabase.from('profiles').update({ avatar_url: `av:${n}` }).eq('id', uid).then(() => {});
        },
        setNotifPref: (k, v) => {
            const next = { ...notifPrefs, [k]: v };
            setNotifPrefs(next);
            const uid = userIds.current[me];
            if (uid) supabase.from('app_settings').upsert({ user_id: uid, notifications: next }, { onConflict: 'user_id' }).then(() => {});
        },
    };
    return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;
}

// PIN unlock state (per session, per person)
export function isUnlocked(p: PersonId): boolean {
    return sessionStorage.getItem(`dd_unlocked_${p}`) === '1';
}
export function setUnlocked(p: PersonId) {
    sessionStorage.setItem(`dd_unlocked_${p}`, '1');
}
export async function verifyPin(pin: string, mode: 'verify' | 'set'): Promise<{ ok: boolean; error?: string; attemptsLeft?: number; noPin?: boolean }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: 'signed_out' };
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ pin, mode }),
    });
    if (res.status === 404) return { ok: false, noPin: true };
    if (res.status === 429) return { ok: false, error: 'locked' };
    if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        return { ok: false, error: b.error ?? 'wrong', attemptsLeft: b.attempts_left };
    }
    return { ok: true };
}
