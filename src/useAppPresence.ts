import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

/** A visible, focused app refreshes a server-timed 35s lease every 15s.
 * Hidden/offline sessions stop immediately when the request can reach the server.
 * Lost connections expire, and each tab/device has its own lease. No last-seen UI.
 */
export function useAppPresence(uid: string) {
    const [online, setOnline] = useState(false);
    useEffect(() => {
        const session = crypto.randomUUID();
        let alive = true, busy = false, again = false, revision = 0;
        const foreground = () => alive && !document.hidden && document.hasFocus() && navigator.onLine;
        let desired = foreground();
        let reading=false;
        const readPartner=async()=>{if(reading||!foreground())return;reading=true;const version=revision;const ctl=new AbortController(),limit=window.setTimeout(()=>ctl.abort(),4000);try{const r=await supabase.rpc('chat_partner_online').abortSignal(ctl.signal);if(alive&&version===revision)setOnline(!r.error&&r.data===true);}catch{if(alive&&version===revision)setOnline(false);}finally{reading=false;clearTimeout(limit);}};
        setOnline(false);
        const update = async () => {
            if (busy) { again = true; return; }
            busy = true;
            do {
                again = false;
                const active = desired, version = revision;
                const controller = new AbortController();
                const timeout = window.setTimeout(() => controller.abort(), 6000);
                try {
                    const { data, error } = await supabase.rpc('chat_presence', { p_session: session, p_online: active }).abortSignal(controller.signal);
                    if (alive && version === revision) setOnline(active && !error && data === true);
                    if(!error)window.dispatchEvent(new CustomEvent('dd-presence-published',{detail:{uid,active}}));
                } catch { if (alive && version === revision) setOnline(false); }
                finally { window.clearTimeout(timeout); }
            } while (again);
            busy = false;
        };
        const changed = () => {
            const next = foreground();
            if (next === desired) return;
            desired = next; revision++;
            if (!next) setOnline(false);
            void update();
        };
        const leave = () => { desired = false; revision++; setOnline(false); void update(); };
        document.addEventListener('visibilitychange', changed);
        window.addEventListener('focus', changed); window.addEventListener('blur', changed);
        window.addEventListener('online', changed); window.addEventListener('offline', changed);
        window.addEventListener('pagehide', leave); window.addEventListener('pageshow', changed);
        const check=()=>void readPartner();
        const reconnect=()=>void update();
        window.addEventListener('dd-presence-check',check);window.addEventListener('dd-presence-reconnect',reconnect);
        const reader=window.setInterval(()=>{if(location.hash.startsWith('#/chat'))void readPartner();},3000);
        void update();
        const timer = window.setInterval(() => { if (foreground()) void update(); }, 15000);
        return () => {
            alive = false; desired = false; revision++;
            window.clearInterval(timer);window.clearInterval(reader);window.removeEventListener('dd-presence-check',check);window.removeEventListener('dd-presence-reconnect',reconnect);
            document.removeEventListener('visibilitychange', changed);
            window.removeEventListener('focus', changed); window.removeEventListener('blur', changed);
            window.removeEventListener('online', changed); window.removeEventListener('offline', changed);
            window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', changed);
            void update();
        };
    }, [uid]);
    return online;
}
