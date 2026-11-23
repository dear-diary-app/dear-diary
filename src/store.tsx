import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { cleanSong, type Song } from './Song';
import { setPrivacyAccount } from './privacy';
import { disableDevicePush } from './PushSettings';
import { cleanStickers, Sticker } from './Stickers';
import { Entry, PersonId, ekey, isReadable, latestReadable, otherId, todayKey } from './model';

// ---------- auth ----------

interface Auth {
    session: Session | null;
    me: PersonId | null;
    ready: boolean;
    loadError: string;
    retryAuth: () => void;
    signIn: (email: string, password: string) => Promise<string | null>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<string | null>;
}

const AuthCtx = createContext<Auth | null>(null);
export const useAuth = () => useContext(AuthCtx)!;

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [sessionReady, setSessionReady] = useState(false);
    const [profile, setProfile] = useState<{ uid: string; me: PersonId | null } | null>(null);
    const [loadError, setLoadError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const me = profile?.uid === session?.user.id ? profile?.me ?? null : null;
    useEffect(() => { setPrivacyAccount(session?.user.id ?? null); }, [session?.user.id]);
    const ready = sessionReady && (!session || profile?.uid === session.user.id);

    useEffect(() => {
        let active = true;
        let eventSeen = false;
        const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
            if (!active) return;
            eventSeen = true;
            setSession(next); setSessionReady(true);
        });
        void supabase.auth.getSession().then(({ data, error }) => {
            if (!active || eventSeen) return;
            if (error) { setLoadError('Could not restore your session. Check your connection and retry.'); return; }
            setSession(data.session); setSessionReady(true);
        }).catch(() => { if (active) setLoadError('Could not restore your session. Check your connection and retry.'); });
        return () => { active = false; sub.subscription.unsubscribe(); };
    }, [attempt]);

    useEffect(() => {
        let active = true;
        setLoadError('');
        if (!session) { setProfile(null); return; }
        const uid = session.user.id;
        void supabase.from('profiles').select('username').eq('id', uid).maybeSingle()
            .then(({ data, error }) => {
                if (!active) return;
                if (error) { setLoadError('Could not open your account. Check your connection and retry.'); return; }
                const u = data?.username;
                if (u !== 'joydeep' && u !== 'aruba') { setLoadError('Your diary profile is not available. Retry or sign out.'); return; }
                setProfile({ uid, me: u });
            });
        return () => { active = false; };
    }, [session?.user.id, attempt]);

    const auth: Auth = {
        session, me, ready, loadError, retryAuth: () => { setLoadError(''); setAttempt(n => n + 1); },
        signIn: async (email, password) => {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            return error ? error.message : null;
        },
        signOut: async () => { try { await disableDevicePush(); } catch { /* Permission can also be revoked in browser settings. */ } await supabase.auth.signOut(); },
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
    refreshEntries: () => Promise<void>;
    entries: Record<string, Entry>;
    saveText: (p: PersonId, d: string, text: string) => void;
    saveStickers: (p: PersonId, d: string, stickers: Sticker[]) => void;
    saveSong: (p: PersonId, d: string, song: Song | null) => void;
    retrySave: (p: PersonId, d: string) => void;
    addPhoto: (p: PersonId, d: string, file: File) => Promise<void>;
    removePhoto: (p: PersonId, d: string, idx: number) => void;
    reactions: Record<string, Record<string, string>>;
    saveState: Record<string, 'saving' | 'saved' | 'error'>;
    toggleReact: (owner: PersonId, d: string, reader: PersonId, emoji: string) => void;
    readSet: Record<string, true>;
    markRead: (owner: PersonId, d: string, reader: PersonId) => void;
    unreadLatest: (reader: PersonId, now: Date) => string | null;
    unreadAny: (now: Date) => boolean;
    avatarPhotos: Partial<Record<PersonId, string>>;
    uploadAvatar: (p: PersonId, file: File, crop?: { x: number; y: number; width: number; height: number }) => Promise<void>;
    avatars: Record<PersonId, number>;
    setAvatar: (p: PersonId, n: number) => void;
    notifPrefs: Record<string, boolean>;
    setNotifPref: (k: string, v: boolean) => void;
    notifSaving: boolean;
    notifMessage: string;
}

const StoreCtx = createContext<Store | null>(null);
export const useStore = () => useContext(StoreCtx)!;

