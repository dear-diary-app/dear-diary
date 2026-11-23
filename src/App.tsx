import React from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, StoreProvider, isUnlocked, useAuth } from './store';
import { PersonId, publishWaitMs, schedule, otherId, personById } from './model';
import { ChatProvider } from './ChatStore';
import { ChatView } from './Chat';
import { useNow } from './ui';
import { AppEntryGate, Calendar, ChangePassword, ChangePin, Home, HowToUse, Hub, Login, Notifications, Pin, Read, Settings, Write } from './screens';
import grain from './photos/grain.png';
import { OfflineNotice } from './pwa';
import { WhatsNew } from './WhatsNew';
import { ProfilePage } from './Profile';
import { BottomNav } from './BottomNav';
import { ThemeFrame } from './Themes';
import { PageSlide } from './PageSlide';
import { TabSwipe } from './TabSwipe';
import { NotificationInbox } from './NotificationInbox';
import { finishLaunch } from './launch';

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
function ChatRoute() {
    const auth = useAuth();
    return <ChatView partner={personById(otherId(auth.me!))} />;
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
    React.useEffect(() => {
        if (auth.ready || auth.loadError) finishLaunch();
    }, [auth.ready, auth.loadError]);
    React.useEffect(() => {
        if (auth.ready && !auth.session) {
            document.documentElement.style.removeProperty('--dd-canvas');
            document.documentElement.style.removeProperty('--dd-colour-scheme');
        }
    }, [auth.ready, auth.session]);

    if (!auth.ready) {
        return <main className="dd-auth-splash" aria-busy={!auth.loadError}>
            <h1>Dear Diary</h1>
            <p role="status">{auth.loadError || 'Opening your diaries...'}</p>
            {auth.loadError && <div><button className="dd-btn dd-btn-primary" onClick={auth.retryAuth}>Retry</button>
                <button className="dd-btn dd-btn-ghost" onClick={() => void auth.signOut()}>Sign out</button></div>}
        </main>;
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
                <ChatProvider uid={auth.session.user.id}>
                <TabSwipe><div className="dd-with-nav">
                <PageSlide>{location => <Routes location={location}>
                    <Route path="/" element={<Home />} />
                    <Route path="/pin/:person" element={<PinRoute />} />
                    <Route path="/published/:person" element={<PublishedRoute />} />
                    <Route path="/hub/:person" element={<HubRoute />} />
                    <Route path="/write/:person" element={<WriteRoute />} />
                    <Route path="/read/:viewer" element={<ReadRoute />} />
                    <Route path="/calendar/:viewer" element={<CalendarRoute />} />
                    <Route path="/chat/*" element={<ChatRoute />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/profile/:person" element={<ProfilePage />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/settings/how-to-use" element={<HowToUse />} />
                    <Route path="/settings/whats-new" element={<WhatsNew />} />
                    <Route path="/settings/password" element={<ChangePassword />} />
                    <Route path="/settings/pin" element={<ChangePin />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/inbox" element={<NotificationInbox />} />
                    <Route path="*" element={<Home />} />
                </Routes>}</PageSlide>
                <BottomNav />
                </div></TabSwipe>
                </ChatProvider>
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
