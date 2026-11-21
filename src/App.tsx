import React from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, StoreProvider, isUnlocked, useAuth } from './store';
import { PersonId, publishWaitMs, schedule } from './model';
import { useNow } from './ui';
import { AppEntryGate, Calendar, ChangePassword, ChangePin, Home, HowToUse, Hub, Login, Notifications, Pin, Read, Settings, Write } from './screens';
import grain from './photos/grain.png';
import { OfflineNotice } from './pwa';
import { BottomNav } from './BottomNav';
import { ThemeFrame } from './Themes';
import { PageSlide } from './PageSlide';

function Guarded({ person, children }: { person: PersonId; children: React.ReactNode }) {
    const auth = useAuth();
    const now = useNow(1000);
    if (person === auth.me && schedule(now).phase !== 'writing') return <>{children}</>;
    if ((person !== auth.me && publishWaitMs(now) !== null) || !isUnlocked(person)) return <Navigate to={`/pin/${person}`} replace />;
    return <>{children}</>;
}

function HubRoute() {
    const { person } = useParams();
    const auth = useAuth();
    const now = useNow(1000);
    if (schedule(now).phase !== 'writing') return person === auth.me
        ? <Hub person={person as PersonId} />
        : <Navigate to={`/published/${person}`} replace />;
    return <Guarded person={person as PersonId}><Hub person={person as PersonId} /></Guarded>;
}
function WriteRoute() {
    const { person } = useParams();
    const now = useNow(1000);
    if (schedule(now).phase !== 'writing') return <Navigate to={`/published/${person}`} replace />;
    return <Guarded person={person as PersonId}><Write person={person as PersonId} /></Guarded>;
}
function ReadRoute() {
    const { viewer } = useParams();
    return <Guarded person={viewer as PersonId}><Read viewer={viewer as PersonId} /></Guarded>;
}
function CalendarRoute() {
    const { viewer } = useParams();
    return <Guarded person={viewer as PersonId}><Calendar viewer={viewer as PersonId} /></Guarded>;
}
function PublishedRoute() {
    const { person } = useParams();
    const auth = useAuth();
    const now = useNow(1000);
    if (schedule(now).phase === 'writing') return <Navigate to={`/pin/${person}`} replace />;
    return <Read viewer={auth.me!} publishedOwner={person as PersonId} />;
}
function PinRoute() {
    const { person } = useParams();
    // Key by person: a fresh component per diary, so PIN state never leaks across books.
    return <Pin key={person} person={person as PersonId} />;
}

function Shell() {
    const auth = useAuth();
    const [live, setLive] = React.useState(false);
    React.useEffect(() => {
        document.title = auth.session && auth.me ? 'Dear Diary - Joydeep & Aruba' : 'Dear Diary';
    }, [auth.session, auth.me]);
    React.useEffect(() => setLive(true), []);

    if (!auth.ready) {
        return <main className="dd-shell dd-shell-narrow"><p className="dd-sub" style={{ marginTop: '40vh', textAlign: 'center' }}>Opening your diaries...</p></main>;
    }
    if (!auth.session || !auth.me) {
        return (
            <div className={live ? 'dd-app dd-live' : 'dd-app'}>
                <div className="dd-grain" style={{ backgroundImage: `url(${grain})` }} />
                <Login />
            </div>
        );
    }
    return (
        <StoreProvider key={auth.session.user.id} me={auth.me}>
            <ThemeFrame key={auth.session.user.id} className={live ? 'dd-app dd-live' : 'dd-app'}>
                <div className="dd-grain" style={{ backgroundImage: `url(${grain})` }} />
                <AppEntryGate>
                <div className="dd-with-nav">
                <PageSlide>{location => <Routes location={location}>
                    <Route path="/" element={<Home />} />
                    <Route path="/pin/:person" element={<PinRoute />} />
                    <Route path="/published/:person" element={<PublishedRoute />} />
                    <Route path="/hub/:person" element={<HubRoute />} />
                    <Route path="/write/:person" element={<WriteRoute />} />
                    <Route path="/read/:viewer" element={<ReadRoute />} />
                    <Route path="/calendar/:viewer" element={<CalendarRoute />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/settings/how-to-use" element={<HowToUse />} />
                    <Route path="/settings/password" element={<ChangePassword />} />
                    <Route path="/settings/pin" element={<ChangePin />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="*" element={<Home />} />
                </Routes>}</PageSlide>
                <BottomNav />
                </div>
                </AppEntryGate>
            </ThemeFrame>
        </StoreProvider>
    );
}

export function App() {
    return (
        <>
            <OfflineNotice />
            <AuthProvider>
                <Shell />
            </AuthProvider>
        </>
    );
}