interface Row { id: string; user_id: string; entry_date: string; content: string; status: string; stickers: unknown; song?: unknown }
interface PhotoRow { id: string; entry_id: string; storage_path: string; sort_order: number }
interface ReactionRow { entry_id: string; user_id: string; reaction_type: string }

export function StoreProvider({ me, children }: { me: PersonId; children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<Record<string, Entry>>({});
    const [reactions, setReactions] = useState<Record<string, Record<string, string>>>({});
    const [saveState, setSaveState] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
    const [readSet, setReadSet] = useState<Record<string, true>>({});
    const [avatarPhotos, setAvatarPhotos] = useState<Partial<Record<PersonId, string>>>({});
    const [avatars, setAvatars] = useState<Record<PersonId, number>>({ joydeep: 0, aruba: 1 });
    const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({ open: true, writing: false, lock: true, published: true, reaction: true, chat: true, chatPreview: false, chatReply: false, friendFree: false });
    const [notifSaving, setNotifSaving] = useState(false);
    const [notifMessage, setNotifMessage] = useState('');
    const notifPending = useRef(false);
    const entryIds = useRef<Record<string, string>>({}); // ekey -> entry id
    const photoIds = useRef<Record<string, string[]>>({}); // ekey -> photo ids in order
    const userIds = useRef<Record<PersonId, string>>({} as Record<PersonId, string>);
    const drafts = useRef<Record<string, { text: string; stickers: Sticker[]; song: Song | null; version: number }>>({});
    const inFlight = useRef<Record<string, boolean>>({});
    const saveTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    async function loadAvatarPictures(profiles: any[]) {
        await Promise.all(profiles.map(async (pr: any) => {
            if (!['joydeep', 'aruba'].includes(pr.username) || !pr.avatar_url?.startsWith('pic:')) return;
            const path = pr.avatar_url.slice(4);
            const { data } = await supabase.storage.from('profile-pictures').createSignedUrl(path, 3600);
            if (data?.signedUrl) setAvatarPhotos(prev => ({ ...prev, [pr.username]: data.signedUrl }));
        }));
    }
    useEffect(() => {
        const refresh = async () => {
            const { data } = await supabase.from('profiles').select('username, avatar_url');
            if (data) await loadAvatarPictures(data);
        };
        const timer = setInterval(refresh, 45 * 60 * 1000);
        const visible = () => { if (document.visibilityState === 'visible') refresh(); };
        document.addEventListener('visibilitychange', visible);
        return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
    }, [me]);

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
        await loadAvatarPictures(profs ?? []);
        const uid = userIds.current[me];
        if (uid) {
            const { data: settings } = await supabase.from('app_settings').select('notifications, read_entries').eq('user_id', uid).maybeSingle();
            if (settings?.notifications) setNotifPrefs(prev => ({ ...prev, ...(settings.notifications as Record<string, boolean>) }));
            if (settings?.read_entries) setReadSet(settings.read_entries as Record<string, true>);
        }
        await reloadEntries();
        setLoading(false);
    }

    async function reloadEntries() {
        const { data: rows } = await supabase.from('diary_entries').select('id, user_id, entry_date, content, status, stickers, song');
        const list = (rows ?? []) as Row[];
        const byId: Record<string, PersonId> = {};
        (Object.entries(userIds.current) as [PersonId, string][]).forEach(([p, id]) => { byId[id] = p; });
        const next: Record<string, Entry> = {};
        entryIds.current = {};
        list.forEach(r => {
            const person = byId[r.user_id];
            if (!person) return;
            const k = ekey(person, r.entry_date);
            next[k] = { date: r.entry_date, person, text: r.content, photos: [], stickers: cleanStickers(r.stickers), song: cleanSong(r.song), status: r.status as Entry['status'] };
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
        // Restore any locally buffered text that never reached the server.
        try {
            const k = ekey(me, todayKey());
            const raw = localStorage.getItem(`dd_draft_${k}`);
            if (raw) {
                const draft = JSON.parse(raw) as { text: string; stickers?: Sticker[]; song?: unknown };
                if (typeof draft.text === 'string' && (draft.text !== next[k]?.text || JSON.stringify(cleanSong(draft.song)) !== JSON.stringify(next[k]?.song ?? null) || (Array.isArray(draft.stickers) && JSON.stringify(draft.stickers) !== JSON.stringify(next[k]?.stickers ?? [])))) {
                    store_save(me, todayKey(), draft.text, Array.isArray(draft.stickers) ? cleanStickers(draft.stickers) : next[k]?.stickers ?? [], cleanSong(draft.song));
                }
            }
        } catch { /* ignore */ }
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

    async function flush(p: PersonId, d: string) {
        const k = ekey(p,d);
        if (inFlight.current[k]) return;
        const draft = drafts.current[k];
        const uid = userIds.current[p];
        if (!draft || !uid) return;
        inFlight.current[k] = true;
        const { data, error } = await supabase.from('diary_entries')
            .upsert({ user_id: uid, entry_date: d, content: draft.text, stickers: draft.stickers, song: draft.song, status: 'draft' }, { onConflict: 'user_id,entry_date' }).select('id').single();
        inFlight.current[k] = false;
        if (error) { setSaveState(prev => ({ ...prev, [k]: 'error' })); return; }
        if (data) entryIds.current[k] = data.id;
        if (drafts.current[k]?.version !== draft.version) { void flush(p,d); return; }
        try { localStorage.removeItem(`dd_draft_${k}`); } catch { /* ignore */ }
        setSaveState(prev => ({ ...prev, [k]: 'saved' }));
    }
    const store_save = (p: PersonId, d: string, text: string, stickers?: Sticker[], song?: Song | null) => {
        if (p !== me) return;
        const k = ekey(p,d);
        const nextStickers = stickers ?? drafts.current[k]?.stickers ?? entries[k]?.stickers ?? [];
        const nextSong = song !== undefined ? song : drafts.current[k]?.song !== undefined ? drafts.current[k].song : entries[k]?.song ?? null;
        const draft = { text, stickers: nextStickers, song: nextSong, version: (drafts.current[k]?.version ?? 0) + 1 };
        drafts.current[k] = draft;
        setEntries(prev => ({ ...prev, [k]: { ...prev[k], date:d, person:p, text, stickers:nextStickers, song:nextSong, photos:prev[k]?.photos ?? [], status:prev[k]?.status ?? 'draft' } }));
        try { localStorage.setItem(`dd_draft_${k}`,JSON.stringify(draft)); } catch { /* full */ }
        setSaveState(prev => ({ ...prev,[k]:'saving' }));
        clearTimeout(saveTimer.current[k]);
        saveTimer.current[k] = setTimeout(() => { void flush(p,d); },700);
    };

    const store: Store = {
        loading, refreshEntries: reloadEntries, entries, reactions, saveState, readSet, avatars, avatarPhotos, notifPrefs,
        saveText: store_save,
        saveStickers: (p,d,stickers) => store_save(p,d,drafts.current[ekey(p,d)]?.text ?? entries[ekey(p,d)]?.text ?? '',cleanStickers(stickers)),
        saveSong: (p,d,song) => store_save(p,d,drafts.current[ekey(p,d)]?.text ?? entries[ekey(p,d)]?.text ?? '',undefined,cleanSong(song)),
        retrySave: (p, d) => {
            const k = ekey(p, d);
            const text = entries[k]?.text;
            if (typeof text === 'string') store_save(p, d, text, drafts.current[k]?.stickers ?? entries[k]?.stickers ?? []);
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
        markRead: (owner, d, reader) => {
            const key = `${owner}|${d}|${reader}`;
            setReadSet(prev => {
                if (prev[key]) return prev;
                const next = { ...prev, [key]: true as const };
                const uid = userIds.current[me];
                if (uid) supabase.from('app_settings').upsert({ user_id: uid, read_entries: next }, { onConflict: 'user_id' }).then(() => {});
                return next;
            });
        },
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
        uploadAvatar: async (p, file, crop) => {
            if (p !== me) throw new Error('Only your own picture can be changed.');
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP photo.');
            if (file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
            const uid = userIds.current[p];
            if (!uid) throw new Error('Your profile is still loading. Please try again.');
            const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
            const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
            const ctx = canvas.getContext('2d');
            if (!ctx) { bitmap.close(); throw new Error('Could not prepare this image.'); }
            const size = Math.min(bitmap.width, bitmap.height);
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 512, 512);
            const c = crop ?? { x: (bitmap.width-size)/2, y: (bitmap.height-size)/2, width: size, height: size };
            ctx.drawImage(bitmap, c.x, c.y, c.width, c.height, 0, 0, 512, 512);
            bitmap.close();
            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not prepare this image.')), 'image/jpeg', 0.85));
            const path = `${uid}/${crypto.randomUUID()}.jpg`;
            const { error: uploadError } = await supabase.storage.from('profile-pictures').upload(path, blob, { contentType: 'image/jpeg' });
            if (uploadError) throw new Error('Photo upload failed. Please try again.');
            const { data: old } = await supabase.from('profiles').select('avatar_url').eq('id', uid).single();
            const { data: saved, error } = await supabase.from('profiles').update({ avatar_url: `pic:${path}` }).eq('id', uid).select('id').single();
            if (error || !saved) { await supabase.storage.from('profile-pictures').remove([path]); throw new Error('Could not save the picture. Please try again.'); }
            const { data } = await supabase.storage.from('profile-pictures').createSignedUrl(path, 3600);
            if (data?.signedUrl) setAvatarPhotos(prev => ({ ...prev, [p]: data.signedUrl }));
            if (old?.avatar_url?.startsWith('pic:')) await supabase.storage.from('profile-pictures').remove([old.avatar_url.slice(4)]);
        },
        setAvatar: (p, n) => {
            if (p !== me) return;
            setAvatars(prev => ({ ...prev, [p]: n }));
            const uid = userIds.current[p];
            if (uid && !avatarPhotos[p]) supabase.from('profiles').update({ avatar_url: `av:${n}` }).eq('id', uid).then(() => {});
        },
        notifSaving, notifMessage,
        setNotifPref: (k, v) => {
            if (notifPending.current) return;
            const previous = notifPrefs;
            const next = { ...notifPrefs, [k]: v };
            setNotifPrefs(next);
            const uid = userIds.current[me];
            if (!uid) { setNotifPrefs(previous); setNotifMessage('Account is still loading. Try again.'); return; }
            notifPending.current=true; setNotifSaving(true); setNotifMessage('Saving notification choices...');
            supabase.from('app_settings').upsert({ user_id: uid, notifications: next }, { onConflict: 'user_id' }).then(({error}) => {
                if (error) { setNotifPrefs(previous); setNotifMessage('Could not save. Your previous choices remain. Try again when connected.'); }
                else setNotifMessage('Notification choices saved.');
                notifPending.current=false; setNotifSaving(false);
            });
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
export async function pinStatus(person: PersonId): Promise<{ hasPin: boolean; locked: boolean; unavailable?: boolean }> {
    // On a fresh page load the session restore is async; wait briefly for it.
    let session = (await supabase.auth.getSession()).data.session;
    for (let i = 0; i < 40 && !session; i++) {
        await new Promise(r => setTimeout(r, 250));
        session = (await supabase.auth.getSession()).data.session;
    }
    if (!session) return { hasPin: true, locked: false, unavailable: true }; // No claim about PIN state when status cannot be checked
    // Use the same authenticated PostgREST transport as profiles and entries.
    // A status read must not depend on the separate PIN verification service.
    for (let attempt = 0; attempt < 2; attempt++) {
        const { data, error } = await supabase.rpc('diary_pin_status', { p_person: person });
        if (!error && data && typeof data.hasPin === 'boolean') {
            return { hasPin: data.hasPin, locked: !!data.locked };
        }
        if (attempt === 0) {
            // Retry once after restoring auth. Never turn a failed read into a PIN claim.
            await supabase.auth.refreshSession();
        }
    }
    return { hasPin: true, locked: false, unavailable: true };
}

export async function verifyPin(pin: string, mode: 'verify' | 'set', person?: PersonId, current?: string): Promise<{ ok: boolean; error?: string; attemptsLeft?: number; noPin?: boolean }> {
    // On a fresh page load the session restore is async; wait briefly for it.
    let session = (await supabase.auth.getSession()).data.session;
    for (let i = 0; i < 40 && !session; i++) {
        await new Promise(r => setTimeout(r, 250));
        session = (await supabase.auth.getSession()).data.session;
    }
    if (!session) return { ok: false, error: 'signed_out' };
    const call = (token: string) => fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin, mode, person, current }),
    });
    let res = await call(session.access_token);
    if (res.status === 401 && (await res.clone().json().catch(() => ({}))).error === 'unauthorized') {
        // Cached token can be stale right after a session restore; refresh and retry once.
        const { data } = await supabase.auth.refreshSession();
        if (data.session) res = await call(data.session.access_token);
    }
    if (res.status === 404) return { ok: false, noPin: true };
    if (res.status === 429) return { ok: false, error: 'locked' };
    if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        return { ok: false, error: b.error ?? 'wrong', attemptsLeft: b.attempts_left };
    }
    return { ok: true };
}
