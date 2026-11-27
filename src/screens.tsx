import{friendModeOn}from'./friendPrivacy';
import{FriendModeSettings}from'./FriendMode';
import{AndroidUnlock,nativeUnlockAvailable,enrollAndroidUnlock}from'./AndroidUnlock';
import{DeviceUnlockSettings,DeviceUnlockButton,fingerprintFirst}from'./DeviceUnlock';
import {SongTasteSettings} from './SongTaste';
import { PageLockedContext, useDesktopIdle, usePageLocked } from './DesktopIdleLock';
import {Feed} from './Feed';
import {Stories} from './Stories';
import {VoiceLockProvider,VoiceLockSettings} from './VoiceLock';
import {flushSync} from 'react-dom';
import {ChatStyleSettings} from './ChatStyle';
import {AISettings} from './AISettings';
import {RulesPrecautions} from './RulesPrecautions';
import {DiaryPages,OpenDiaryReader} from './DiaryReader';
import { ChatNotificationSettings } from './ChatNotificationSettings';
import { PrivacySettings } from './PrivacySettings';
import { DiaryExport } from './DiaryExport';
import { PushSettings } from './PushSettings';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
    Entry, peopleOwnFirst, PersonId, EMOJIS, ekey, fmtCountdown, fmtPublishCountdown, fmtDateLong, fmtDateShort,
    isReadable, istClock, istParts, latestReadable, otherId, personById, publishWaitMs, schedule, todayKey,
} from './model';
import { Avatar, Book, Chip, EmptyNote, PhotoGallery, Toggle, TopBar, useGo, useNow } from './ui';
import { isUnlocked, setUnlocked, useAuth, useStore, pinStatus, verifyPin } from './store';
import { supabase } from './lib/supabase';
import { Stickers } from './Stickers';
import { SongPicker, SongPill } from './Song';
import { DiaryInstall } from './DiaryInstall';
import { ThemePicker } from './Themes';
import { hasNewFeatures } from './WhatsNew';
import {
    Bell, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Erase, Eye, EyeOff,
    Gear, Heart, ImagePlus, KeyRound, Lock, Moon, PenLine, Search, Sparkles, Users, XIcon,
} from './icons';

// ---------- Login ----------

export function Login() {
    const auth = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [showPw, setShowPw] = useState(false);

    const working=useRef(false);
    const clearFeedback=()=>{setError(null);setNotice(null);};
    const emailValue=()=>email.trim();
    const emailValid=()=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue())&&!/[\u200B-\u200D\uFEFF]/.test(emailValue());
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();if(working.current)return;clearFeedback();
        if(!emailValid()){setError('Enter a valid email address. Check for spaces or hidden characters.');return;}
        working.current=true;setBusy(true);
        try{const err=await auth.signIn(emailValue(),password);if(err)setError(err==='Invalid login credentials'?'Email or password was not accepted. Check both and try again.':err);}
        catch{setError('Could not connect. Check your internet connection and try again.');}
        finally{working.current=false;setBusy(false);}
    };
    const forgot = async () => {
        if(working.current)return;clearFeedback();
        if(!emailValid()){setError('Enter a valid email address first. Check for spaces or hidden characters.');return;}
        working.current=true;setBusy(true);
        try{const err=await auth.resetPassword(emailValue());if(err)setError(err);else setNotice('Password reset email requested. Check your inbox.');}
        catch{setError('Could not connect. Check your internet connection and try again.');}
        finally{working.current=false;setBusy(false);}
    };

    return (
        <main className="dd-shell dd-shell-narrow">
            <div className="dd-anim dd-login" key="login">
                <span className="dd-welcome-heart"><Heart size={26} /></span>
                <h1 className="dd-welcome-title">Dear Diary</h1>
                <p className="dd-welcome-tag">A little space for two, a new page every day.</p>
                <form className="dd-login-form" onSubmit={submit}>
                    <label className="dd-field">
                        <span>Email</span>
                        <input type="email" value={email} onChange={e => {setEmail(e.target.value);clearFeedback();}}
                            autoComplete="email" autoCapitalize="none" spellCheck={false} required placeholder="you@example.com" />
                    </label>
                    <label className="dd-field">
                        <span>Password</span>
                        <span className="dd-pass-wrap">
                            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => {setPassword(e.target.value);clearFeedback();}}
                                autoComplete="current-password" required placeholder="Your password" />
                            <button type="button" className="dd-eye" onClick={() => setShowPw(v => !v)}
                                aria-label={showPw ? 'Hide password' : 'Show password'}
                                aria-pressed={showPw} tabIndex={-1}>
                                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </span>
                    </label>
                    {error && <p role="alert" className="dd-pin-msg is-error">{error}</p>}
                    {notice && <p role="status" className="dd-pin-msg">{notice}</p>}
                    <button type="submit" className="dd-btn dd-btn-primary" disabled={busy}>
                        {busy ? 'Signing in...' : 'Sign in'}
                    </button>
                    <button type="button" className="dd-linklike" disabled={busy} onClick={forgot}>Forgot password?</button>
                </form>
            </div>
        </main>
    );
}

// ---------- Welcome / Home ----------

