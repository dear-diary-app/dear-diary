import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Entry, PEOPLE, PersonId, EMOJIS, ekey, fmtCountdown, fmtDateLong, fmtDateShort,
    isReadable, istClock, istParts, latestReadable, otherId, personById, schedule, todayKey,
} from './model';
import { Book, Chip, EmptyNote, PhotoGallery, Toggle, TopBar, useGo, useNow } from './ui';
import { isUnlocked, setUnlocked, useAuth, useStore, verifyPin } from './store';
import {
    Bell, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Erase,
    Gear, Heart, ImagePlus, Lock, Moon, PenLine, Search, Sparkles, Users, XIcon,
} from './icons';

// ---------- Login ----------

export function Login() {
    const auth = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const err = await auth.signIn(email.trim(), password);
        setBusy(false);
        if (err) setError(err);
    };

    const forgot = async () => {
        if (!email.trim()) { setError('Enter your email first, then tap "forgot password".'); return; }
        setBusy(true);
        const err = await auth.resetPassword(email.trim());
        setBusy(false);
        setError(null);
        setNotice(err ?? 'Password reset email sent - check your inbox.');
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
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            autoComplete="email" required placeholder="you@example.com" />
                    </label>
                    <label className="dd-field">
                        <span>Password</span>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                            autoComplete="current-password" required placeholder="Your password" />
                    </label>
                    {error && <p className="dd-pin-msg is-error">{error}</p>}
                    {notice && <p className="dd-pin-msg">{notice}</p>}
                    <button type="submit" className="dd-btn dd-btn-primary" disabled={busy}>
                        {busy ? 'Signing in...' : 'Sign in'}
                    </button>
                    <button type="button" className="dd-linklike" onClick={forgot}>Forgot password?</button>
                </form>
                <p className="dd-foot-heart">Dear Diary <Heart size={12} /> Joydeep &amp; Aruba - 1 January 2027</p>
            </div>
        </main>
    );
}

// ---------- Welcome / Home ----------

export function Home() {
    const store = useStore();
    const now = useNow(1000);
    const { go, portal } = useGo();
    const [welcome, setWelcome] = useState(() => {
        if (typeof window === 'undefined' || !window.location) return false;
        return !window.location.hash.includes('nowelcome');
    });
    const sched = schedule(now);
    const PhaseIcon = sched.phase === 'writing' ? PenLine : sched.phase === 'quiet' ? Moon : BookOpen;

    return (
        <main className="dd-shell">
            <TopBar alert={store.unreadAny(now)} />
            {welcome && (
                <div className="dd-overlay" role="dialog" aria-label="Welcome to Dear Diary">
                    <div className="dd-welcome">
                        <span className="dd-welcome-heart"><Heart size={26} /></span>
                        <h1 className="dd-welcome-title">Dear Diary</h1>
                        <p className="dd-welcome-tag">A little space for two, a new page every day.</p>
                        <p className="dd-welcome-sub">Joydeep &amp; Aruba - launching 1 January 2027</p>
                        <button type="button" className="dd-btn dd-btn-primary" onClick={() => setWelcome(false)}>
                            Open your diaries
                        </button>
                    </div>
                </div>
            )}
            <div className="dd-anim" key="home">
                <section className="dd-books" aria-label="Your two diary books">
                    {PEOPLE.map(p => (
                        <div key={p.id} className="dd-book-col">
                            <Book person={p} avatar={store.avatars[p.id]}
                                unread={store.unreadLatest(otherId(p.id), now)}
                                onOpen={go} />
                            <p className="dd-book-name">{p.name}&rsquo;s Diary</p>
                        </div>
                    ))}
                </section>

                <section className="dd-status" aria-label="Today">
                    <div className="dd-status-row">
                        <span className="dd-status-item"><CalendarDays size={17} /> {fmtDateLong(todayKey(now))}</span>
                        <span className="dd-status-item"><Clock size={17} /> {istClock(now)} IST</span>
                    </div>
                    <div className="dd-status-row">
                        <span className="dd-status-item"><PhaseIcon size={17} /> {sched.label}</span>
                        <span className="dd-status-item">{fmtCountdown(sched.countdownMs)} until {sched.next}</span>
                    </div>
                </section>

                <footer className="dd-foot">
                    <p className="dd-foot-heart">Dear Diary <Heart size={12} /> Joydeep &amp; Aruba - 1 January 2027</p>
                </footer>
            </div>
            {portal}
        </main>
    );
}

