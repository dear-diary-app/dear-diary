import { flushSync } from 'react-dom';

export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Compositor snapshots crossfade colours without repainting colours each frame.
export function fadeTheme(update: () => void) {
    const doc = document as Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };
    if (reduceMotion() || !doc.startViewTransition || document.documentElement.dataset.pageSlide) { update(); return; }
    document.documentElement.dataset.themeFade = 'true';
    const transition = doc.startViewTransition(() => flushSync(update));
    void transition.finished.catch(() => {}).finally(() => { delete document.documentElement.dataset.themeFade; });
}

// Keep the actual modal mounted and focus-trapped until its short exit completes.
const closing = new WeakSet<HTMLElement>();
export function dismissMotion(element: HTMLElement | null, done: () => void) {
    if (!element || reduceMotion() || !element.animate) { done(); return; }
    if (closing.has(element)) return;
    closing.add(element);
    const animation = element.animate([
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0, transform: 'translateY(10px) scale(.98)' },
    ], { duration: 170, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    void animation.finished.catch(() => {}).finally(() => { closing.delete(element); done(); animation.cancel(); });
}