// This sits above every route, so a restored URL cannot bypass the app lock.
export function AppEntryGate({ children }: { children: React.ReactNode }) {
    const auth = useAuth();
    const [stage, setStage] = useState<'pin' | 'open'>('pin');
    const [idleLocked, setIdleLocked] = useState(false);
    const dialogs = useRef<HTMLDialogElement[]>([]);
    const freshUnlockKey='dd_fresh_unlock_'+auth.session!.user.id;
    const requireFreshUnlock = useRef((()=>{try{return sessionStorage.getItem(freshUnlockKey)==='true';}catch{return false;}})());
    const clearFreshUnlock=()=>{requireFreshUnlock.current=false;try{sessionStorage.removeItem(freshUnlockKey);}catch{}};
    const clearUnlocks = () => { for (const person of ['joydeep','aruba']) { try { sessionStorage.removeItem('dd_unlocked_'+person); } catch {} } };
    const pauseMedia = () => { window.dispatchEvent(new Event('dd-page-lock')); document.querySelectorAll('audio,video').forEach(el => (el as HTMLMediaElement).pause()); };
    const lock=()=>{requireFreshUnlock.current=true;try{sessionStorage.setItem(freshUnlockKey,'true');}catch{}pauseMedia();clearUnlocks();document.querySelectorAll('dialog[open]').forEach(d=>(d as HTMLDialogElement).close());setIdleLocked(false);flushSync(()=>setStage('pin'));};
    const idleLock = () => {
        clearUnlocks(); pauseMedia();
        dialogs.current = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'));
        dialogs.current.forEach(d => d.close());
        (document.activeElement as HTMLElement|null)?.blur();
        flushSync(() => setIdleLocked(true));
    };
    useDesktopIdle(stage === 'open' && !idleLocked, idleLock);
    const instagramReturn=useRef<{at:number;own:boolean;ticket:string}|null>(null);
    useEffect(()=>{const prepare=(ticket:string)=>{if(stage!=='open'||idleLocked||friendModeOn()||!ticket)return false;instagramReturn.current={at:performance.now(),own:sessionStorage.getItem('dd_unlocked_'+auth.me)==='1',ticket};return true;};const resumeInstagram=(ticket:string)=>{const previous=instagramReturn.current;instagramReturn.current=null;if(!previous||previous.ticket!==ticket||performance.now()-previous.at>=600000||requireFreshUnlock.current||friendModeOn())return false;if(previous.own)sessionStorage.setItem('dd_unlocked_'+auth.me,'1');dialogs.current=[];flushSync(()=>{setIdleLocked(false);setStage('open');});return !!document.querySelector('[data-dd-app-open="true"]');};const legacyPrepare=()=>prepare('legacy29'),legacyResume=()=>resumeInstagram('legacy29');window.addEventListener('dd-instagram-prepare',legacyPrepare);window.addEventListener('dd-instagram-resume',legacyResume);const w=window as any;w.ddPrepareInstagramReturn=prepare;w.ddResumeInstagramReturn=resumeInstagram;return()=>{window.removeEventListener('dd-instagram-prepare',legacyPrepare);window.removeEventListener('dd-instagram-resume',legacyResume);if(w.ddPrepareInstagramReturn===prepare)delete w.ddPrepareInstagramReturn;if(w.ddResumeInstagramReturn===resumeInstagram)delete w.ddResumeInstagramReturn;};},[stage,idleLocked,auth.me]);
    useEffect(()=>{const lock=()=>idleLock();window.addEventListener('dd-native-background',lock);window.addEventListener('dd-native-pin-fallback',lock);return()=>{window.removeEventListener('dd-native-background',lock);window.removeEventListener('dd-native-pin-fallback',lock);};},[]);
    useEffect(() => {
        if (!idleLocked) return;
        const pause = (e: Event) => { if(e.target instanceof HTMLMediaElement)e.target.pause(); };
        const coverDialogs=()=>{document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>{if(!dialogs.current.includes(d))dialogs.current.push(d);d.close();});};
        const observer=new MutationObserver(coverDialogs);observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open'],childList:true});
        document.addEventListener('play',pause,true);
        return () => { observer.disconnect();document.removeEventListener('play',pause,true); };
    },[idleLocked]);
    useEffect(()=>{if(stage==='open'&&!idleLocked)window.DearDiaryAndroid?.postMessage(JSON.stringify({op:'picker-web-ready'}));},[stage,idleLocked]);
    const resume = () => {
        clearFreshUnlock();setIdleLocked(false);
        requestAnimationFrame(() => { dialogs.current.forEach(d => { if(d.isConnected)try{d.showModal();}catch{} }); dialogs.current=[]; });
    };
    return <PageLockedContext.Provider value={idleLocked}><VoiceLockProvider person={auth.me!} uid={auth.session!.user.id} active={stage==='open'&&!idleLocked} onLock={lock}>
        {stage==='pin'?<Pin person={auth.me!} appEntry requireFreshUnlock={requireFreshUnlock.current} onEntryUnlock={()=>{clearFreshUnlock();setStage('open');}}/>:<>
            {idleLocked&&<><p className="dd-idle-notice" role="status">Locked after 2 minutes of inactivity. Unlock to return. Unsent drafts stay on this page.</p><Pin person={auth.me!} appEntry onEntryUnlock={resume}/></>}
            <div data-dd-app-open={!idleLocked} hidden={idleLocked} {...(idleLocked?{inert:''}:{})} aria-hidden={idleLocked||undefined}>{children}</div>
        </>}
    </VoiceLockProvider></PageLockedContext.Provider>;
}

export function Home() {
    const profileFeed=new URLSearchParams(useLocation().search).has('owner');
    const store = useStore();
    const auth = useAuth();
    const now = useNow(1000);
    const { go, portal } = useGo();
    const sched = schedule(now);
    const PhaseIcon = sched.phase === 'writing' ? PenLine : sched.phase === 'quiet' ? Moon : BookOpen;

    return (
        <main className="dd-shell dd-home-page">
            {!profileFeed&&<TopBar alert={store.unreadAny(now)} social />}
            <div className="dd-anim" key="home">
                {!profileFeed&&<><Stories/>
                <aside className="dd-home-diary-area" aria-label="Diary shortcuts and schedule">
                  <section className="dd-home-diary-shortcuts" aria-label="Your two diaries">
                    {peopleOwnFirst(auth.me).map(p => <Link key={p.id} to={`/pin/${p.id}`} className="dd-home-diary-link"><Avatar person={p} size="sm"/><span><strong>{p.id === auth.me ? "Your diary" : `${p.name}'s diary`}</strong><small>{store.unreadLatest(otherId(p.id), now) ? "New page" : "Open diary"}</small></span><BookOpen size={18}/></Link>)}
                  </section>
                  <details className="dd-home-schedule"><summary><PhaseIcon size={14}/><span>{sched.phase === 'writing' ? 'Writing time' : sched.phase === 'quiet' ? 'Quiet time' : 'Reading time'}</span><small>{fmtCountdown(sched.countdownMs)} until {sched.next}</small><ChevronRight size={14}/></summary><div><p><CalendarDays size={14}/> {fmtDateLong(todayKey(now))}</p><p><Clock size={14}/> {istClock(now)} IST</p><p>{sched.label}</p><p>{fmtCountdown(sched.countdownMs)} until {sched.next}</p></div></details>
                </aside></>}

                {!profileFeed&&<Link to="/instagram" className="dd-instagram-entry"><span><strong>Instagram Feed</strong><small>Reels inside the app · Android APK</small></span><span aria-hidden="true">↗</span></Link>}
                <Feed/>
                <footer className="dd-foot">
                    <p className="dd-foot-heart">Dear Diary <Heart size={12} /> Joydeep &amp; Aruba</p>
                </footer>
            </div>
            {portal}
        </main>
    );
}

