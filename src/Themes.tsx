import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './store';
import { supabase } from './lib/supabase';
import { Check } from './icons';

const PALETTES = [
    { id: 'paper', name: 'Warm paper', note: 'The original', top: '#fdf9f4', mid: '#faf3ee', bottom: '#f7efe9', glass: '255, 250, 247' },
    { id: 'rose', name: 'Rose petal', note: 'Soft blush', top: '#fff3f5', mid: '#fae9ee', bottom: '#f5dfe7', glass: '255, 243, 245' },
    { id: 'lavender', name: 'Lavender', note: 'A quiet lilac', top: '#f7f3ff', mid: '#eee8f8', bottom: '#e6def2', glass: '247, 243, 255' },
    { id: 'sage', name: 'Sage leaf', note: 'A little calm', top: '#f2f7ef', mid: '#e8f0e3', bottom: '#dfe9d9', glass: '242, 247, 239' },
    { id: 'sky', name: 'Morning sky', note: 'Pale blue', top: '#f1f7fc', mid: '#e5eff8', bottom: '#dbe7f3', glass: '241, 247, 252' },
    { id: 'midnight', name: 'Midnight', note: 'A softer dark', top: '#101013', mid: '#17141a', bottom: '#1c171d', glass: '30, 25, 32' },
] as const;
type ThemeId = typeof PALETTES[number]['id'];
const valid = (id: unknown): ThemeId => PALETTES.some(p => p.id === id) ? id as ThemeId : 'paper';
const ThemeContext = createContext<{ theme: ThemeId; busy: boolean; message: string; choose: (id: ThemeId) => void } | null>(null);
const cacheKey = (uid: string) => `dd_background_${uid}`;
function cached(uid: string): ThemeId {
    try { return valid(localStorage.getItem(cacheKey(uid))); } catch { return 'paper'; }
}
function cache(uid: string, theme: ThemeId) {
    try { localStorage.setItem(cacheKey(uid), theme); } catch { /* Account storage is still the source of truth. */ }
}

// Account-scoped server setting, with an account-scoped local first-paint cache.
export function ThemeFrame({ className, children }: { className: string; children: React.ReactNode }) {
    const uid = useAuth().session!.user.id;
    const [theme, setTheme] = useState<ThemeId>(() => cached(uid));
    const [busy, setBusy] = useState(true);
    const [message, setMessage] = useState('');
    useEffect(() => {
        let active = true;
        supabase.from('app_settings').select('theme').eq('user_id', uid).maybeSingle().then(({ data, error }) => {
            if (!active) return;
            if (error) setMessage('Could not load your saved theme. Try again when connected.');
            else { const next = valid(data?.theme); setTheme(next); cache(uid, next); }
            setBusy(false);
        });
        return () => { active = false; };
    }, [uid]);
    const palette = PALETTES.find(p => p.id === theme)!;
    useEffect(() => {
        const meta = document.querySelector('meta[name="theme-color"]');
        // Android may use this for its bottom system bar as well as browser chrome.
        meta?.setAttribute('content', palette.bottom);
        const html = document.documentElement;
        html.style.setProperty('--dd-canvas', palette.bottom);
        html.style.setProperty('--dd-colour-scheme', theme === 'midnight' ? 'dark' : 'light');
        html.dataset.diaryTheme = theme;
        return () => {
            meta?.setAttribute('content', '#fdf9f4');
            html.style.removeProperty('--dd-canvas');
            html.style.removeProperty('--dd-colour-scheme');
            delete html.dataset.diaryTheme;
        };
    }, [palette]);
    const choose = async (id: ThemeId) => {
        if (busy) return;
        const previous = theme;
        setTheme(id); setBusy(true); setMessage('Saving your theme...');
        const { error } = await supabase.from('app_settings').upsert({ user_id: uid, theme: id }, { onConflict: 'user_id' });
        if (error) { setTheme(previous); setMessage('Could not save this theme. Your previous theme is still selected. Please try again.'); }
        else { cache(uid, id); setMessage('Theme saved for your account.'); }
        setBusy(false);
    };
    return <ThemeContext.Provider value={{ theme, busy, message, choose }}>
        <div className={className} data-theme={theme} style={{
            '--dd-bg-top': palette.top, '--dd-bg-mid': palette.mid, '--dd-bg-bottom': palette.bottom,
            '--dd-glass': palette.glass,
        } as React.CSSProperties}>{children}</div>
    </ThemeContext.Provider>;
}

export function ThemePicker() {
    const state = useContext(ThemeContext)!;
    return <section className="dd-card dd-theme-picker" aria-labelledby="dd-theme-heading">
        <h2 id="dd-theme-heading" className="dd-card-title">Background theme</h2>
        <p className="dd-card-sub">A little colour for your space. Warm paper is the default. Your choice is only for your account.</p>
        <div className="dd-theme-options" role="group" aria-label="Background theme colour">
            {PALETTES.map(p => <button type="button" key={p.id} disabled={state.busy}
                className={`dd-theme-option${state.theme === p.id ? ' is-selected' : ''}`}
                aria-pressed={state.theme === p.id} onClick={() => void state.choose(p.id)}>
                <span className="dd-theme-swatch" style={{ background: `linear-gradient(135deg, ${p.top}, ${p.bottom})`, color: p.id === 'midnight' ? '#f0c5ce' : '#754856' }}>
                    {state.theme === p.id && <Check size={18} />}
                </span>
                <span><strong>{p.name}</strong><small>{p.note}</small></span>
            </button>)}
        </div>
        {state.message && <p className="dd-theme-message" role="status">{state.message}</p>}
    </section>;
}
