// Block the long-press menu, drag-out of images and links, and any stray selection outside typing fields.
const typing = (t: EventTarget | null) => t instanceof Element && !!t.closest('input, textarea, [contenteditable="true"], [contenteditable=""]');
export function registerNoSelect() {
    document.addEventListener('contextmenu', e => { if (!typing(e.target)) e.preventDefault(); });
    document.addEventListener('dragstart', e => { if (!typing(e.target)) e.preventDefault(); });
    document.addEventListener('selectstart', e => { if (!typing(e.target)) e.preventDefault(); });
}