// ---------- PIN screen ----------

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export function Pin({ person, appEntry = false, requireFreshUnlock = false, onEntryUnlock }: { person: PersonId; appEntry?: boolean; requireFreshUnlock?: boolean; onEntryUnlock?: () => void }) {
    const coveredByIdleLock = usePageLocked() && !appEntry;
    const p = personById(person);
    const now = useNow(1000);
    const waitMs = publishWaitMs(now);
    const store = useStore();
    const auth = useAuth();
    const { go, portal } = useGo();
    const [stage, setStage] = useState<'checking' | 'unavailable' | 'enter' | 'create' | 'confirm' | 'owner'>('checking');
    const [showPin,setShowPin]=useState(()=>requireFreshUnlock||nativeUnlockAvailable()||!appEntry||!fingerprintFirst(auth.session!.user.id));
    const [nativePending,setNativePending]=useState(()=>appEntry&&nativeUnlockAvailable()&&!requireFreshUnlock);
    const [pin, setPin] = useState('');
    const [firstPin, setFirstPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState(false);
    const [busy, setBusy] = useState(false);
    const checked = useRef(false);
    const readingOpen = !appEntry && schedule(now).phase !== 'writing';
    const waitingForPublish = person !== auth.me && !readingOpen;

    const checkStatus = async () => {
        setStage('checking');
        try {
            const st = await pinStatus(person);
            setStage(st.unavailable ? 'unavailable' : st.hasPin ? 'enter' : person === auth.me ? 'create' : 'owner');
        } catch { setStage('unavailable'); }
    };

    useEffect(() => {
        if (waitingForPublish || readingOpen) return;
        if (!appEntry && isUnlocked(person)) { go(`/hub/${person}`, 10); return; }
        // If this diary has no PIN yet, only its owner can create one.
        // Status check is not a PIN attempt, so it never counts toward lockout.
        if (checked.current) return;
        checked.current = true;
        void checkStatus();
    }, [person, waitingForPublish, readingOpen]);

    const finish = () => {
        setOk(true);
        setUnlocked(person);
        if (appEntry) onEntryUnlock?.();
        else go(`/hub/${person}`, 750);
    };

    const submitting = useRef(false);
    const submitPin = async (value = pin) => {
        if (waitingForPublish || submitting.current || busy || !/^\d{4}$/.test(value)) return;
        if (stage === 'create') {
            setFirstPin(value); setPin(''); setError(null); setStage('confirm');
            return;
        }
        if (stage !== 'enter' && stage !== 'confirm') return;
        if (stage === 'confirm' && value !== firstPin) {
            setError('PINs did not match - enter the same four digits again');
            setPin(''); return;
        }
        submitting.current = true; setBusy(true); setError(null);
        try {
            const r = await verifyPin(value, stage === 'enter' ? 'verify' : 'set', person);
            if (r.ok) { if(appEntry&&nativeUnlockAvailable()&&person===auth.me){try{await enrollAndroidUnlock(auth.session!.user.id,value);}catch{}}finish(); return; }
            if (r.noPin) { setStage(person === auth.me ? 'create' : 'owner'); }
            else setError(r.error === 'locked' ? 'Too many tries - locked for 15 minutes'
                : r.error === 'wrong' ? 'Not quite - try again' : 'Could not check the PIN - please try again');
            setPin('');
        } catch { setError('Connection interrupted - please try again'); setPin(''); }
        finally { submitting.current = false; setBusy(false); }
    };

    const press = (k: string) => {
        if (waitingForPublish || ok || busy || submitting.current || !['enter', 'create', 'confirm'].includes(stage)) return;
        if (k === 'del') { setPin(v => v.slice(0, -1)); setError(null); return; }
        if (!/^\d$/.test(k) || pin.length >= 4) return;
        const next = pin + k;
        setPin(next); setError(null);
        // Setup never changes step on a digit tap. The user explicitly continues.
        if (stage === 'enter' && next.length === 4) void submitPin(next);
    };

    useEffect(()=>{
        const key=(e:KeyboardEvent)=>{
            if(appEntry&&((stage==='enter'&&!showPin)||nativePending))return;
            if(coveredByIdleLock||e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.repeat||waitingForPublish||readingOpen||busy||ok)return;
            const target=e.target as HTMLElement|null;if(target?.closest('input,textarea,select,[contenteditable=true]'))return;
            if(/^\d$/.test(e.key)){e.preventDefault();press(e.key);}
            else if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();press('del');}
            else if(e.key==='Enter'&&pin.length===4&&(stage==='create'||stage==='confirm')&&!target?.closest('button')){e.preventDefault();void submitPin();}
        };
        window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
    },[coveredByIdleLock,pin,stage,busy,ok,waitingForPublish,readingOpen,appEntry,showPin,nativePending]);

    if (readingOpen) return <Navigate to={appEntry ? '/?nowelcome' : person === auth.me ? `/hub/${person}` : `/published/${person}`} replace />;

    if (waitingForPublish) return (
        <main className="dd-shell dd-shell-narrow">
            <TopBar back="/" backLabel="Back to the books" />
            <div className="dd-anim dd-pin dd-publish-only">
                <Avatar person={p} size="lg" />
                <h1 className="dd-title">{p.name}&rsquo;s Diary</h1>
                <div className="dd-publish-wait" role="timer" aria-label="Time until this diary opens at 10 PM IST">
                    <span className="dd-publish-wait-time"><Clock size={16} /> Opens in {fmtPublishCountdown(waitMs ?? 0)}</span>
                    <span className="dd-publish-wait-note">Today's pages publish at 10:00 PM IST. When the timer ends, the diary opens. No PIN needed.</span>
                </div>
            </div>
        </main>
    );

    return (
        <main className={`dd-shell dd-shell-narrow${appEntry ? ' dd-entry-shell' : ''}`}>
            {!appEntry && <TopBar back="/" backLabel="Back to the books" />}
            {nativePending&&stage!=='create'&&stage!=='confirm'&&stage!=='owner'&&stage!=='unavailable'&&<section className="dd-native-verifying" aria-label="Verifying device unlock"><img src={import.meta.env.BASE_URL+'diary-opening.svg'} alt=""/><h1>Dear Diary</h1><span className="dd-native-opening-line"/></section>}
            <div hidden={nativePending&&['checking','enter'].includes(stage)} className="dd-anim dd-pin" key={`pin-${person}`} aria-label={appEntry ? "Unlock Dear Diary" : undefined}>
                <Avatar person={p} size="lg" />
                <h1 className="dd-title">{p.name}&rsquo;s Diary</h1>
                {appEntry && <p className="dd-entry-label">Welcome back, {p.name}</p>}
                <p className="dd-sub">
                    {stage === 'checking' ? 'Checking this diary...'
                        : stage === 'unavailable' ? ''
                        : stage === 'enter' ? appEntry ? showPin?'Enter your 4-digit diary PIN to open your diaries':'Unlock with your fingerprint, or use your diary PIN' : `Enter ${p.name}'s 4-digit PIN to open this diary`
                        : stage === 'create' ? 'First time here - choose your 4-digit PIN'
                        : stage === 'confirm' ? 'Once more, to confirm your PIN'
                        : `This diary is private - only ${p.name} can set its PIN and open it`}
                </p>
                {(stage === 'enter' || stage === 'create' || stage === 'confirm') && (<>
                {appEntry&&person===auth.me&&stage==='enter'&&nativeUnlockAvailable()&&<AndroidUnlock requireInteraction={requireFreshUnlock} uid={auth.session!.user.id} onUnlock={finish} onPending={setNativePending}/>}
                {appEntry&&person===auth.me&&stage==='enter'&&!nativeUnlockAvailable()&&<DeviceUnlockButton allowAutomatic={!requireFreshUnlock} onPinVisible={setShowPin} onUnlock={finish} disabled={busy||ok}/>}
                <div hidden={appEntry&&stage==='enter'&&!showPin}>
                <div className={`dd-pin-dots${error ? ' is-error' : ''}${ok ? ' is-ok' : ''}`} aria-label={`${pin.length} of 4 digits entered`}>
                    {[0, 1, 2, 3].map(i => (
                        <span key={i} className={`dd-pin-dot${i < pin.length ? ' is-filled' : ''}`}>
                            {ok && i < pin.length ? <Check size={13} /> : null}
                        </span>
                    ))}
                </div>
                <p className={`dd-pin-msg${error ? ' is-error' : ''}`}>
                    {ok ? 'Unlocked - opening the diary...' : error ?? ' '}
                </p>
                <div className="dd-keypad" role="group" aria-label="PIN keypad">
                    {KEYS.map((k, i) => k === ''
                        ? <span key={i} />
                        : (
                            <button key={i} type="button" className="dd-key" onClick={() => press(k)}
                                aria-label={k === 'del' ? 'Delete last digit' : `Digit ${k}`}>
                                {k === 'del' ? <Erase /> : k}
                            </button>
                        ))}
                </div>
                </div>
                {(stage === 'create' || stage === 'confirm') && (
                    <button type="button" className="dd-btn dd-btn-primary dd-pin-submit"
                        disabled={pin.length !== 4 || busy || ok} onClick={() => void submitPin()}>
                        {busy ? 'Saving PIN...' : stage === 'create' ? 'Continue' : 'Set PIN'}
                    </button>
                )}
                </>)}
                {stage === 'unavailable' && (appEntry
                    ? <button type="button" className="dd-btn dd-btn-primary" onClick={() => void checkStatus()}>Retry PIN check</button>
                    : <Link className="dd-btn dd-btn-primary" to="/">Back</Link>)}
                {stage === 'owner' && (
                    <p className="dd-pin-msg">
                        Ask {p.name} to unlock it on this device, or go back to your own diary.
                    </p>
                )}
            </div>
            {portal}
        </main>
    );
}

// ---------- Diary hub (after unlock) ----------

