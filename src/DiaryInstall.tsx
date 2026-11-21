import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight } from './icons';

type InstallEvent = Event & {
    prompt: () => Promise<unknown>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
let deferredPrompt: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const standalone = () => installed || window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;

// Capture before Settings mounts, including events that arrive on the sign-in screen.
export function registerDiaryInstall() {
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        deferredPrompt = event as InstallEvent;
        notify();
    });
    window.addEventListener('appinstalled', () => {
        installed = true;
        deferredPrompt = null;
        notify();
    });
}

export function DiaryInstall() {
    const [, refresh] = useState(0);
    const [busy, setBusy] = useState(false);
    const [guide, setGuide] = useState(false);
    const [notice, setNotice] = useState('');
    const dialog = useRef<HTMLDialogElement>(null);
    const pending = useRef(false);
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    useEffect(() => {
        const update = () => refresh(n => n + 1);
        listeners.add(update);
        const media = window.matchMedia('(display-mode: standalone)');
        media.addEventListener('change', update);
        return () => { listeners.delete(update); media.removeEventListener('change', update); };
    }, []);
    useEffect(() => {
        if (guide && !standalone()) dialog.current?.showModal();
    }, [guide]);
    const install = async () => {
        if (pending.current) return;
        const event = deferredPrompt;
        if (!event) { setGuide(true); return; }
        deferredPrompt = null; // A browser event can only be used once.
        pending.current = true;
        setBusy(true);
        setNotice('');
        try {
            // Keep this directly inside the tap handler to preserve user activation.
            await event.prompt();
            const choice = await event.userChoice;
            setNotice(choice.outcome === 'accepted'
                ? 'Installation accepted. Finish any steps shown by your browser.'
                : 'No problem. You can keep using Dear Diary here or try again later.');
        } catch {
            setNotice('Your browser could not open the install prompt. Use these steps instead.');
            setGuide(true);
        } finally {
            pending.current = false;
            setBusy(false);
            notify();
        }
    };
    if (standalone()) return null;
    return <>
        <button type="button" className="dd-menu-card dd-install-row" onClick={install} disabled={busy}>
            <span className="dd-menu-icon"><BookOpen /></span>
            <span className="dd-menu-text">
                <strong>Download Dear Diary</strong>
                <small>{busy ? 'Opening install prompt...' : deferredPrompt ? 'Add the app to this device' : 'Add to your home screen'}</small>
            </span>
            <ChevronRight size={18} />
        </button>
        {notice && <p className="dd-install-notice" role="status">{notice}</p>}
        <dialog ref={dialog} className="dd-install-dialog" aria-labelledby="dd-install-title" onClose={() => setGuide(false)}>
            <span className="dd-welcome-heart"><BookOpen size={26} /></span>
            <h2 id="dd-install-title">Keep Dear Diary close</h2>
            <p>{ios ? 'On iPhone or iPad, add Dear Diary from Safari.' : 'Your browser has not offered an install pop-up. You can try its menu instead.'}</p>
            <ol>
                {ios ? <>
                    <li>Open this Dear Diary website in Safari.</li>
                    <li>Tap Share, then Add to Home Screen. Tap View More first if needed.</li>
                    <li>Keep Open as Web App on if shown, then tap Add.</li>
                </> : <>
                    <li>Open this Dear Diary website in Chrome.</li>
                    <li>Open the three-dot menu. Look for Install app or Add to Home screen. Some versions say Install and create shortcut, then Install.</li>
                    <li>Follow the browser's steps. On a computer, also look for an install icon in the address bar.</li>
                </>}
            </ol>
            <p className="dd-install-help">{ios ? 'The new icon is added only to this device.' : 'On an iPad, use Safari: Share, then Add to Home Screen. If no install option appears, this browser may not support it or the app may already be installed. You can keep using the website.'}</p>
            <Link to="/settings/how-to-use" onClick={() => dialog.current?.close()}>More in How to use</Link>
            <form method="dialog"><button className="dd-btn dd-btn-primary" autoFocus>Got it</button></form>
        </dialog>
    </>;
}
