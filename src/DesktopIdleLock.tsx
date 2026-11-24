import { createContext, useContext, useEffect, useRef, useState } from 'react';
export const PageLockedContext = createContext(false);
export const usePageLocked = () => useContext(PageLockedContext);
export const DESKTOP_IDLE_MS = 120000;
export function useComputerBrowser() {
    const [computer, setComputer] = useState(false);
    useEffect(() => {
        const query = matchMedia('(hover: hover) and (pointer: fine)');
        const update = () => setComputer(query.matches && navigator.maxTouchPoints === 0 && !/Android|iPad|iPhone|Mobile|Tablet/i.test(navigator.userAgent));
        update(); query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    return computer;
}
// Date.now also accounts for elapsed time while background timers are throttled.
export function watchDesktopIdle(onLock: () => void) {
    let last = Date.now(), timer: ReturnType<typeof setTimeout>, done = false;
    const arm = () => { clearTimeout(timer); timer = setTimeout(check, Math.max(1, DESKTOP_IDLE_MS - (Date.now() - last))); };
    const check = () => { if (done) return; if (Date.now() - last >= DESKTOP_IDLE_MS) { done = true; clearTimeout(timer); onLock(); } else arm(); };
    const activity = (e: Event) => {
        // Synthetic app scrolls, animations and pointer movement aren't activity.
        if (!e.isTrusted || done) return;
        if (Date.now() - last >= DESKTOP_IDLE_MS) { e.preventDefault(); e.stopImmediatePropagation(); check(); return; }
        last = Date.now(); arm();
    };
    const events = ['pointerdown', 'pointerup', 'click', 'keydown', 'input', 'wheel'];
    events.forEach(type => document.addEventListener(type, activity, { capture: true }));
    document.addEventListener('visibilitychange', check); window.addEventListener('focus', check); window.addEventListener('pageshow', check);
    arm();
    return () => { done = true; clearTimeout(timer); events.forEach(type => document.removeEventListener(type, activity, true)); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check); window.removeEventListener('pageshow', check); };
}
export function useDesktopIdle(active: boolean, onLock: () => void) {
    const callback = useRef(onLock); callback.current = onLock;
    useEffect(() => active ? watchDesktopIdle(() => callback.current()) : undefined, [active]);
}