export function Hub({ person }: { person: PersonId }) {
    const p = personById(person);
    const other = personById(otherId(person));
    const store = useStore();
    const now = useNow(1000);
    const sched = schedule(now);
    const today = todayKey(now);
    const latest = latestReadable(now);
    const pageDay = sched.phase === 'writing' ? today : latest;
    const myEntry = store.entries[ekey(p.id, pageDay)];
    const theirEntry = store.entries[ekey(other.id, latest)];
    const unread = theirEntry && theirEntry.status === 'published' && !store.readSet[`${other.id}|${latest}|${p.id}`];

    return (
        <main className="dd-shell dd-shell-narrow">
            <TopBar alert={Boolean(store.unreadLatest(p.id, now))} />
            <div className="dd-anim" key={`hub-${person}`}>
                <div className="dd-hub-head">
                    <Avatar person={p} size="lg" />
                    <div>
                        <h1 className="dd-title">{p.name}&rsquo;s Diary</h1>
                        <p className="dd-sub">{fmtDateLong(pageDay)}</p>
                    </div>
                </div>
                <div className="dd-hub-chips">
                    <Chip tone={sched.phase === 'writing' ? 'sage' : 'lavender'}
                        icon={sched.phase === 'writing' ? <PenLine size={14} /> : <Moon size={14} />}>
                        {sched.label}
                    </Chip>
                    <Chip icon={<Clock size={14} />}>{fmtCountdown(sched.countdownMs)} until {sched.next}</Chip>
                </div>

                <nav className="dd-menu" aria-label="Diary sections">
                    <Link className="dd-menu-card" to={sched.phase === 'writing' ? `/write/${p.id}` : `/published/${p.id}`}>
                        <span className="dd-menu-icon dd-hue-pink-bg"><PenLine /></span>
                        <span className="dd-menu-text">
                            <strong>{sched.phase === 'writing' ? (myEntry?.text ? "Continue today's page" : "Write today's page") : "Read your locked page"}</strong>
                            <small>{sched.phase === 'writing' ? 'Open until 10:00 PM' : 'Locked at 10:00 PM - read only'}</small>
                        </span>
                        <ChevronRight size={18} />
                    </Link>
                    <Link className="dd-menu-card" to={sched.phase === 'writing' ? `/read/${p.id}` : `/published/${other.id}`}>
                        <span className="dd-menu-icon dd-hue-lavender-bg"><BookOpen /></span>
                        <span className="dd-menu-text">
                            <strong>Read {other.name}&rsquo;s diary {unread ? <span className="dd-newdot">new</span> : null}</strong>
                            <small>Published pages, 10:00 PM to 6:00 AM</small>
                        </span>
                        <ChevronRight size={18} />
                    </Link>
                    <Link className="dd-menu-card" to={`/calendar/${p.id}`}>
                        <span className="dd-menu-icon dd-hue-sage-bg"><CalendarDays /></span>
                        <span className="dd-menu-text">
                            <strong>Calendar &amp; history</strong>
                            <small>Every page, month by month</small>
                        </span>
                        <ChevronRight size={18} />
                    </Link>
                    <Link className="dd-menu-card" to="/settings">
                        <span className="dd-menu-icon"><Gear /></span>
                        <span className="dd-menu-text">
                            <strong>Settings</strong>
                            <small>Avatars, passwords, PINs and how to use</small>
                        </span>
                        <ChevronRight size={18} />
                    </Link>
                    <Link className="dd-menu-card" to="/notifications">
                        <span className="dd-menu-icon"><Bell /></span>
                        <span className="dd-menu-text">
                            <strong>Notification preferences</strong>
                            <small>Reminders for 6 AM and 10 PM</small>
                        </span>
                        <ChevronRight size={18} />
                    </Link>
                </nav>
                <p className="dd-switchline">Not you? <Link to="/">Switch diary book</Link></p>
            </div>
        </main>
    );
}

// ---------- Daily writing editor ----------

export function Write({ person }: { person: PersonId }) {
    const p = personById(person);
    const store = useStore();
    const now = useNow(15000);
    const sched = schedule(now);
    const today = todayKey(now);
    const locked = sched.phase !== 'writing';
    const entry = store.entries[ekey(p.id, today)];
    const text = entry?.text ?? '';
    const photos = entry?.photos ?? [];
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const save = store.saveState[ekey(p.id, today)] ?? 'saved';
    const [photoErr, setPhotoErr] = useState<string | null>(null);
    useEffect(() => { if (save === 'error') store.retrySave(p.id, today); }, [save]);
    if (store.loading) return <main className="dd-shell"><p className="dd-sub" role="status">Opening your page...</p></main>;

    return (
        <main className="dd-shell">
            <TopBar back={`/hub/${p.id}`} backLabel={`Back to ${p.name}'s diary`} alert={Boolean(store.unreadLatest(p.id, now))} />
            <div className="dd-anim" key={`write-${person}`}>
                <div className="dd-hub-head">
                    <Avatar person={p} size="lg" />
                    <div>
                        <h1 className="dd-title">{p.name}&rsquo;s Diary</h1>
                        <p className="dd-sub">{fmtDateLong(today)}</p>
                    </div>
                    <span className={`dd-save${save === 'saving' ? ' is-saving' : ''}`}>
                        {locked ? <><Lock size={13} /> Locked</> : save === 'saving' ? 'Saving...' : save === 'error' ? 'Couldn\u2019t save - retrying' : <><Check size={13} /> Saved</>}
                    </span>
                </div>
                {locked && (
                    <p className="dd-locked"><Lock size={14} /> This page locked at 10:00 PM. Editing and photos open again at 6:00 AM.</p>
                )}
                {locked ? (entry?.song ? <SongPill song={entry.song} /> : null) : <SongPicker song={entry?.song} onChange={s => store.saveSong(p.id,today,s)} />}
                <Stickers text={text} value={entry?.stickers ?? []} onChange={locked ? undefined : v => store.saveStickers(p.id,today,v)} onTextChange={locked ? undefined : v => store.saveText(p.id,today,v)} label={`${p.name}'s diary page for ${fmtDateLong(today)}`} placeholder="Dear diary, today..." />
                <div className="dd-editor-foot">
                    <span>{words} {words === 1 ? 'word' : 'words'}</span>
                    <span className="dd-editor-note">{locked ? 'Read only' : 'Autosaves to your private diary'}</span>
                </div>
                <div className="dd-photo-bar">
                    <PhotoGallery photos={photos} title={`${p.name}'s photos`}
                        onRemove={locked ? undefined : idx => store.removePhoto(p.id, today, idx)} />
                    {!locked && (
                        <label className="dd-addphoto">
                            <input type="file" accept="image/*" hidden
                                onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    if (!f.type.startsWith('image/')) { setPhotoErr('Only image files, please.'); e.target.value = ''; return; }
                                    if (f.size > 5 * 1024 * 1024) { setPhotoErr('That photo is over 5 MB - try a smaller one.'); e.target.value = ''; return; }
                                    setPhotoErr(null);
                                    store.addPhoto(p.id, today, f);
                                    e.target.value = '';
                                }} />
                            <ImagePlus size={17} /> Add a photo
                        </label>
                    )}
                    {photoErr && <p className="dd-pin-msg is-error">{photoErr}</p>}
                </div>
            </div>
        </main>
    );
}

// ---------- Reading the other person's diary ----------

