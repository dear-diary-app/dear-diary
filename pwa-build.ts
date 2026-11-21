import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Every cached byte comes from the public production build, never a live request.
export function diaryPwa() {
    return {
        name: 'dear-diary-private-shell',
        closeBundle() {
            const base = '/dear-diary/';
            const walk = (dir: string, prefix = ''): string[] => readdirSync(dir, { withFileTypes: true })
                .flatMap(item => item.isDirectory() ? walk(join(dir, item.name), prefix + item.name + '/') : [prefix + item.name]);
            const files = walk('dist').filter(path => path !== 'sw.js');
            const hash = createHash('sha256');
            for (const file of files.sort()) hash.update(file).update(readFileSync(join('dist', file)));
            const version = hash.digest('hex').slice(0, 16);
            const urls = files.map(path => base + path).concat(base);
            writeFileSync('dist/sw.js', `/* Dear Diary public shell ${version}. No API or diary caching. */
const CACHE = 'dear-diary-shell-${version}';
const BASE = '${base}';
const FILES = ${JSON.stringify(urls)};
const STATIC = new Set(FILES);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map(url => new Request(url, {cache:'reload', credentials:'omit'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('dear-diary-shell-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.search) return;
  if (req.mode === 'navigate' && (url.pathname === BASE || url.pathname === BASE + 'index.html')) {
    event.respondWith((async () => {
      try {
        const online = await fetch(req, {cache:'no-store'});
        if (online.ok) return online;
        const fallback = await caches.match(BASE + 'index.html', {cacheName:CACHE});
        return fallback || online;
      } catch {
        return (await caches.match(BASE + 'index.html', {cacheName:CACHE})) || Response.error();
      }
    })());
    return;
  }
  if (!STATIC.has(url.pathname)) return;
  event.respondWith((async () => (await caches.match(req, {cacheName:CACHE})) || fetch(req))());
});
`);
        },
    };
}
