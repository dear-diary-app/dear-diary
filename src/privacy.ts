// Best-effort app privacy cover. Android owns the timing of Recents snapshots.
const root = document.documentElement;
let account: string | null = null;
let cover: HTMLDialogElement | null = null;
let registered = false;
let returnedAt = 0;
const key = (uid: string) => `dd_privacy_blur_${uid}`;
export function privacyBlurEnabled(uid: string | null = account) {
    try { return !uid || localStorage.getItem(key(uid)) !== 'off'; } catch { return true; }
}
function dismiss() {
    root.classList.remove('dd-away');
    cover?.close();
}
function ensureCover() {
    if (cover || !document.body) return;
    cover = document.createElement('dialog');
    cover.id = 'dd-privacy-cover';
    cover.setAttribute('aria-label', 'Privacy cover');
    const name = document.createElement('h1'); name.textContent = 'Dear Diary';
    const message = document.createElement('p'); message.textContent = 'Your app is hidden.';
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Tap to return';
    button.addEventListener('click', event => {
        if (!event.isTrusted || document.hidden || !document.hasFocus() || performance.now() - returnedAt < 250) return;
        dismiss();
    });
    cover.addEventListener('cancel', event => event.preventDefault());
    cover.append(name, message, button); document.body.append(cover);
}
function away() {
    if (!privacyBlurEnabled()) { dismiss(); return; }
    returnedAt = performance.now();
    // Synchronous, without React state or an entry animation.
    root.classList.add('dd-away');
    ensureCover();
    if (cover && !cover.open) { try { cover.showModal(); } catch { /* CSS still conceals content. */ } }
}
function back() {
    if (!privacyBlurEnabled()) { dismiss(); return; }
    // Focus/pageshow may arrive while Android is still animating Recents.
    // Never reveal on those events alone; require the cover's deliberate tap.
    if (!document.hidden && document.hasFocus()) returnedAt = performance.now();
}
export function setPrivacyAccount(uid: string | null) {
    account = uid;
    if (!privacyBlurEnabled()) dismiss();
    else if (document.hidden || !document.hasFocus()) away();
}
export function savePrivacyBlur(uid: string, enabled: boolean) {
    localStorage.setItem(key(uid), enabled ? 'on' : 'off');
    if (!enabled) dismiss();
    else if (document.hidden || !document.hasFocus()) away();
}
export function registerPrivacyBlur() {
    if (registered) return;
    registered = true;
    document.addEventListener('visibilitychange', () => document.hidden ? away() : back(), true);
    window.addEventListener('pagehide', away, true);
    window.addEventListener('blur', event => { if(event.target===window) away(); });
    document.addEventListener('freeze', away, true);
    document.addEventListener('resume', back, true);
    window.addEventListener('focus', event => { if(event.target===window) back(); });
    window.addEventListener('pageshow', back, true);
    window.addEventListener('storage', () => { if (!privacyBlurEnabled()) dismiss(); else if (document.hidden || !document.hasFocus()) away(); });
    const init = () => { ensureCover(); if (document.hidden || !document.hasFocus()) away(); };
    if (document.body) init(); else document.addEventListener('DOMContentLoaded', init, { once: true });
}
