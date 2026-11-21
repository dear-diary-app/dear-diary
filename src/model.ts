// Dear Diary - data model and IST schedule helpers (Prompt 2: Supabase-backed).

export type PersonId = 'joydeep' | 'aruba';

export interface Person {
    id: PersonId;
    name: string;
    initial: string;
    hue: 'pink' | 'lavender';
}

export const PEOPLE: Person[] = [
    { id: 'joydeep', name: 'Joydeep', initial: 'J', hue: 'pink' },
    { id: 'aruba', name: 'Aruba', initial: 'A', hue: 'lavender' },
];

export const personById = (id: PersonId): Person => PEOPLE.find(p => p.id === id)!;
export const otherId = (id: PersonId): PersonId => (id === 'joydeep' ? 'aruba' : 'joydeep');

export const EMOJIS = ['❤️', '🥺', '😭', '😂', '✨', '🫂', '🤍', '😊', '🌸', '🫶'];

import type { Sticker } from './Stickers';

export interface Entry {
    date: string; // IST calendar date, yyyy-mm-dd
    person: PersonId;
    text: string;
    photos: string[]; // signed URLs or data URIs
    stickers?: Sticker[];
    status?: 'draft' | 'published';
}

export const ekey = (p: PersonId, d: string) => `${p}|${d}`;

// ---------- IST time helpers (schedule is fixed to Asia/Kolkata) ----------

const IST = 'Asia/Kolkata';
const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function istParts(d = new Date()) {
    const p: Record<string, string> = {};
    for (const part of dtf.formatToParts(d)) p[part.type] = part.value;
    return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

export function todayKey(d = new Date()): string {
    const p = istParts(d);
    return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

// UTC timestamp of a given IST wall-clock time.
export function istTimestamp(y: number, mo: number, d: number, h: number, mi: number): number {
    const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
    const p = istParts(new Date(guess));
    const asIf = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
    return guess + (guess - asIf);
}

export function shiftKey(key: string, days: number): string {
    const [y, m, dd] = key.split('-').map(Number);
    const t = istTimestamp(y, m, dd, 12, 0);
    const u = new Date(t + days * 864e5);
    return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(u.getUTCDate()).padStart(2, '0')}`;
}

export type Phase = 'writing' | 'quiet' | 'reading';

export interface Schedule {
    phase: Phase;
    label: string;
    next: string;
    countdownMs: number;
}

// 6:00 AM - 10:00 PM writing; 10:00 PM - 6:00 AM reading; midnight - 6 AM quiet hours.
export function schedule(d = new Date()): Schedule {
    const p = istParts(d);
    const mins = p.h * 60 + p.mi;
    if (mins >= 360 && mins < 1320) {
        return {
            phase: 'writing',
            label: 'Writing time - both diaries are open',
            next: 'diaries lock at 10:00 PM',
            countdownMs: istTimestamp(p.y, p.mo, p.d, 22, 0) - d.getTime(),
        };
    }
    if (mins < 360) {
        return {
            phase: 'quiet',
            label: "Quiet hours - yesterday's pages stay open",
            next: 'writing opens at 6:00 AM',
            countdownMs: istTimestamp(p.y, p.mo, p.d, 6, 0) - d.getTime(),
        };
    }
    return {
        phase: 'reading',
        label: "Reading time - tonight's pages are open to each other",
        next: 'a new page opens at 6:00 AM',
        countdownMs: istTimestamp(p.y, p.mo, p.d, 6, 0) + 864e5 - d.getTime(),
    };
}

// Display-only countdown to today's publish, never used to grant access.
export function publishWaitMs(now = new Date()): number | null {
    const p = istParts(now);
    if (p.h >= 22) return null;
    return Math.max(0, istTimestamp(p.y, p.mo, p.d, 22, 0) - now.getTime());
}

export function fmtCountdown(ms: number): string {
    const m = Math.max(0, Math.ceil(ms / 60000));
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h <= 0) return `${r} min`;
    return `${h} h ${String(r).padStart(2, '0')} min`;
}

export function fmtDateLong(key: string): string {
    const [y, m, d] = key.split('-').map(Number);
    const t = new Date(istTimestamp(y, m, d, 12, 0));
    return new Intl.DateTimeFormat('en-IN', { timeZone: IST, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(t);
}

export function fmtDateShort(key: string): string {
    const [y, m, d] = key.split('-').map(Number);
    const t = new Date(istTimestamp(y, m, d, 12, 0));
    return new Intl.DateTimeFormat('en-IN', { timeZone: IST, weekday: 'short', day: 'numeric', month: 'short' }).format(t);
}

export function istClock(d = new Date()): string {
    return new Intl.DateTimeFormat('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(d);
}

// The most recent date whose entries are published (readable by the other person).
export function latestReadable(now = new Date()): string {
    const today = todayKey(now);
    return schedule(now).phase === 'reading' ? today : shiftKey(today, -1);
}

export function isReadable(date: string, now = new Date()): boolean {
    return date <= latestReadable(now);
}
