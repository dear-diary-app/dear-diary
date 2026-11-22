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
    await Promise.all(FILES.map(async path => {
      const url = new URL(path, self.location.origin);
      url.searchParams.set('__shell', '${version}');
      const response = await fetch(url, {cache:'reload', credentials:'omit'});
      if (!response.ok) throw new Error('Public shell download failed');
      await cache.put(path, response);
    }));
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
self.addEventListener('push', event => {
  let data = {}; try { data = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(self.registration.showNotification('Dear Diary', {
    body: typeof data.body === 'string' ? data.body : 'Open Dear Diary for your reminder.',
    icon: BASE + 'icons/diary-192.png', badge: BASE + 'icons/diary-192.png',
    tag: typeof data.tag === 'string' ? data.tag : 'diary-reminder',
    data: {url:BASE}, renotify:false
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await clients.matchAll({type:'window',includeUncontrolled:true});
    const app = windows.find(client => new URL(client.url).pathname.startsWith(BASE));
    if(app) return app.focus();
    return clients.openWindow(BASE);
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.search) return;
  if (req.mode === 'navigate' && (url.pathname === BASE || url.pathname === BASE + 'index.html')) {
    event.respondWith((async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const fresh = new URL(req.url);
        fresh.searchParams.set('__shell', String(Date.now()));
        const online = await fetch(fresh, {cache:'no-store', credentials:'omit', signal:controller.signal});
        if (online.ok) return online;
        const fallback = await caches.match(BASE + 'index.html', {cacheName:CACHE});
        return fallback || online;
      } catch {
        return (await caches.match(BASE + 'index.html', {cacheName:CACHE})) || Response.error();
      } finally { clearTimeout(timeout); }
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
