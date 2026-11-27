import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './store';
import { BookOpen, CalendarDays, UserRound, HomeIcon, MessageCircle, ReelsIcon } from './icons';
import { useChat } from './ChatStore';
import{usePageLocked}from'./DesktopIdleLock';
import{openInstagramFromTab}from'./instagramNative';

export function BottomNav() {
    const { me } = useAuth();
    const locked=usePageLocked();
    const { unread } = useChat();
    const { pathname,search } = useLocation();
    const active = (pathname === '/' || pathname === '/inbox') ? 'home'
        : pathname==='/instagram'?'reels'
        : pathname.startsWith('/calendar/') ? 'calendar'
        : pathname.startsWith('/chat') ? 'chat'
        : pathname.startsWith('/profile') ? 'profile'
        : pathname.startsWith('/settings') || pathname === '/notifications' || pathname === '/instagram' ? ''
        : 'entries';
    // The conversation is full screen, like Instagram: it has its own back arrow.
    if (pathname.startsWith('/chat/') || (pathname==='/chat'&&!!search)) return null;
    const tabs = [
        { id: 'home', label: 'Home', to: '/', Icon: HomeIcon },
        { id: 'entries', label: 'My diary', to: `/hub/${me}`, Icon: BookOpen },
        { id: 'chat', label: 'Chat', to: '/chat', Icon: MessageCircle, ReelsIcon },
        { id: 'reels', label: 'Reels', to: '/instagram', Icon: ReelsIcon },
        { id: 'profile', label: 'Profile', to: '/profile', Icon: UserRound },
    ];
    return <><div className="dd-dock-frost" aria-hidden="true"/><nav className="dd-bottom-nav dd-bottom-nav-five" aria-label="Main navigation">
        {tabs.map(({ id, label, to, Icon }) => <Link key={id} to={to}
            onClick={id==='reels'?e=>openInstagramFromTab(e,locked):undefined}
            className={`dd-bottom-tab${active === id ? ' is-current' : ''}`}
            aria-current={active === id ? 'page' : undefined}>
            <span className="dd-tab-icon"><Icon size={22} />{id === 'chat' && unread > 0 && active !== 'chat' && <i className="dd-tab-dot" aria-label={`${unread} unread chat ${unread === 1 ? 'message' : 'messages'}`} />}</span><span>{label}</span>
        </Link>)}
    </nav></>;
}
