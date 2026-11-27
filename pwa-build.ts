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
// Inbox is separate from the public shell cache and is filtered by recipient account.
function storeInbox(notice) {
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('dear-diary-inbox',1);
  request.onupgradeneeded=()=>{const store=request.result.createObjectStore('notifications',{keyPath:'id'});store.createIndex('account','account_id');};
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result;const tx=db.transaction('notifications','readwrite');const store=tx.objectStore('notifications');
   store.put(notice);
   const read=store.index('account').getAll(notice.account_id);
   read.onsuccess=()=>{const rows=read.result.sort((a,b)=>b.received_at-a.received_at);for(const row of rows.slice(200))store.delete(row.id);};
   tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};
  };
 });
}
// Re-check the recipient account and foreground state in each live app window.
// Never suppress from a server presence lease, which can outlive a closed window.
async function chatIsInForeground(accountId) {
 if(typeof accountId!=='string')return false;
 const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
 const visible=windows.filter(client=>{
  try{const url=new URL(client.url);return url.origin===self.location.origin&&url.pathname.startsWith(BASE)&&client.visibilityState==='visible'&&client.focused;}catch{return false;}
 });
 const answers=await Promise.all(visible.map(client=>new Promise(resolve=>{
  const channel=new MessageChannel();let done=false;
  const finish=value=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();resolve(value);};
  const timer=setTimeout(()=>finish(false),500);
  channel.port1.onmessage=event=>finish(event.data?.account_id===accountId&&event.data?.foreground===true);
  try{client.postMessage({type:'diary-check-chat-foreground'},[channel.port2]);}catch{finish(false);}
 })));
 return answers.some(Boolean);
}
async function friendPrivacyOn(){
 return new Promise(resolve=>{const request=indexedDB.open('dear-diary-privacy',1);request.onupgradeneeded=()=>request.result.createObjectStore('state');request.onerror=()=>resolve(true);request.onsuccess=()=>{const db=request.result,tx=db.transaction('state','readonly'),read=tx.objectStore('state').get('friend');read.onsuccess=()=>{db.close();resolve(read.result===true);};read.onerror=()=>{db.close();resolve(true);};};});
}
self.addEventListener('message',event=>{if(event.data?.type==='diary-friend-privacy'&&event.ports?.[0])event.ports[0].postMessage({friendPrivacy:1});});
async function privateNotification(title,options){if(await friendPrivacyOn())return;return self.registration.showNotification(title,options);}
self.addEventListener('push', event => {
 let data={};try{data=event.data?event.data.json():{};}catch{}
 const body=typeof data.body==='string'?data.body.slice(0,500):'Open Dear Diary for your reminder.';
 const tag=typeof data.tag==='string'?data.tag.slice(0,150):'diary-reminder';
 event.waitUntil((async()=>{
  if(await friendPrivacyOn())return;
  // Old payloads without an account remain generic OS alerts, never mixed into an inbox.
  if(data.type==='feed'&&typeof data.post_id==='string'&&/^[0-9a-f-]{36}$/i.test(data.post_id)){
   await privateNotification('Dear Diary',{body,icon:BASE+'icons/diary-192.png',badge:BASE+'icons/diary-192.png',tag,data:{feed:true,post_id:data.post_id,account_id:data.account_id},renotify:false});return;
  }
  if(data.type==='chat'){
   if(await chatIsInForeground(data.account_id).catch(()=>false))return;
   const who=typeof data.title==='string'?data.title.slice(0,40):'Dear Diary';
   await privateNotification(who,{body,icon:BASE+'icons/diary-192.png',badge:BASE+'icons/diary-192.png',tag,data:{chat:true,account_id:data.account_id},actions:data.reply_action===true?[{action:'reply',title:'Open to reply'}]:[],renotify:true});
   return;
  }
  if(typeof data.account_id==='string' && /^[0-9a-f-]{36}$/i.test(data.account_id)){
   const type=['open','writing','lock','published','scheduled_sent','friend_free','ask'].includes(data.type)?data.type:'reminder';
   await storeInbox({id:data.account_id+':'+tag,account_id:data.account_id,title:'Dear Diary',body,received_at:Date.now(),type}).catch(()=>{});
   for(const client of await clients.matchAll({type:'window',includeUncontrolled:true}))client.postMessage({type:'diary-inbox-updated',account_id:data.account_id});
  }
  await privateNotification('Dear Diary',{body,icon:BASE+'icons/diary-192.png',badge:BASE+'icons/diary-192.png',tag,data:{url:BASE+'#/inbox'},renotify:false});
 })());
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 event.waitUntil((async()=>{
  if(await friendPrivacyOn()){const windows=await clients.matchAll({type:'window',includeUncontrolled:true});const app=windows.find(c=>new URL(c.url).pathname.startsWith(BASE));return app?app.focus():clients.openWindow(BASE);}
  const feed=event.notification.data?.feed===true&&/^[0-9a-f-]{36}$/i.test(event.notification.data?.post_id);
  const chat=Boolean(event.notification.data&&event.notification.data.chat);
  const reply=chat&&event.action==='reply';
  const url=feed?BASE+'#/?post='+event.notification.data.post_id:BASE+(chat?(reply?'#/chat?compose=1':'#/chat'):'#/inbox');const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  const app=windows.find(client=>new URL(client.url).pathname.startsWith(BASE));
  if(app&&feed)app.postMessage({type:'diary-open-feed',post_id:event.notification.data.post_id,account_id:event.notification.data.account_id});
  if(app&&chat)app.postMessage({type:'diary-open-chat',compose:reply,account_id:event.notification.data.account_id});
  // Do not navigate an open editor away from an unsaved diary page.
  if(app)return app.focus();
  return clients.openWindow(url);
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
