// One four-second decorative launch per document, never an auth or PIN delay.
let closing = false;
let scheduled: number | undefined;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function dismissLaunch(skip = false) {
    if (closing) return;
    closing = true;
    window.clearTimeout(scheduled);
    document.removeEventListener('pointerdown', skipLaunch, true);
    document.removeEventListener('keydown', skipLaunch, true);
    const cover = document.getElementById('dd-launch');
    if (!cover) return;
    if (skip || reduced()) { cover.remove(); return; }
    const root = document.getElementById('root');
    root?.classList.add('dd-launch-reveal');
    cover.classList.add('is-leaving');
    cover.addEventListener('animationend', event => { if (event.target === cover) cover.remove(); });
    window.setTimeout(() => { cover.remove(); root?.classList.remove('dd-launch-reveal'); }, 750);
}
// Interaction skips decoration without swallowing the tap/key or changing focus.
function skipLaunch() { dismissLaunch(true); }
document.addEventListener('pointerdown', skipLaunch, true);
document.addEventListener('keydown', skipLaunch, true);
export function finishLaunch() {
    if (closing || scheduled !== undefined) return;
    const cover = document.getElementById('dd-launch');
    if (!cover || reduced()) { dismissLaunch(true); return; }
    const start = Number(cover.dataset.startedAt) || 0;
    if (performance.now() - start >= 4000) { dismissLaunch(true); return; }
    // Begin the 600ms crossfade at 3.4s, making the complete opening 4s.
    scheduled = window.setTimeout(() => dismissLaunch(), Math.max(0, 3400 - (performance.now() - start)));
}
