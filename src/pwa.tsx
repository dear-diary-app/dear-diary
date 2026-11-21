import React, { useEffect, useState } from 'react';

// A new worker may activate immediately, but never reload over someone's writing.
export function registerDiaryShell() {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
            scope: import.meta.env.BASE_URL,
            updateViaCache: 'none',
        }).then(registration => {
            const check = () => {
                if (navigator.onLine && document.visibilityState === 'visible') {
                    void registration.update().catch(() => {});
                }
            };
            window.addEventListener('online', check);
            document.addEventListener('visibilitychange', check);
        }).catch(() => {
            // Unsupported or restricted browser storage must not block the diary.
        });
    }, { once: true });
}

export function OfflineNotice() {
    const [online, setOnline] = useState(navigator.onLine);
    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
    }, []);
    if (online) return null;
    return <div className="dd-offline-notice" role="status">You're offline. Connect to load and sync your diary.</div>;
}
