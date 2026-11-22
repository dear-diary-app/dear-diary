import React, { useEffect } from 'react';
import { TopBar } from './ui';
import { useAuth } from './store';

// To add a feature: put a new item at the TOP of the first release, or add a new release above it.
// Newest first. `id` must be unique; the newest id drives the "New" badge in Settings.
export interface Feature { id: string; title: string; text: string; emoji: string }
export interface Release { date: string; label: string; features: Feature[] }

export const RELEASES: Release[] = [
    { date: '2026-11-22', label: 'Sunday, 22 November', features: [
        { id: 'whatsnew', emoji: '🆕', title: "This What's new page", text: 'A list of every new feature, newest first, with a small "New" badge in Settings when something has been added since you last looked.' },
        { id: 'chat', emoji: '💬', title: 'Chat', text: 'A private chat between you two, in its own tab. Swipe a message right to reply, tap it to react, copy or unsend. Send any sticker. You can see when the other person is typing, and when your message is Seen. Turn on "New chat messages" in Notifications to get an alert.' },
        { id: 'songs', emoji: '🎵', title: 'Songs on diary pages', text: 'Add a song to a page: search in English or Hindi, play a 30-second preview, then tap Use. Your reader sees the song at the top once the page is published.' },
        { id: 'blur', emoji: '🙈', title: 'Blur when minimised', text: 'Dear Diary blurs itself when you switch apps or minimise it, so nobody sees your page by accident. (It cannot stop screenshots.) Tap to bring it back.' },
        { id: 'stickers', emoji: '🌿', title: '44 stickers', text: '20 new everyday stickers and a new Everyday tab. There are now 44 stickers in total.' },
        { id: 'opening', emoji: '✨', title: 'Opening animation', text: 'A soft, themed opening of about four seconds when you start the app. It matches your theme, and a tap anywhere skips it.' },
        { id: 'pdf', emoji: '📄', title: 'Readable PDF, locked with your PIN', text: 'Download your own diary as a nicely arranged PDF with dated pages and sticker artwork. Every PDF is locked: you type your diary PIN when you download it, and the same PIN opens the file. If you change your PIN later, old PDFs keep the PIN they were made with. Photos are not in the PDF. Find it in Settings under "Your diary, to keep".' },
        { id: 'json', emoji: '💾', title: 'JSON backup', text: 'A fresh backup of your own saved pages, in the same place as the PDF. It is not PIN-locked, so keep the file somewhere safe. Your partner\'s pages are never included.' },
        { id: 'fold', emoji: '🗂️', title: 'Tidier settings', text: 'Themes and downloads now fold away, so Settings is shorter. Tap a heading to open it. Your own profile now comes first, in Settings and in the History filters, and the buttons are evenly sized for easier tapping.' },
        { id: 'smooth', emoji: '🌊', title: 'Smoother feel', text: 'Pages slide sideways as you move around, and your phone\'s Back button slides them back. Buttons respond with a gentle press, and changing theme fades instead of jumping. The top and bottom bars of your phone now match your theme too.' },
        { id: 'start', emoji: '🛠️', title: 'Steadier start', text: 'The app now waits for your profile to load before leaving the starting screen, so you do not briefly see the wrong screen or name.' },
        { id: 'inbox', emoji: '📬', title: 'Notification inbox', text: 'The bell now opens a list of reminders you have received, kept separately for each person. Reminder options live on their own page. The app icon now shows on page headers.' },
        { id: 'reminders', emoji: '🔔', title: 'Reminders', text: 'Optional phone reminders at 6 AM, 9 PM, 9:45 PM and 10 PM, plus a list of the ones you received. Turn each one on or off in Notifications.' },
    ] },
    { date: '2026-11-21', label: 'Saturday, 21 November', features: [
        { id: 'streaks', emoji: '🔥', title: 'Writing streaks', text: 'Your profile counts how many days in a row you saved a page. Days follow Indian time, and the count is worked out privately on the server.' },
        { id: 'themes', emoji: '🎨', title: 'Background themes', text: 'Choose Warm paper, soft pastels or the dark Midnight theme. It is saved to your account.' },
        { id: 'install', emoji: '📱', title: 'Install on your home screen', text: 'Add Dear Diary to your phone like an app. See Download Dear Diary in Settings.' },
    ] },
];
export const LATEST_ID = RELEASES[0].features[0].id;
const key = (uid: string) => `dd_whatsnew_seen_${uid}`;
export function hasNewFeatures(uid: string | undefined): boolean {
    if (!uid) return false;
    try { return localStorage.getItem(key(uid)) !== LATEST_ID; } catch { return false; }
}

export function WhatsNew() {
    const auth = useAuth();
    const uid = auth.session?.user.id;
    useEffect(() => { if (uid) try { localStorage.setItem(key(uid), LATEST_ID); } catch { /* ignore */ } }, [uid]);
    return <main className="dd-shell dd-shell-narrow">
        <TopBar back="/settings" backLabel="Back to settings" />
        <article className="dd-anim dd-whatsnew" aria-label="What's new in Dear Diary">
            <h1 className="dd-title">What's new</h1>
            <p className="dd-sub">Everything added to Dear Diary so far, newest first.</p>
            {RELEASES.map(r => <section key={r.date} aria-label={r.label}>
                <h2 className="dd-whatsnew-date"><time dateTime={r.date}>{r.label}</time></h2>
                <ul className="dd-whatsnew-list">
                    {r.features.map(f => <li key={f.id} className="dd-card dd-whatsnew-item">
                        <span className="dd-whatsnew-emoji" aria-hidden="true">{f.emoji}</span>
                        <div><strong className="dd-card-title">{f.title}</strong><p className="dd-card-body">{f.text}</p></div>
                    </li>)}
                </ul>
            </section>)}
        </article>
    </main>;
}
