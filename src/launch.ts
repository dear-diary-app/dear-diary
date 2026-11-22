// One decorative launch per document, not on navigation, unlock or theme changes.
// It never captures input, delays auth, or reveals a diary before its PIN gate.
let finished = false;
export function finishLaunch() {
    if (finished) return;
    finished = true;
    const cover = document.getElementById('dd-launch');
    if (!cover) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { cover.remove(); return; }
    const root = document.getElementById('root');
    root?.classList.add('dd-launch-reveal');
    cover.classList.add('is-leaving');
    const remove = (event: AnimationEvent) => { if (event.target === cover) cover.remove(); };
    cover.addEventListener('animationend', remove);
    // Timers also clean up when animation events are disabled or interrupted.
    window.setTimeout(() => { cover.remove(); root?.classList.remove('dd-launch-reveal'); }, 550);
}
