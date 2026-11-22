// Blurs the whole app the moment it is hidden or loses focus, so the phone's
// app-switcher preview cannot be read. Nothing is stored or sent anywhere.
const root = document.documentElement;
const away = () => root.classList.add('dd-away');
const back = () => { if (!document.hidden && document.hasFocus()) root.classList.remove('dd-away'); };
export function registerPrivacyBlur() {
    document.addEventListener('visibilitychange', () => (document.hidden ? away() : back()));
    window.addEventListener('pagehide', away);
    window.addEventListener('blur', away);
    window.addEventListener('freeze', away);
    window.addEventListener('focus', back);
    window.addEventListener('pageshow', back);
    // Some phones report focus late; a tap on the page always counts as being back.
    document.addEventListener('pointerdown', () => { if (!document.hidden) root.classList.remove('dd-away'); }, true);
    if (document.hidden) away();
}