// ---------- PIN screen ----------

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export function Pin({ person }: { person: PersonId }) {
    const p = personById(person);
    const store = useStore();
    const { go, portal } = useGo();
    const [stage, setStage] = useState<'enter' | 'create' | 'confirm'>('enter');
    const [pin, setPin] = useState('');
    const [firstPin, setFirstPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState(false);
    const [busy, setBusy] = useState(false);
    const checked = useRef(false);

    useEffect(() => {
        if (isUnlocked(person)) { go(`/hub/${person}`, 10); return; }
        // If this diary has no PIN yet, the owner creates one now.
        if (checked.current) return;
        checked.current = true;
        verifyPin('____', 'verify').then(r => { if (r.noPin) setStage('create'); });
    }, [person]);

    const finish = () => {
        setOk(true);
        setUnlocked(person);
        go(`/hub/${person}`, 750);
    };

    const press = async (k: string) => {
        if (ok || busy) return;
        if (k === 'del') { setPin(v => v.slice(0, -1)); setError(null); return; }
        if (!k) return;
        const next = pin + k;
        setPin(next);
        setError(null);
        const need = stage === 'enter' ? 4 : 4; // 4-digit PINs
        if (next.length < need) return;
        setBusy(true);
        if (stage === 'enter') {
            const r = await verifyPin(next, 'verify');
            setBusy(false);
            if (r.ok) { finish(); return; }
            setError(r.error === 'locked' ? 'Too many tries - locked for 15 minutes' : 'Not quite - try again');
            setTimeout(() => setPin(''), 420);
        } else if (stage === 'create') {
            setFirstPin(next);
            setPin('');
            setStage('confirm');
            setBusy(false);
        } else {
            if (next !== firstPin) {
                setBusy(false);
                setError('PINs did not match - start over');
                setPin('');
                setFirstPin('');
                setStage('create');
                return;
            }
            const r = await verifyPin(next, 'set');
            setBusy(false);
            if (r.ok) { finish(); return; }
            setError('Could not set the PIN - try again');
            setPin('');
        }
    };

    return (
        <main className="dd-shell dd-shell-narrow">
            <TopBar back="/" backLabel="Back to the books" />
            <div className="dd-anim dd-pin" key={`pin-${person}`}>
                <span className={`dd-avatar dd-avatar-lg dd-av-${store.avatars[person]}`}>{p.initial}</span>
                <h1 className="dd-title">{p.name}&rsquo;s Diary</h1>
                <p className="dd-sub">
                    {stage === 'enter' ? 'Enter the 4-digit PIN to open this diary'
                        : stage === 'create' ? 'First time here - choose your 4-digit PIN'
                        : 'Once more, to confirm your PIN'}
                </p>
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
            {portal}
        </main>
    );
}

// ---------- Diary hub (after unlock) ----------

export function Hub({ person }: { person: PersonId }) {
    const p = personById(person);
    const other = personById(otherId(person));
    const store = useStore();
    const now = useNow(15000);
    const sched = schedule(now);
    const today = todayKey(now);
    const latest = latestReadable(now);
    const myEntry = store.entries[ekey(p.id, today)];
    const theirEntry = store.entries[ekey(other.id, latest)];
    const unread = theirEntry && theirEntry.status === 'published' && !store.readSet[`${other.id}|${latest}|${p.id}`];

    return (
        <main className="dd-shell dd-shell-narrow">
            <TopBar back="/" backLabel="Back to the books" alert={Boolean(store.unreadLatest(p.id, now))} />
            <div className="dd-anim" key={`hub-${person}`}>
                <div className="dd-hub-head">
                    <span className={`dd-avatar dd-avatar-lg dd-av-${store.avatars[person]}`}>{p.initial}</span>
                    <div>
                        <h1 className="dd-title">{p.name}&rsquo;s Diary</h1>
                        <p className="dd-sub">{fmtDateLong(today)}</p>
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
                    <Link className="dd-menu-card" to={`/write/${p.id}`}>
                        <span className="dd-menu-icon dd-hue-pink-bg"><PenLine /></span>
                        <span className="dd-menu-text">
                            <strong>{sched.phase === 'writing' ? (myEntry?.text ? "Continue today's page" : "Write today's page") : "Today's page"}</strong>
                            <small>{sched.phase === 'writing' ? 'Open until 10:00 PM' : 'Locked at 10:00 PM - read only'}</small>
                        </span>
                        <ChevronRight size={18} />
                    </Link>
                    <Link className="dd-menu-card" to={`/read/${p.id}`}>
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
                            <strong>Profile &amp; settings</strong>
                            <small>Avatars, names and the launch plan</small>
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
    const [save, setSave] = useState<'saved' | 'saving'>('saved');
    const first = useRef(true);

    useEffect(() => {
        if (first.current) { first.current = false; return; }
        setSave('saving');
        const t = setTimeout(() => setSave('saved'), 900);
        return () => clearTimeout(t);
    }, [text]);

    return (
        <main className="dd-shell">
            <TopBar back={`/hub/${p.id}`} backLabel={`Back to ${p.name}'s diary`} alert={Boolean(store.unreadLatest(p.id, now))} />
            <div className="dd-anim" key={`write-${person}`}>
                <div className="dd-hub-head">
                    <span className={`dd-avatar dd-avatar-lg dd-av-${store.avatars[person]}`}>{p.initial}</span>
                    <div>
                        <h1 className="dd-title">{p.name}&rsquo;s Diary</h1>
                        <p className="dd-sub">{fmtDateLong(today)}</p>
                    </div>
                    <span className={`dd-save${save === 'saving' ? ' is-saving' : ''}`}>
                        {locked ? <><Lock size={13} /> Locked</> : save === 'saving' ? 'Saving...' : <><Check size={13} /> Saved</>}
                    </span>
                </div>
                {locked && (
                    <p className="dd-locked"><Lock size={14} /> This page locked at 10:00 PM. Editing and photos open again at 6:00 AM.</p>
                )}
                <div className="dd-paper">
                    <textarea
                        className="dd-editor"
                        value={text}
                        disabled={locked}
                        onChange={e => store.saveText(p.id, today, e.target.value)}
                        placeholder={locked ? '' : `Dear diary, today...`}
                        aria-label={`${p.name}'s diary page for ${fmtDateLong(today)}`}
                        rows={12}
                    />
                </div>
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
                                    store.addPhoto(p.id, today, f);
                                    e.target.value = '';
                                }} />
                            <ImagePlus size={17} /> Add a photo
                        </label>
                    )}
                </div>
            </div>
        </main>
    );
}

