import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './store';
import { supabase } from './lib/supabase';
import { Check, ChevronRight } from './icons';
import { fadeTheme } from './motion';
import { WeatherContext,WeatherScene,WeatherSummary,useWeather } from './Weather';
import { skyPalette } from './SkyCanvas';
import { WeatherCityPicker } from './WeatherCityPicker';

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
type ThemeMode='fixed'|'auto'|'weather';
export const DAY_START_HOUR=6,NIGHT_START_HOUR=18;
export const autoTheme=(date=new Date()):ThemeId=>date.getHours()>=DAY_START_HOUR&&date.getHours()<NIGHT_START_HOUR?'lavender':'midnight';
const ThemeContext = createContext<{ mode:ThemeMode;setMode:(mode:ThemeMode)=>void;weatherOn:boolean;setWeatherOn:(on:boolean)=>void; theme: ThemeId; busy: boolean; message: string; choose: (id: ThemeId) => void } | null>(null);
const cacheKey = (uid: string) => `dd_background_${uid}`;
function cached(uid: string): ThemeId {
    try { return valid(localStorage.getItem(cacheKey(uid))); } catch { return 'paper'; }
}
function cache(uid: string, theme: ThemeId) {
    try { localStorage.setItem(cacheKey(uid), theme); } catch { /* Account storage is still the source of truth. */ }
}

// Account-scoped server setting, with an account-scoped local first-paint cache.
export function ThemeFrame({ className, children }: { className: string; children: React.ReactNode }) {
    const auth=useAuth();const uid = auth.session!.user.id;
    const [mode,setModeState]=useState<ThemeMode>(()=>{try{return (localStorage.getItem(`dd_theme_mode_${uid}`) as ThemeMode)|| (auth.me==='joydeep'?'auto':'fixed');}catch{return auth.me==='joydeep'?'auto':'fixed';}});
    useEffect(()=>{try{if(!localStorage.getItem(`dd_theme_mode_${uid}`)&&auth.me==='joydeep')localStorage.setItem(`dd_theme_mode_${uid}`,'auto');}catch{}},[uid,auth.me]);
    const [weatherOn,setWeatherState]=useState(()=>{try{return localStorage.getItem(`dd_weather_${uid}`)==='on';}catch{return false;}});
    const [clock,setClock]=useState(()=>new Date());
    const weather=useWeather(uid,weatherOn);
    const setMode=(next:ThemeMode)=>{setModeState(next);try{localStorage.setItem(`dd_theme_mode_${uid}`,next);}catch{};};
    const setWeatherOn=(on:boolean)=>{setWeatherState(on);try{localStorage.setItem(`dd_weather_${uid}`,on?'on':'off');}catch{};if(on)weather.refresh();};
    useEffect(()=>{const update=()=>setClock(new Date());const timer=window.setInterval(update,30000);document.addEventListener('visibilitychange',update);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};},[]);
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
    const activeTheme=mode==='auto'?autoTheme(clock):theme;
    const weatherPalette=mode==='weather'&&weather.kind?skyPalette(weather.kind,weather.day):null;
    const renderTheme=weatherPalette?(!weather.day||weather.kind==='clear-night'||weather.kind==='storm'?'midnight':'paper'):activeTheme;
    const palette = weatherPalette||PALETTES.find(p => p.id === activeTheme)!;
    useEffect(() => {
        const meta = document.querySelector('meta[name="theme-color"]');
        // Android may use this for its bottom system bar as well as browser chrome.
        meta?.setAttribute('content', palette.bottom);
        const html = document.documentElement;
        html.style.setProperty('--dd-canvas', palette.bottom);
        html.style.backgroundColor=palette.bottom;
        document.body.style.backgroundColor=palette.bottom;
        document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content',renderTheme==='midnight'?'black-translucent':'default');
        html.style.setProperty('--dd-colour-scheme', renderTheme === 'midnight' ? 'dark' : 'light');
        html.dataset.diaryTheme = renderTheme;
        return () => {
            meta?.setAttribute('content', '#fdf9f4');
            html.style.removeProperty('--dd-canvas');html.style.removeProperty('background-color');
            html.style.removeProperty('--dd-colour-scheme');
            delete html.dataset.diaryTheme;document.body.style.removeProperty('background-color');
        };
    }, [palette.bottom,renderTheme]);
    const choose = async (id: ThemeId) => {
        if (busy) return;
        setMode('fixed');
        const previous = theme;
        fadeTheme(() => setTheme(id)); setBusy(true); setMessage('Saving your theme...');
        const { error } = await supabase.from('app_settings').upsert({ user_id: uid, theme: id }, { onConflict: 'user_id' });
        if (error) { fadeTheme(() => setTheme(previous)); setMessage('Could not save this theme. Your previous theme is still selected. Please try again.'); }
        else { cache(uid, id); setMessage('Theme saved for your account.'); }
        setBusy(false);
    };
    return <ThemeContext.Provider value={{mode,setMode,weatherOn,setWeatherOn,theme,busy,message,choose}}>
        <WeatherContext.Provider value={weather}><div className={className} data-theme={renderTheme} data-weather={weatherOn&&weather.kind?weather.kind:undefined} data-weather-mode={mode==='weather'||undefined} data-sky-dark={!!weatherPalette&&(weather.kind==='storm'||!weather.day||weather.kind==='clear-night')||undefined} style={{
            '--dd-bg-top': palette.top, '--dd-bg-mid': palette.mid, '--dd-bg-bottom': palette.bottom,
            '--dd-glass': palette.glass,
        } as React.CSSProperties}><WeatherScene/>{children}</div></WeatherContext.Provider>
    </ThemeContext.Provider>;
}

