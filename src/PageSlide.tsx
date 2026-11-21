import React, { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigationType } from 'react-router-dom';

type TransitionDocument = Document & {
    startViewTransition?: (update: () => void) => { finished: Promise<void>; skipTransition: () => void };
};

// Snapshot only route content, never the fixed dock or the app-entry gate.
// No duplicate live route trees, forms, effects or PIN handlers during a slide.
export function PageSlide({ children }: { children: (location: ReturnType<typeof useLocation>) => React.ReactNode }) {
    const location = useLocation();
    const navigation = useNavigationType();
    const [shown, setShown] = useState(location);
    const lastIndex = useRef<number>(window.history.state?.idx ?? 0);
    const pending = useRef<ReturnType<NonNullable<TransitionDocument['startViewTransition']>> | null>(null);
    useLayoutEffect(() => {
        if (shown.key === location.key && shown.pathname === location.pathname && shown.search === location.search) return;
        const index = window.history.state?.idx ?? lastIndex.current;
        const back = navigation === 'POP' && index < lastIndex.current;
        lastIndex.current = index;
        const doc = document as TransitionDocument;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // Replacement redirects (including PIN guards) must settle immediately.
        const skip = reduced || navigation === 'REPLACE' || !!document.querySelector('dialog[open], .dd-crop-overlay');
        pending.current?.skipTransition();
        if (!doc.startViewTransition || skip) {
            setShown(location);
            return;
        }
        document.documentElement.dataset.pageSlide = back ? 'back' : 'forward';
        const transition = doc.startViewTransition(() => {
            flushSync(() => setShown(location));
        });
        pending.current = transition;
        void transition.finished.catch(() => {}).finally(() => {
            if (pending.current !== transition) return;
            pending.current = null;
            delete document.documentElement.dataset.pageSlide;
        });
    }, [location, shown, navigation]);
    useLayoutEffect(() => () => { pending.current?.skipTransition(); }, []);
    return <div className="dd-route-page">{children(shown)}</div>;
}