// ---------- Reading the other person's diary ----------

export function Read({ viewer }: { viewer: PersonId }) {
    const other = personById(otherId(viewer));
    const store = useStore();
    const now = useNow(15000);
    const sched = schedule(now);
    const latest = latestReadable(now);
    const [date, setDate] = useState(latest);
    const entry: Entry | undefined = store.entries[ekey(other.id, date)];
    const reacts = store.reactions[ekey(other.id, date)] ?? {};
    const mine = reacts[viewer];

    useEffect(() => {
        if (entry) store.markRead(other.id, date, viewer);
    }, [other.id, date, entry?.text]);

    const step = (n: number) => {
        const [y, m, d] = date.split('-').map(Number);
        const t = new Date(Date.UTC(y, m - 1, d + n, 12));
        const k = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
        setDate(k);
    };

    return (
        <main className="dd-shell">
            <TopBar back={`/hub/${viewer}`} backLabel="Back to your diary" alert={Boolean(store.unreadLatest(viewer, now))} />
            <div className="dd-anim" key={`read-${viewer}-${date}`}>
                <div className="dd-hub-head">
                    <span className={`dd-avatar dd-avatar-lg dd-av-${store.avatars[other.id]}`}>{other.initial}</span>
                    <div>
                        <h1 className="dd-title">{other.name}&rsquo;s Diary</h1>
                        <p className="dd-sub">
                            {fmtDateLong(date)}
                            {date === todayKey(now) ? ' - published tonight' : date === latest ? ' - latest page' : ''}
                        </p>
                    </div>
                </div>
                <div className="dd-date-nav">
                    <button type="button" className="dd-iconbtn" onClick={() => step(-1)} aria-label="Previous day"><ChevronLeft /></button>
                    <span className="dd-date-nav-label">{fmtDateShort(date)}</span>
                    <button type="button" className="dd-iconbtn" onClick={() => step(1)} disabled={date >= latest} aria-label="Next day"><ChevronRight /></button>
                </div>
                {entry ? (
                    <>
                        <div className="dd-paper dd-paper-read">
                            <p className="dd-read-text">{entry.text}</p>
                        </div>
                        <PhotoGallery photos={entry.photos} title={`${other.name}'s photos`} />
                        <div className="dd-react">
                            <p className="dd-react-label">React to {other.name}&rsquo;s page</p>
                            <div className="dd-react-row" role="group" aria-label="Emoji reactions">
                                {EMOJIS.map(e => (
                                    <button key={e} type="button"
                                        className={`dd-emoji${mine === e ? ' is-on' : ''}`}
                                        aria-pressed={mine === e}
                                        aria-label={`React ${e}`}
                                        onClick={() => store.toggleReact(other.id, date, viewer, e)}>
                                        {e}
                                    </button>
                                ))}
                            </div>
                            <p className="dd-react-note">
                                {mine ? `You reacted ${mine} - one reaction each, tap again to change` : 'One reaction per page - it shows on their calendar'}
                            </p>
                        </div>
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

    const dayEntries = PEOPLE.map(p => ({ person: p, entry: store.entries[ekey(p.id, day)] }));

    return (
        <main className="dd-shell">
            <TopBar back={`/hub/${viewer}`} backLabel="Back to your diary" alert={Boolean(store.unreadLatest(viewer, now))} />
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
                    {(['all', 'joydeep', 'aruba'] as const).map(f => (
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
                                <span><i className="dd-hue-pink-bg" /> Joydeep wrote</span>
                                <span><i className="dd-hue-lavender-bg" /> Aruba wrote</span>
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
                                            <span className={`dd-avatar dd-avatar-sm dd-av-${store.avatars[person.id]}`}>{person.initial}</span>
                                            <strong>{person.name}&rsquo;s page</strong>
                                            {mine && <Chip tone="plain">yours</Chip>}
                                        </div>
                                        {entry && readable ? (
                                            <>
                                                <p className="dd-dayentry-text">{entry.text}</p>
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

export function Settings() {
    const store = useStore();
    const auth = useAuth();
    const now = useNow(30000);
    return (
        <main className="dd-shell dd-shell-narrow">
            <TopBar back="/" backLabel="Back to the books" />
            <div className="dd-anim" key="settings">
                <h1 className="dd-title">Profile &amp; settings</h1>
                <p className="dd-sub">Two people, two books, one little space</p>

                {PEOPLE.map(p => (
                    <section key={p.id} className="dd-card">
                        <div className="dd-dayentry-head">
                            <span className={`dd-avatar dd-avatar-lg dd-av-${store.avatars[p.id]}`}>{p.initial}</span>
                            <div>
                                <strong className="dd-card-title">{p.name}</strong>
                                <p className="dd-card-sub">{p.name}&rsquo;s Diary - owner since the beginning</p>
                            </div>
                        </div>
                        {auth.me === p.id && (
                            <>
                                <p className="dd-card-label">Cover avatar</p>
                                <div className="dd-swatches" role="group" aria-label={`Avatar colour for ${p.name}`}>
                                    {Array.from({ length: AVATARS }, (_, i) => (
                                        <button key={i} type="button"
                                            className={`dd-swatch dd-av-${i}${store.avatars[p.id] === i ? ' is-on' : ''}`}
                                            aria-label={`Avatar style ${i + 1}`}
                                            aria-pressed={store.avatars[p.id] === i}
                                            onClick={() => store.setAvatar(p.id, i)}>
                                            {p.initial}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </section>
                ))}

                <section className="dd-card">
                    <p className="dd-card-label">Names</p>
                    <p className="dd-card-body">Display names stay <strong>Joydeep</strong> and <strong>Aruba</strong> everywhere - custom profiles arrive with the January launch.</p>
                </section>

                <Link className="dd-menu-card" to="/notifications">
                    <span className="dd-menu-icon"><Bell /></span>
                    <span className="dd-menu-text">
                        <strong>Notification preferences</strong>
                        <small>Reminders for 6 AM and 10 PM</small>
                    </span>
                    <ChevronRight size={18} />
                </Link>

                <section className="dd-card dd-card-soft">
                    <p className="dd-card-label"><Sparkles size={14} /> About Dear Diary</p>
                    <p className="dd-card-body">A little space for two, a new page every day. Launching <strong>1 January 2027</strong>.</p>
                </section>

                <button type="button" className="dd-btn dd-btn-ghost" onClick={() => auth.signOut()}>Sign out</button>
                <span style={{ display: 'none' }}>{now.toISOString()}</span>
            </div>
        </main>
    );
}

// ---------- Notification preferences ----------

const NOTIFS: { key: string; label: string; hint: string }[] = [
    { key: 'open', label: 'Writing window opens', hint: 'A gentle nudge at 6:00 AM when today\u2019s page opens' },
    { key: 'lock', label: 'Diaries lock', hint: 'A reminder at 9:45 PM, before everything locks at 10:00 PM' },
    { key: 'published', label: 'A new page is published', hint: 'When the other diary opens for reading at 10:00 PM' },
    { key: 'reaction', label: 'Reactions', hint: 'When a heart (or a \uD83E\uDD7A) lands on your page' },
];

export function Notifications() {
    const store = useStore();
    return (
        <main className="dd-shell dd-shell-narrow">
            <TopBar back="/settings" backLabel="Back to settings" />
            <div className="dd-anim" key="notifs">
                <h1 className="dd-title">Notifications</h1>
                <p className="dd-sub">Soft reminders, never noise</p>
                <section className="dd-card">
                    {NOTIFS.map(n => (
                        <Toggle key={n.key} label={n.label} hint={n.hint}
                            on={Boolean(store.notifPrefs[n.key])} onChange={v => store.setNotifPref(n.key, v)} />
                    ))}
                </section>
                <p className="dd-card-note"><Users size={14} /> Preferences save to your account. Reminders themselves switch on with the launch.</p>
            </div>
        </main>
    );
}