export function ThemePicker() {
    const state = useContext(ThemeContext)!;const weather=useContext(WeatherContext);
    return <section className="dd-card dd-theme-picker" aria-labelledby="dd-theme-heading">
        <details className="dd-settings-fold">
        <summary><span className="dd-settings-fold-label"><h2 id="dd-theme-heading" className="dd-card-title">Background theme</h2><span className="dd-settings-fold-note">{state.mode==='weather'?'Weather':state.mode==='auto'?'Auto day / night':PALETTES.find(p => p.id === state.theme)!.name}</span></span><ChevronRight size={20} /></summary>
        <div className="dd-settings-fold-content">
        <p className="dd-card-sub">A little colour for your space. Choose an automatic day/night look, keep one fixed colour, or let Weather choose the colours. Your choice is only for your account.</p>
        <div className="dd-theme-modes" role="group" aria-label="Theme mode"><button type="button" aria-pressed={state.mode==='auto'} onClick={()=>state.setMode('auto')}>Auto day / night</button><button type="button" aria-pressed={state.mode==='fixed'} onClick={()=>state.setMode('fixed')}>Fixed colour</button><button type="button" aria-pressed={state.mode==='weather'} onClick={()=>{state.setMode('weather');if(!state.weatherOn)state.setWeatherOn(true);}}>Weather</button></div>
        {state.weatherOn&&<WeatherSummary/>}
        <p className="dd-card-sub">Auto: Lavender from 6 am to 6 pm, Midnight from 6 pm to 6 am, using this device's local time. Weather mode leaves Auto and Fixed unselected, with colours that follow the sky. Until weather loads, your fixed colour is the fallback. Mode and weather options stay on this device, separately for each account.</p>
        <div className="dd-theme-options" role="group" aria-label="Background theme colour">
            {PALETTES.map(p => <button type="button" key={p.id} disabled={state.busy}
                className={`dd-theme-option${state.mode==='fixed' && state.theme === p.id ? ' is-selected' : ''}`}
                aria-pressed={state.mode==='fixed' && state.theme === p.id} onClick={() => void state.choose(p.id)}>
                <span className="dd-theme-swatch" style={{ background: `linear-gradient(135deg, ${p.top}, ${p.bottom})`, color: p.id === 'midnight' ? '#f0c5ce' : '#754856' }}>
                    {state.mode==='fixed' && state.theme === p.id && <Check size={18} />}
                </span>
                <span><strong>{p.name}</strong><small>{p.note}</small></span>
            </button>)}
        </div>
        <div className="dd-weather-settings"><label><input type="checkbox" checked={state.weatherOn} onChange={e=>{state.setWeatherOn(e.target.checked);if(!e.target.checked&&state.mode==='weather')state.setMode('fixed');}}/> Local weather background</label><p>Optional. Uses your device location or selected city, rounded to about 5 km, to get weather from Open-Meteo about every 30 minutes while open. Device coordinates stay out of your diary and are not saved. A manually selected city is saved only on this device. The weather provider receives them and your IP address. Each person sees their own local weather.</p>{state.weatherOn&&<><WeatherCityPicker/><button type="button" className="dd-btn dd-btn-ghost" onClick={weather.refresh}>Enable / refresh weather</button></>}<p>Generated sky scenes, not video or a live camera. Layered clouds drift over sun, moon, rain, snow and wind (25 km/h or more). Motion is capped at 24 fps, reduces detail and frame rate if drawing is expensive, and pauses when hidden. It can use more battery. Reduced motion, data saver or low-power devices use still scenes. Weather unavailable? Your selected colour stays on.</p><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data by Open-Meteo</a></div>
        {state.message && <p className="dd-theme-message" role="status">{state.message}</p>}
        </div></details>
    </section>;
}