export function Read({ viewer, publishedOwner }: { viewer: PersonId; publishedOwner?: PersonId }) {
    const other = personById(publishedOwner ?? otherId(viewer));
    const store = useStore();
    const auth = useAuth();
    const now = useNow(15000);
    const sched = schedule(now);
    const latest = latestReadable(now);
    const [date, setDate] = useState(latest);
    const entry: Entry | undefined = store.entries[ekey(other.id, publishedOwner ? latest : date)];
    const pageDate = publishedOwner ? latest : date;

    const reacts = store.reactions[ekey(other.id, pageDate)] ?? {};
    const mine = reacts[viewer];

    useEffect(() => {
        if (entry) store.markRead(other.id, pageDate, viewer);
    }, [other.id, pageDate, entry?.text]);

    useEffect(() => {
        if (!publishedOwner) return;
        void store.refreshEntries();
        const timer = setInterval(() => void store.refreshEntries(), 15000);
        return () => clearInterval(timer);
    }, [publishedOwner]);

    const step = (n: number) => {
        const [y, m, d] = date.split('-').map(Number);
        const t = new Date(Date.UTC(y, m - 1, d + n, 12));
        const k = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
        setDate(k);
    };

    return (
        <main className="dd-shell dd-reader-route">
            <TopBar back={`/hub/${viewer}`} backLabel="Back to your diary" alert={Boolean(store.unreadLatest(viewer, now))} />
            <div className="dd-anim" key={`read-${viewer}-${date}`}>
                <div className="dd-hub-head dd-reader-person"><Link to={`/hub/${viewer}`} className="dd-reader-back" aria-label="Back to diary options">‹</Link>
                    <Avatar person={other} size="lg" />
                    <div>
                        <h1 className="dd-title">{other.name}&rsquo;s Diary</h1>
                        <p className="dd-sub">
                            {fmtDateLong(pageDate)}
                            {pageDate === todayKey(now) ? ' - published tonight' : pageDate === latest ? ' - latest page' : ''}
                        </p>
                    </div>
                </div>
                {publishedOwner && publishedOwner === viewer && <div className="dd-reading-options">
                    <Chip icon={<Lock size={14} />}>Locked at 10:00 PM · Read only</Chip>
                    <Link className="dd-btn dd-btn-ghost" to={`/hub/${auth.me ?? viewer}`}>Diary options</Link>
                </div>}
                {!publishedOwner && <div className="dd-date-nav">
                    <button type="button" className="dd-iconbtn" onClick={() => step(-1)} aria-label="Previous day"><ChevronLeft /></button>
                    <span className="dd-date-nav-label">{fmtDateShort(date)}</span>
                    <button type="button" className="dd-iconbtn" onClick={() => step(1)} disabled={date >= latest} aria-label="Next day"><ChevronRight /></button>
                </div>}
                {entry && (!publishedOwner || entry.status === 'published') ? (
                    <>
                        <DiaryPages key={other.id+pageDate} text={entry.text} stickers={entry.stickers??[]} song={entry.song}/>
                        <PhotoGallery photos={entry.photos} title={`${other.name}'s photos`} />
                        {viewer !== other.id && <div className="dd-react">
                            <p className="dd-react-label">React to {other.name}&rsquo;s page</p>
                            <div className="dd-react-row" role="group" aria-label="Emoji reactions">
                                {EMOJIS.map(e => (
                                    <button key={e} type="button"
                                        className={`dd-emoji${mine === e ? ' is-on' : ''}`}
                                        aria-pressed={mine === e}
                                        aria-label={`React ${e}`}
                                        onClick={() => store.toggleReact(other.id, pageDate, viewer, e)}>
                                        {e}
                                    </button>
                                ))}
                            </div>
                            <p className="dd-react-note">
                                {mine ? `You reacted ${mine} - one reaction each, tap again to change` : 'One reaction per page - it shows on their calendar'}
                            </p>
                        </div>}
                    </>
                ) : (
                    <EmptyNote icon={<BookOpen size={26} />} title="No entry today">
                        {other.name} didn&rsquo;t write this page. {sched.phase === 'writing' ? 'The page publishes at 10:00 PM if it gets written.' : ''}
                    </EmptyNote>
                )}
            </div>
        </main>
    );
}

