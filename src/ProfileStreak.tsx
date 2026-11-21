import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { PersonId } from './model';

interface Streak { current_streak: number; wrote_today: boolean }

export function useProfileStreaks(day: string, saved: string) {
    const [streaks, setStreaks] = useState<Partial<Record<PersonId, Streak>>>({});
    const [failed, setFailed] = useState(false);
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        let active = true;
        let request = 0;
        const refresh = async () => {
            const current = ++request;
            const { data, error } = await supabase.rpc('diary_streaks');
            if (!active || current !== request) return;
            setFailed(!!error);
            if (!error && data) {
                const next: Partial<Record<PersonId, Streak>> = {};
                for (const row of data) {
                    if (row.username === 'joydeep' || row.username === 'aruba') {
                        next[row.username as PersonId] = row;
                    }
                }
                setStreaks(next);
            }
        };
        void refresh();
        const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
        document.addEventListener('visibilitychange', visible);
        return () => { active = false; document.removeEventListener('visibilitychange', visible); };
    }, [day, saved, retry]);
    return { streaks, failed, retry: () => setRetry(n => n + 1) };
}

export function ProfileStreak({ streak, failed, retry, own }: {
    streak?: Streak; failed: boolean; retry: () => void; own: boolean;
}) {
    if (failed) return <p className="dd-streak-note">Streak unavailable. <button type="button" className="dd-streak-retry" onClick={retry}>Retry</button></p>;
    if (!streak) return <p className="dd-streak-note" role="status">Loading streak...</p>;
    const count = streak.current_streak;
    return <div className={`dd-streak${count ? ' is-lit' : ''}`}>
        <div className="dd-streak-badge">
            <svg width="23" height="27" viewBox="0 0 24 28" fill="none" aria-hidden="true">
                <path d="M13.4 2C14.8 8.6 7.5 8.8 9.2 14.2C6.7 13.5 6 11.7 6.1 10.2C1.2 15.8 3 25 11.7 25.5C21 26 23.1 15.7 18.3 10.7C18.3 13.6 16.8 14.5 16.3 14.8C18 9.9 16.5 5.1 13.4 2Z" fill="currentColor" opacity=".85"/>
                <path d="M12.2 15.8C12.8 18.5 9.5 19.1 9.7 21.4C9.8 23.1 11.1 24 12.5 24C16.5 23.9 16.3 19 12.2 15.8Z" fill="#fff4dc"/>
            </svg>
            <strong>{count} day streak</strong>
        </div>
        <p className="dd-streak-note">{count === 0
            ? (own ? 'A little writing today starts a new streak.' : 'A new streak is waiting to begin.')
            : streak.wrote_today
                ? 'Today is counted. A little memory, kept.'
                : (own ? 'Write today to keep your streak going.' : 'Continues with a little writing today.')}</p>
        <span className="dd-streak-time">Saved writing · IST days</span>
    </div>;
}
