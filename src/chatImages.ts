import{chatSendError}from'./chatSendError';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

export const MAX_PHOTOS = 3;
const BUCKET = 'chat-images';
const cache = new Map<string, { url: string; exp: number }>();
const inflight = new Map<string, Promise<string | null>>();

/** Remember a ready-to-show URL (such as a local preview) so a photo you just sent never flashes. */
export function primeImage(path: string, url: string) { cache.set(path, { url, exp: Date.now() + 50 * 60000 }); }

export async function imageUrl(path: string): Promise<string | null> {
    const hit = cache.get(path);
    if (hit && hit.exp > Date.now()) return hit.url;
    const busy = inflight.get(path);
    if (busy) return busy;
    const p = (async () => {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
        if (error || !data?.signedUrl) return null;
        cache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60000 });
        return data.signedUrl;
    })().finally(() => inflight.delete(path));
    inflight.set(path, p);
    return p;
}

export function useChatImage(path: string) {
    const [url, setUrl] = useState<string | null>(() => { const h = cache.get(path); return h && h.exp > Date.now() ? h.url : null; });
    const [failed, setFailed] = useState(false);
    const [n, setN] = useState(0);
    useEffect(() => {
        let dead = false;
        setFailed(false);
        void imageUrl(path).then(u => { if (dead) return; if (u) setUrl(u); else setFailed(true); });
        return () => { dead = true; };
    }, [path, n]);
    return { url, failed, retry: () => { cache.delete(path); setUrl(null); setN(x => x + 1); } };
}

export async function uploadImages(uid: string, id: string, blobs: Blob[]): Promise<string[] | null> {
    const paths = blobs.map((_, i) => `${uid}/${id}-${i}.jpg`);
    for (let i = 0; i < blobs.length; i++) {
        const { error } = await supabase.storage.from(BUCKET).upload(paths[i], blobs[i], { contentType: 'image/jpeg' });
        // A retry after a half-finished send finds the file already there.
        if(error&&!/exist|duplicate/i.test(error.message))throw Error(chatSendError('photo',error));
    }
    return paths;
}

export function removeImages(paths: string[]) {
    if (paths.length) void Promise.resolve(supabase.storage.from(BUCKET).remove(paths)).catch(() => {});
}

export type PrepareError = 'type' | 'big' | 'decode';

/** Check the file is a real photo, then resize and compress it to a JPEG (EXIF location data is dropped). */
export async function prepareImage(file: File): Promise<Blob> {
    if (!file.type.startsWith('image/') || /svg/i.test(file.type)) throw new Error('type');
    if (file.size > 30 * 1024 * 1024) throw new Error('big');
    let src: ImageBitmap | HTMLImageElement;
    let w = 0, h = 0;
    try {
        src = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
        w = src.width; h = src.height;
    } catch {
        const url = URL.createObjectURL(file);
        try {
            src = await new Promise<HTMLImageElement>((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('decode')); im.src = url; });
            w = src.naturalWidth; h = src.naturalHeight;
        } catch { throw new Error('decode'); } finally { URL.revokeObjectURL(url); }
    }
    if (!w || !h) throw new Error('decode');
    const encode = (max: number, q: number) => new Promise<Blob | null>(done => {
        const k = Math.min(1, max / Math.max(w, h));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        const g = c.getContext('2d');
        if (!g) { done(null); return; }
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(src, 0, 0, c.width, c.height);
        c.toBlob(done, 'image/jpeg', q);
    });
    let out = await encode(1600, 0.82);
    if (out && out.size > 4 * 1024 * 1024) out = await encode(1280, 0.6);
    if (!out || out.size > 4.8 * 1024 * 1024) throw new Error('decode');
    if ('close' in src) src.close();
    return out;
}