// ---------- Calendar history ----------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function Calendar({ viewer }: { viewer: PersonId }) {
    const auth = useAuth();
    const store = useStore();
    const now = useNow(30000);
    const today = todayKey(now);
    const parts = istParts(now);
    const [ym, setYm] = useState({ y: parts.y, m: parts.mo });
    const [day, setDay] = useState(today);
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState<'all' | PersonId>('all');
    const latest = latestReadable(now);

    const cells = useMemo(() => {
        const firstDow = (new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
        const dim = new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
        const out: (string | null)[] = [];
        for (let i = 0; i < firstDow; i++) out.push(null);
        for (let d = 1; d <= dim; d++) out.push(`${ym.y}-${String(ym.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        return out;
    }, [ym]);

    const results = useMemo(() => {
        if (!q.trim()) return [];
        const needle = q.trim().toLowerCase();
        return Object.values(store.entries)
            .filter(e => (filter === 'all' || e.person === filter))
            .filter(e => e.person === viewer || isReadable(e.date, now))
            .filter(e => e.text.toLowerCase().includes(needle))
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 12);
    }, [q, filter, store.entries, viewer, now]);

    const moveMonth = (n: number) => {
        const m = ym.m - 1 + n;
        setYm({ y: ym.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 + 1 });
    };

    const dayEntries = peopleOwnFirst(auth.me).map(p => ({ person: p, entry: store.entries[ekey(p.id, day)] }));

    return (
        <main className="dd-shell dd-history-page">
            <TopBar alert={Boolean(store.unreadLatest(viewer, now))} />
            <div className="dd-anim" key={`cal-${viewer}`}>
                <h1 className="dd-title">Diary history</h1>
                <p className="dd-sub">Every page, month by month</p>

                <div className="dd-search">
                    <Search size={17} />
                    <input value={q} onChange={e => setQ(e.target.value)}
                        placeholder="Search past entries..." aria-label="Search past entries" />
                    {q && <button type="button" className="dd-iconbtn" onClick={() => setQ('')} aria-label="Clear search"><XIcon size={16} /></button>}
                </div>
                <div className="dd-filters" role="group" aria-label="Filter by person">
                    {(['all' as const, ...peopleOwnFirst(auth.me).map(p => p.id)]).map(f => (
                        <button key={f} type="button"
                            className={`dd-filter${filter === f ? ' is-on' : ''}`}
                            onClick={() => setFilter(f)}>
                            {f === 'all' ? 'Both diaries' : `${personById(f).name}`}
                        </button>
                    ))}
                </div>

                {q.trim() ? (
                    <div className="dd-results">
                        {results.length === 0 && <EmptyNote icon={<Search size={24} />} title="No pages match">Try another word, or clear the filter.</EmptyNote>}
                        {results.map(e => (
                            <button key={ekey(e.person, e.date)} type="button" className="dd-result"
                                onClick={() => { setDay(e.date); setYm({ y: +e.date.slice(0, 4), m: +e.date.slice(5, 7) }); setQ(''); }}>
                                <span className={`dd-result-dot dd-hue-${personById(e.person).hue}-bg`} />
                                <span className="dd-result-text">
                                    <strong>{personById(e.person).name} - {fmtDateShort(e.date)}</strong>
                                    <small>{e.text.slice(0, 90)}{e.text.length > 90 ? '...' : ''}</small>
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="dd-cal">
                            <div className="dd-cal-head">
                                <button type="button" className="dd-iconbtn" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft /></button>
                                <strong>{MONTHS[ym.m - 1]} {ym.y}</strong>
                                <button type="button" className="dd-iconbtn" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight /></button>
                            </div>
                            <div className="dd-cal-grid">
                                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => <span key={d} className="dd-cal-dow">{d}</span>)}
                                {cells.map((k, i) => k === null
                                    ? <span key={i} />
                                    : (
                                        <button key={k} type="button"
                                            className={`dd-cal-day${k === day ? ' is-sel' : ''}${k === today ? ' is-today' : ''}`}
                                            onClick={() => setDay(k)}>
                                            {+k.slice(8)}
                                            <span className="dd-cal-dots">
                                                {store.entries[ekey('joydeep', k)] && <i className="dd-hue-pink-bg" />}
                                                {store.entries[ekey('aruba', k)] && <i className="dd-hue-lavender-bg" />}
                                            </span>
                                        </button>
                                    ))}
                            </div>
                            <p className="dd-cal-legend">
                                {peopleOwnFirst(auth.me).map(p => <span key={p.id}><i className={`dd-hue-${p.hue}-bg`} /> {p.name} wrote</span>)}
                            </p>
                        </div>

                        <section className="dd-daypanel" aria-label={`Entries for ${fmtDateLong(day)}`}>
                            <h2 className="dd-daypanel-title">{fmtDateLong(day)}</h2>
                            {dayEntries.map(({ person, entry }) => {
                                const mine = person.id === viewer;
                                const readable = mine || isReadable(day, now);
                                const reacts = store.reactions[ekey(person.id, day)] ?? {};
                                return (
                                    <div key={person.id} className="dd-dayentry">
                                        <div className="dd-dayentry-head">
                                            <Avatar person={person} size="sm" />
                                            <strong>{person.name}&rsquo;s page</strong>
                                            {mine && <Chip tone="plain">yours</Chip>}
                                        </div>
                                        {entry && readable ? (
                                            <>
                                                <OpenDiaryReader title={`${person.name}'s page · ${fmtDateShort(day)}`} text={entry.text} stickers={entry.stickers??[]} song={entry.song}/>
                                                {entry.song && <SongPill song={entry.song} />}
                                                <Stickers text={entry.text} value={entry.stickers ?? []} />
                                                <PhotoGallery photos={entry.photos} title={`${person.name}'s photos`} />
                                                {Object.keys(reacts).length > 0 && (
                                                    <p className="dd-dayentry-react">
                                                        {Object.entries(reacts).map(([r, e]) => `${personById(r as PersonId).name} reacted ${e}`).join(' - ')}
                                                    </p>
                                                )}
                                                {!mine && (
                                                    <div className="dd-react-row dd-react-row-sm" role="group" aria-label={`React to ${person.name}'s page`}>
                                                        {EMOJIS.slice(0, 10).map(e => (
                                                            <button key={e} type="button"
                                                                className={`dd-emoji${reacts[viewer] === e ? ' is-on' : ''}`}
                                                                aria-pressed={reacts[viewer] === e}
                                                                onClick={() => store.toggleReact(person.id, day, viewer, e)}>
                                                                {e}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        ) : entry && !readable ? (
                                            <p className="dd-dayentry-none"><Lock size={13} /> Written today - unlocks at 10:00 PM</p>
                                        ) : (
                                            <p className="dd-dayentry-none">No entry today</p>
                                        )}
                                    </div>
                                );
                            })}
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}

// ---------- Settings ----------

const AVATARS = 8;


// ---------- Change password (settings) ----------

export function ChangePassword() {
    const auth = useAuth();
    const [cur, setCur] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState<Record<string,boolean>>({});
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (next.length < 6) { setError('Choose at least 6 characters for the new password'); return; }
        if (next !== confirm) { setError('New passwords did not match'); return; }
        if (next === cur) { setError('New password is the same as the current one'); return; }
        setBusy(true);
        const email = auth.session?.user?.email ?? '';
        const { error: re } = await supabase.auth.signInWithPassword({ email, password: cur });
        if (re) { setBusy(false); setError('Current password is not right'); return; }
        const { error: up } = await supabase.auth.updateUser({ password: next });
        setBusy(false);
        if (up) { setError(up.message); return; }
        setCur(''); setNext(''); setConfirm('');
        setDone(true);
    };

    const passwordField=(id:string,label:string,value:string,change:(v:string)=>void,auto:string,hint?:string)=><div className="dd-security-field"><label htmlFor={id}>{label}</label><div className="dd-security-input"><input id={id} type={show[id]?'text':'password'} value={value} onChange={e=>{change(e.target.value);setError(null);}} autoComplete={auto} required minLength={id==='current-password'?undefined:6} aria-describedby={hint?`${id}-hint`:undefined}/><button type="button" aria-label={`${show[id]?'Hide':'Show'} ${label.toLowerCase()}`} aria-pressed={!!show[id]} onClick={()=>setShow(v=>({...v,[id]:!v[id]}))}>{show[id]?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{hint&&<small id={`${id}-hint`}>{hint}</small>}</div>;
    return <main className="dd-shell dd-shell-narrow dd-security-page"><TopBar back="/settings" backLabel="Back to settings"/><div className="dd-anim" key="change-password"><header className="dd-security-heading"><span className="dd-security-emblem"><KeyRound size={24}/></span><div><p>ACCOUNT SECURITY</p><h1 className="dd-title">Change password</h1></div></header><p className="dd-security-intro">A fresh key for your shared space.</p>{done?<section className="dd-security-card dd-security-success" role="status"><span className="dd-security-emblem"><Check size={26}/></span><h2>Password updated</h2><p>Use the new password next time you sign in.</p><Link className="dd-btn dd-btn-primary" to="/settings">Back to settings</Link></section>:<form onSubmit={submit} className="dd-security-card" aria-busy={busy}><div className="dd-security-cardhead"><Lock size={18}/><div><h2>Your sign-in password</h2><p>Confirm it's you, then choose a new password.</p></div></div>{passwordField('current-password','Current password',cur,setCur,'current-password')}{passwordField('new-password','New password',next,setNext,'new-password','At least 6 characters. A longer, unique password is safer.')}{next&&<div className="dd-password-cue" aria-live="polite"><span className={next.length>=6?'is-met':''}/><span className={next.length>=10?'is-met':''}/><span className={next.length>=14?'is-met':''}/><small>{next.length<6?'Keep going, 6 characters minimum':next.length<10?'Minimum length met':next.length<14?'Longer is better':'Good length. Keep it unique.'}</small></div>}{passwordField('confirm-password','Confirm new password',confirm,setConfirm,'new-password')}{confirm&&<small className="dd-security-match" role="status">{next===confirm?'Passwords match':'Both new passwords must match'}</small>}{error&&<p className="dd-security-error" role="alert">{error}</p>}<button type="submit" className="dd-btn dd-btn-primary dd-security-submit" disabled={busy}>{busy?'Updating…':'Update password'}<ChevronRight size={17}/></button><p className="dd-security-foot"><Lock size={13}/> Your diary PIN stays the same.</p></form>}</div></main>;
}

// ---------- Change diary PIN (settings) ----------

export function ChangePin() {
    const auth = useAuth();
    const store = useStore();
    const person = (auth.me ?? 'joydeep') as PersonId;
    const p = personById(person);
    const [stage, setStage] = useState<'verify' | 'create' | 'confirm' | 'done'>('verify');
    const [pin, setPin] = useState('');
    const [firstPin, setFirstPin] = useState('');
    const [currentPin, setCurrentPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const checked = useRef(false);
    const [showPin,setShowPin]=useState(false);
    useEffect(()=>setShowPin(false),[stage]);

    useEffect(() => {
        if (checked.current) return;
        checked.current = true;
        // No PIN yet: skip straight to choosing one.
        pinStatus(person).then(st => { if (!st.hasPin) setStage('create'); });
    }, [person]);

    const press = async (k: string) => {
        if (busy || stage === 'done') return;
        if (k === 'del') { setPin(v => v.slice(0, -1)); setError(null); return; }
        if (!k) return;
        const next = pin + k;
        setPin(next);
        setError(null);
        if (next.length < 4) return;
        setBusy(true);
        if (stage === 'verify') {
            const r = await verifyPin(next, 'verify', person);
            setBusy(false);
            if (r.ok) { setCurrentPin(next); setPin(''); setStage('create'); return; }
            setError(r.error === 'locked' ? 'Too many tries - locked for 15 minutes' : 'Not quite - try again');
            setTimeout(() => setPin(''), 420);
        } else if (stage === 'create') {
            setFirstPin(next);
            setPin('');
            setStage('confirm');
            setBusy(false);
        } else if (stage === 'confirm') {
            if (next !== firstPin) {
                setBusy(false);
                setError('PINs did not match - start over');
                setPin('');
                setFirstPin('');
                setStage('create');
                return;
            }
            const r = await verifyPin(next, 'set', person, currentPin || undefined);
            setBusy(false);
            if (r.ok) { setPin(''); setCurrentPin(''); setFirstPin(''); sessionStorage.removeItem(`dd_unlocked_${person}`); setStage('done'); return; }
            setError(r.error === 'locked' ? 'Too many tries - locked for 15 minutes' : 'Current PIN was not right - start over');
            setPin('');
            setFirstPin('');
            setCurrentPin(''); setStage('verify');
        }
    };

    return (
        <main className="dd-shell dd-shell-narrow dd-security-page">
            <TopBar back="/settings" backLabel="Back to settings" />
            <div className="dd-anim" key="change-pin"><header className="dd-security-heading"><span className="dd-security-emblem"><Lock size={24}/></span><div><p>DIARY SECURITY</p><h1 className="dd-title">Change diary PIN</h1></div></header><p className="dd-security-intro">A little privacy for your pages.</p><section className="dd-security-card dd-security-pin"><div className="dd-security-pinperson"><Avatar person={p} size="sm"/><div><strong>{p.name}'s diary</strong><small>4-digit diary PIN</small></div></div>{stage!=='done'&&<ol className="dd-security-steps" aria-label="PIN change progress">{['Verify','New PIN','Confirm'].map((label,i)=><li key={label} className={(['verify','create','confirm'].indexOf(stage)>=i)?'is-active':''} aria-current={['verify','create','confirm'][i]===stage?'step':undefined}><span>{i+1}</span>{label}</li>)}</ol>}
                <p className="dd-sub">
                    {stage === 'verify' ? 'Enter your current 4-digit PIN'
                        : stage === 'create' ? 'Choose your new 4-digit PIN'
                        : stage === 'confirm' ? 'Once more, to confirm your new PIN'
                        : 'Your diary PIN is updated'}
                </p>
                {stage !== 'done' ? (<>
                <div className={`dd-pin-dots${error ? ' is-error' : ''}`} aria-label={`${pin.length} of 4 digits entered`}>
                    {[0, 1, 2, 3].map(i => (
                        <span key={i} aria-hidden="true" className={`dd-pin-dot${i < pin.length ? ' is-filled' : ''}${showPin?' is-revealed':''}`}>{showPin?pin[i]||'':''}</span>
                    ))}
                </div>
                <button type="button" className="dd-security-reveal" aria-pressed={showPin} onClick={()=>setShowPin(v=>!v)}>{showPin?<EyeOff size={16}/>:<Eye size={16}/>} {showPin?'Hide entered digits':'Show entered digits'}</button>
                <p role="status" className={`dd-pin-msg${error ? ' is-error' : ''}`}>{error ?? ' '}</p>
                <div className="dd-keypad" role="group" aria-label="PIN keypad">
                    {KEYS.map((k, i) => k === ''
                        ? <span key={i} />
                        : (
                            <button key={i} type="button" className="dd-key" disabled={busy} onClick={() => press(k)}
                                aria-label={k === 'del' ? 'Delete last digit' : `Digit ${k}`}>
                                {k === 'del' ? <Erase /> : k}
                            </button>
                        ))}
                </div>
                </>) : (
                    <section className="dd-security-success" role="status"><span className="dd-security-emblem"><Check size={26}/></span><h2>PIN updated</h2>
                        <p className="dd-card-body">Use the new PIN the next time your diary asks for it.</p>
                        <Link className="dd-btn dd-btn-primary" to="/settings">Back to settings</Link>
                    </section>
                )}{stage!=='done'&&<p className="dd-security-foot"><Lock size={13}/> Your sign-in password stays the same.</p>}</section>
            </div>
        </main>
    );
}

// ---------- First-time guide ----------

export function HowToUse() {
    const sections = [
        { title: '1. Come in as yourself', text: "Welcome to your little space for two. Joydeep and Aruba each sign in with their own email and password. Opening the app goes straight to your own 4-digit diary PIN at any time of day or night, showing your name and profile picture. Unlock once to reach the books without entering it again straight away. After 10 PM, your partner's nightly page needs no additional PIN once you are inside. Your own diary appears first on the books screen. There is no public sign-up." },
        { title: '2. Give your book its own PIN', text: "Tap your diary. The first time, choose a 4-digit PIN and enter it again to confirm. Only the owner can set or change their diary PIN. Joydeep's book and Aruba's book have separate PINs. If the other book has no PIN yet, its owner needs to set one first." },
        { title: "3. Write a little of today's story", text: "Open your book and choose Write today's page. Writing is open from 6:00 AM until 10:00 PM IST. You can return and edit today's draft during those hours. Your partner cannot read an unpublished draft. Older pages cannot be rewritten." },
        { title: '4. Let it save, and add a photo', text: "Your words autosave as you write. Look for Saved before leaving the page, especially on a weak connection. If you see Saving or a retry message, keep the page open until it finishes. Use Stickers to add a ribbon, flower or keepsake to your page. Tap a placed sticker, drag it anywhere on the page, pinch to resize and twist with two fingers to rotate. Corner handles and Size and Rotate controls work too. Tap uncovered words to keep writing. Each sheet has 14 lines. Writing flows automatically to another sheet when the current one fills; use the page arrows to go back. Stickers stay on their numbered sheet, autosave and appear on the published page. Use Add photo in the editor to choose an image from your device. Check that the photo appears before you leave." },
        { title: '5. Meet here at 10 PM', text: "At 10:00 PM IST, saved drafts lock and publish automatically. There is no Send button. From 10:00 PM to 6:00 AM, it is your nightly reading time: no more edits, just each other's words. Before 10 PM, the other book's entry screen shows a live countdown to today's publish time. At 10 PM the diary PIN is no longer needed to read that night's published page. Account sign-in is still required." },
        { title: "6. Read each other's page", text: "From 10 PM to 6 AM IST, tap either book to read its latest nightly page without a diary PIN. Your own book keeps its diary options, including the locked nightly page and Calendar & history. The partner book opens that night's page directly. From 6 AM to 10 PM, your own book asks for your PIN and the partner's book shows a countdown. Your account password is still required to sign in." },
        { title: '7. Leave a small sign you were here', text: "On a published page, tap an emoji to react. You can have one reaction on each page; choose another to change it or tap the selected one to remove it. Opening a page in the reading view marks it as read, so the app can tell new pages from pages you have already opened." },
        { title: '8. Keep your days together', text: "Calendar & history keeps saved pages together, month by month. Pick a date, search for words, or filter by Joydeep or Aruba. Published pages remain available in history after the nightly reading hours, including during the day. Pages do not disappear at 6 AM and have no automatic expiry. They are meant to stay with you, but no online service can promise storage forever." },
        { title: '9. A little care for your keys', text: "Five wrong PIN attempts lock that diary PIN for 15 minutes. Wait before trying again; changing the PIN cannot bypass the wait. In Profile & settings, Change password asks for your current password and a new one twice. Change diary PIN asks for your current PIN and a new 4-digit PIN twice. If you have never set a PIN, it starts with choosing one." },
        { title: '10. Keep Dear Diary on your home screen', text: "In Profile & settings, tap Download Dear Diary to open the install pop-up when your browser offers it, or see steps for your device. The option is hidden when you are already using the installed app. On Android Chrome, open this site, tap the three-dot menu, then Install and create shortcut and Install. Some versions call this Install app or Add to Home screen. On an iPad, use Safari, tap Share, then View More and Add to Home Screen. Keep Open as Web App on if it appears, then tap Add. Open the new Dear Diary icon for an app window without the browser address bar. Installation is separate on each device. The paper shell can open offline after its first online load; signing in, loading diary pages and syncing still need a connection. Installing does not enable push notifications. Updates arrive when you reopen or refresh online, without reloading over your writing." },
    ];
    return (
        <main className="dd-shell dd-shell-narrow">
            <TopBar back="/settings" backLabel="Back to settings" />
            <article className="dd-anim dd-guide" aria-label="How to use Dear Diary">
                <h1 className="dd-title">How to use</h1>
                <p className="dd-sub">Two little books. A moment for each other, every night.</p>
                <p className="dd-guide-time"><Clock size={15} /> All diary times are India Standard Time (IST).</p>
                {sections.map(section => (
                    <section className="dd-card" key={section.title}>
                        <h2 className="dd-guide-heading">{section.title}</h2>
                        <p className="dd-card-body">{section.text}</p>
                    </section>
                ))}
                <Link className="dd-btn dd-btn-primary" to="/settings">Back to settings</Link>
            </article>
        </main>
    );
}

export function Settings() {
    const store = useStore();
    const auth = useAuth();
    const now = useNow(30000);
    return (
        <main className="dd-shell dd-shell-narrow dd-settings">
            <TopBar back="/" backLabel="Back to the books" />
            <div className="dd-anim" key="settings">
                <h1 className="dd-title">Settings</h1>
                <p className="dd-sub">Your account and preferences</p>

                <Link className="dd-menu-card" to="/profile"><span className="dd-menu-icon"><Heart /></span><span className="dd-menu-text"><strong>Your profile</strong><small>Photo, bio, mood and streak</small></span><ChevronRight size={18}/></Link>

                <FriendModeSettings />
                <DiaryInstall />

                <Link className="dd-menu-card" to="/settings/how-to-use">
                    <span className="dd-menu-icon"><BookOpen /></span>
                    <span className="dd-menu-text">
                        <strong>How to use</strong>
                        <small>Writing, reading and your diary</small>
                    </span>
                    <ChevronRight size={18} />
                </Link>

                <Link className="dd-menu-card" to="/settings/whats-new">
                    <span className="dd-menu-icon"><Sparkles /></span>
                    <span className="dd-menu-text">
                        <strong>What's new{hasNewFeatures(auth.session?.user.id) && <em className="dd-new-pill">New</em>}</strong>
                        <small>Features added to Dear Diary</small>
                    </span>
                    <ChevronRight size={18} />
                </Link>

                <Link className="dd-menu-card" to="/notifications">
                    <span className="dd-menu-icon"><Bell /></span>
                    <span className="dd-menu-text">
                        <strong>Notifications</strong>
                        <small>Chat previews, reply shortcut and reminders</small>
                    </span>
                    <ChevronRight size={18} />
                </Link>

                <Link className="dd-menu-card" to="/settings/password">
                    <span className="dd-menu-icon"><KeyRound /></span>
                    <span className="dd-menu-text">
                        <strong>Change password</strong>
                        <small>Update your sign-in password</small>
                    </span>
                    <ChevronRight size={18} />
                </Link>

                <Link className="dd-menu-card" to="/settings/pin">
                    <span className="dd-menu-icon"><Lock /></span>
                    <span className="dd-menu-text">
                        <strong>Change diary PIN</strong>
                        <small>Your 4-digit diary PIN</small>
                    </span>
                    <ChevronRight size={18} />
                </Link>

                <section className="dd-settings-dropdowns" aria-label="More settings">
                    <PrivacySettings />
                    <DeviceUnlockSettings />
                    <VoiceLockSettings />
                    <AISettings />
                    <SongTasteSettings />
                    <ChatStyleSettings />
                    <ThemePicker />
                    {peopleOwnFirst(auth.me).filter(p => p.id === auth.me && !store.avatarPhotos[p.id]).map(p => (
                        <section key={p.id} className="dd-card" aria-labelledby="avatar-colour-heading">
                            <details className="dd-settings-fold">
                                <summary><span className="dd-settings-fold-label"><h2 id="avatar-colour-heading" className="dd-card-title">Avatar colour</h2><span className="dd-settings-fold-note">Choose your profile colour</span></span><ChevronRight size={20} /></summary>
                                <div className="dd-settings-fold-content">
                                    <div className="dd-swatches" role="group" aria-label={`Avatar colour for ${p.name}`}>
                                        {Array.from({ length: AVATARS }, (_, i) => (
                                            <button key={i} type="button" className={`dd-swatch dd-av-${i}${store.avatars[p.id] === i ? ' is-on' : ''}`} aria-label={`Avatar style ${i + 1}`} aria-pressed={store.avatars[p.id] === i} onClick={() => store.setAvatar(p.id, i)}>{p.initial}</button>
                                        ))}
                                    </div>
                                </div>
                            </details>
                        </section>
                    ))}
                    <DiaryExport />
                </section>
                {window.DearDiaryAndroid&&<section className="dd-card"><h2 className="dd-card-title">Android app</h2><p className="dd-card-sub">Device gate, Android notifications and app information.</p><button type="button" className="dd-btn dd-btn-ghost" onClick={()=>window.DearDiaryAndroid?.postMessage(JSON.stringify({op:'options'}))}>Android app options</button></section>}
                <Link className="dd-btn dd-btn-ghost" to="/instagram">Instagram info &amp; privacy</Link>
                <RulesPrecautions />
                <span style={{ display: 'none' }}>{now.toISOString()}</span>
                <button type="button" className="dd-btn dd-btn-ghost" onClick={() => auth.signOut()}>Sign out</button>
            </div>

        </main>
    );
}

// ---------- Notification preferences ----------

const NOTIFS: { key: string; label: string; hint: string }[] = [
    { key: 'open', label: 'Writing window opens', hint: 'A gentle nudge at 6:00 AM when today\u2019s page opens' },
    { key: 'ask', label: 'Daily /ask reminder', hint: '11 PM IST, only if your daily Yes/No question is unused. Best-effort delivery.' },
    { key: 'writing', label: 'Daily writing reminder', hint: 'A nudge at 9:00 PM to write today\u2019s page before the evening gets away' },
    { key: 'lock', label: 'Diaries lock', hint: 'A reminder at 9:45 PM, before everything locks at 10:00 PM' },
    { key: 'published', label: 'Nightly reading time', hint: 'A 10:00 PM reminder that writing is closed and reading time has begun' },
    { key: 'friendFree', label: 'Friend is free', hint: 'Off by default. Notify me only when my friend changes from another status to Free. New chat messages and device notifications must also be on.' },
    { key: 'feed', label: 'Feed reactions and comments', hint: 'Private post activity. No photo or comment text appears in alerts. Device notifications must also be enabled.' },
    { key: 'chat', label: 'New chat messages', hint: 'A notice when a message, photo or sticker arrives' },
];

export function Notifications() {
    const store = useStore();
    return (
        <main className="dd-shell dd-shell-narrow">
            <TopBar back="/settings" backLabel="Back to settings" />
            <div className="dd-anim" key="notifs">
                <h1 className="dd-title">Notifications</h1>
                <p className="dd-sub">Soft reminders, never noise</p>
                <PushSettings />
                <ChatNotificationSettings />
                <section className="dd-card">
                    {NOTIFS.map(n => (
                        <Toggle key={n.key} label={n.label} hint={n.hint}
                            disabled={store.notifSaving} on={Boolean(store.notifPrefs[n.key])} onChange={v => store.setNotifPref(n.key, v)} />
                    ))}
                </section>
                {store.notifMessage && <p className="dd-card-note" role="status">{store.notifMessage}</p>}
                <p className="dd-card-note"><Users size={14} /> Reminder choices save to your account. Enable each device separately above. Reaction alerts are not available yet.</p>
            </div>
        </main>
    );
}
