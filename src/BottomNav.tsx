import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './store';
import { BookOpen, CalendarDays, Gear, HomeIcon, MessageCircle } from './icons';
import { useChat } from './ChatStore';

export function BottomNav() {
    const { me } = useAuth();
    const { unread } = useChat();
    const { pathname } = useLocation();
    const active = (pathname === '/' || pathname === '/inbox') ? 'home'
        : pathname.startsWith('/calendar/') ? 'calendar'
        : pathname === '/chat' ? 'chat'
        : pathname.startsWith('/settings') || pathname === '/notifications' ? 'settings'
        : 'entries';
    // The conversation is full screen, like Instagram: it has its own back arrow.
    if (pathname === '/chat') return null;
    const tabs = [
        { id: 'home', label: 'Home', to: '/', Icon: HomeIcon },
        { id: 'entries', label: 'My diary', to: `/hub/${me}`, Icon: BookOpen },
        { id: 'chat', label: 'Chat', to: '/chat', Icon: MessageCircle },
        { id: 'calendar', label: 'History', to: `/calendar/${me}`, Icon: CalendarDays },
        { id: 'settings', label: 'Settings', to: '/settings', Icon: Gear },
    ];
    return <nav className="dd-bottom-nav" aria-label="Main navigation">
        {tabs.map(({ id, label, to, Icon }) => <Link key={id} to={to}
            className={`dd-bottom-tab${active === id ? ' is-current' : ''}`}
            aria-current={active === id ? 'page' : undefined}>
            <span className="dd-tab-icon"><Icon size={22} />{id === 'chat' && unread > 0 && active !== 'chat' && <i className="dd-tab-dot" aria-label={`${unread} unread chat ${unread === 1 ? 'message' : 'messages'}`} />}</span><span>{label}</span>
        </Link>)}
    </nav>;
}
