import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './store';
import { useChat } from './ChatStore';
import { otherId, personById } from './model';
import { Avatar } from './ui';
import { BookOpen, CalendarDays, UserRound, HomeIcon, MessageCircle, Bell, Gear } from './icons';

// Touch-capable devices deliberately keep the existing phone/tablet UI, even
// a large tablet with a trackpad. Only a large, non-touch desktop opts in.
export function useDesktopLayout() {
    const [desktop, setDesktop] = useState(false);
    useEffect(() => {
        const query = window.matchMedia('(min-width: 1280px) and (hover: hover) and (pointer: fine)');
        const update = () => setDesktop(query.matches && navigator.maxTouchPoints === 0 && !/Android|iPad|iPhone|Mobile|Tablet/i.test(navigator.userAgent));
        update(); query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    return desktop;
}

export function DesktopFrame({ children }: { children: React.ReactNode }) {
    const desktop = useDesktopLayout();
    return <div className={`dd-with-nav${desktop ? ' dd-desktop' : ''}`}>{desktop && <DesktopNav/>}{children}</div>;
}
function DesktopNav() {
    const { me } = useAuth(), { unread } = useChat(), { pathname } = useLocation();
    const tabs = [
        { label: 'Home', to: '/', Icon: HomeIcon, active: pathname === '/' },
        { label: 'My diary', to: `/hub/${me}`, Icon: BookOpen, active: /^\/(hub|write|read|pin|published)\//.test(pathname) },
        { label: 'Messages', to: '/chat', Icon: MessageCircle, active: pathname.startsWith('/chat') },
        { label: 'History', to: `/calendar/${me}`, Icon: CalendarDays, active: pathname.startsWith('/calendar/') },
        { label: 'Notifications', to: '/inbox', Icon: Bell, active: pathname === '/inbox' },
        { label: 'Profile', to: '/profile', Icon: UserRound, active: pathname.startsWith('/profile') },
    ];
    return <aside className="dd-desktop-sidebar"><Link to="/" className="dd-desktop-brand"><img src={`${import.meta.env.BASE_URL}icons/diary-192.png`} alt="" width="31" height="31"/><span>Dear Diary</span></Link>
        <nav aria-label="Desktop navigation">{tabs.map(({ label, to, Icon, active }) => <Link key={label} to={to} aria-current={active ? 'page' : undefined}><span className="dd-desktop-navicon"><Icon size={25}/>{label === 'Messages' && unread > 0 && <i aria-label={`${unread} unread messages`}>{unread > 99 ? '99+' : unread}</i>}</span><span>{label}</span></Link>)}</nav>
        <Link to="/settings" className="dd-desktop-more" aria-current={pathname.startsWith('/settings') || pathname === '/notifications' ? 'page' : undefined}><Gear size={25}/><span>Settings</span></Link>
    </aside>;
}
export function DesktopConversations() {
    const { me } = useAuth(), chat = useChat();
    const partner = personById(otherId(me!));
    const last = chat.messages[chat.messages.length - 1];
    const preview = chat.partnerTyping ? 'Typing...' : !last ? 'Your private conversation' : last.effect === 'blur' ? 'Hidden message' : last.audio ? 'Voice message' : last.images?.length ? 'Photo' : last.gif_id ? 'GIF' : last.sticker ? 'Sticker' : last.song ? 'Song' : last.weather ? 'Weather' : last.body?.startsWith('__') || last.body?.startsWith('dd:') ? 'Message' : last.body || 'Message';
    return <aside className="dd-desktop-conversations" aria-label="Conversations"><header><h1>{personById(me!).name}</h1><Link to="/profile" aria-label="Your profile"><UserRound size={23}/></Link></header><div className="dd-desktop-inbox-title"><h2>Messages</h2><span>Just you two</span></div>
        <Link to="/chat/thread" className="dd-desktop-conversation" aria-current="page"><Avatar person={partner}/><span><strong>{partner.name}</strong><small>{preview}</small></span>{chat.unread > 0 && <i aria-label="Unread messages"/>}</Link>
        <p className="dd-desktop-private"><BookOpen size={15}/> A private space for your shared moments.</p>
    </aside>;
}
