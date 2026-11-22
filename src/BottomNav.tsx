import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './store';
import { BookOpen, CalendarDays, Gear, HomeIcon } from './icons';

export function BottomNav() {
    const { me } = useAuth();
    const { pathname } = useLocation();
    const active = (pathname === '/' || pathname === '/inbox') ? 'home'
        : pathname.startsWith('/calendar/') ? 'calendar'
        : pathname.startsWith('/settings') || pathname === '/notifications' ? 'settings'
        : 'entries';
    const tabs = [
        { id: 'home', label: 'Home', to: '/', Icon: HomeIcon },
        { id: 'entries', label: 'My diary', to: `/hub/${me}`, Icon: BookOpen },
        { id: 'calendar', label: 'History', to: `/calendar/${me}`, Icon: CalendarDays },
        { id: 'settings', label: 'Settings', to: '/settings', Icon: Gear },
    ];
    return <nav className="dd-bottom-nav" aria-label="Main navigation">
        {tabs.map(({ id, label, to, Icon }) => <Link key={id} to={to}
            className={`dd-bottom-tab${active === id ? ' is-current' : ''}`}
            aria-current={active === id ? 'page' : undefined}>
            <Icon size={22} /><span>{label}</span>
        </Link>)}
    </nav>;
}
