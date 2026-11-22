// Native glyphs only. Full searchable catalogue is loaded when the picker opens.
export const DEFAULT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const MORE = ['😭', '🥺', '✨', '🫶', '😊', '👀', '🥰', '🔥', '💯', '🎉', '🤍', '🤝', '🙌', '😎', '🤗', '💔', '👏', '😴'];
interface Segmenter { segment(s: string): Iterable<unknown> }
const S = (Intl as typeof Intl & { Segmenter?: new (...args: unknown[]) => Segmenter }).Segmenter;
const segmenter = S ? new S(undefined, { granularity: 'grapheme' }) : null;
export function isEmojiReaction(e: unknown): e is string {
    if (typeof e !== 'string' || !e || [...e].length > 32 || new TextEncoder().encode(e).length > 128) return false;
    if (segmenter && [...segmenter.segment(e)].length !== 1) return false;
    return /^(?:\p{Regional_Indicator}{2}|[#*0-9]\ufe0f?\u20e3|\p{Extended_Pictographic}[\ufe0e\ufe0f]?[\p{Emoji_Modifier}]?(?:[\u{E0020}-\u{E007F}]+)?(?:\u200d\p{Extended_Pictographic}[\ufe0e\ufe0f]?[\p{Emoji_Modifier}]?)*)$/u.test(e);
}
type Used = { e: string; n: number; t: number };
const key = (uid: string) => `dd_reaction_history_${uid}`;
function history(uid: string): Used[] {
    try { const rows: unknown = JSON.parse(localStorage.getItem(key(uid)) || '[]'); return Array.isArray(rows) ? rows.filter((r): r is Used => !!r && isEmojiReaction(r.e) && Number.isFinite(r.n) && Number.isFinite(r.t)).sort((a,b) => b.n-a.n || b.t-a.t).slice(0,40) : []; } catch { return []; }
}
export const frequentReactions = (uid: string) => history(uid).slice(0,24).map(r => r.e);
export function rememberReaction(uid: string, e: string) {
    if (!isEmojiReaction(e)) return;
    const rows = history(uid), old = rows.find(r => r.e === e);
    if (old) { old.n = Math.min(100000, old.n + 1); old.t = Date.now(); } else rows.push({e,n:1,t:Date.now()});
    try { localStorage.setItem(key(uid), JSON.stringify(rows.sort((a,b) => b.n-a.n || b.t-a.t).slice(0,40))); } catch { /* Optional local history must not block reacting. */ }
}
export function quickReactions(uid: string, selected?: string) {
    return [...new Set([...DEFAULT_REACTIONS, ...frequentReactions(uid), ...MORE, ...(selected && isEmojiReaction(selected) ? [selected] : [])])];
}
