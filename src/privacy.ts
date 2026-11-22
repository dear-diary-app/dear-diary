// Cosmetic protection only. The OS decides when its app-switcher snapshot is taken.
const root = document.documentElement;
let account: string | null = null;
const key = (uid: string) => `dd_privacy_blur_${uid}`;
export function privacyBlurEnabled(uid: string | null = account) {
    try { return !uid || localStorage.getItem(key(uid)) !== 'off'; } catch { return true; }
}
const away = () => root.classList.toggle('dd-away', privacyBlurEnabled());
const back = () => { if (!document.hidden && document.hasFocus()) root.classList.remove('dd-away'); };
export function setPrivacyAccount(uid: string | null) { account = uid; if (document.hidden || !document.hasFocus()) away(); else back(); }
export function savePrivacyBlur(uid: string, enabled: boolean) {
    localStorage.setItem(key(uid), enabled ? 'on' : 'off');
    if (!enabled) root.classList.remove('dd-away');
}
export function registerPrivacyBlur() {
    document.addEventListener('visibilitychange', () => (document.hidden ? away() : back()));
    window.addEventListener('pagehide', away);
    window.addEventListener('blur', away);
    window.addEventListener('freeze', away);
    window.addEventListener('focus', back);
    window.addEventListener('pageshow', back);
    window.addEventListener('storage', () => { if (!privacyBlurEnabled()) root.classList.remove('dd-away'); else if (document.hidden || !document.hasFocus()) away(); });
    document.addEventListener('pointerdown', () => { if (!document.hidden) root.classList.remove('dd-away'); }, true);
    if (document.hidden) away();
}
