/* Emojiverse (לשעבר כובש) – Service Worker: שומר את כל הקבצים לעבודה מלאה בלי אינטרנט */
const VERSION = 'emojiverse-20261102151236';
const ASSETS = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/boot.js', './js/game.js', './js/ai.js', './js/terrain.js', './js/input.js', './js/avatars.js', './js/emoji.js', './js/fx.js', './js/net.js', './js/main.js', './js/mp.js', './js/vendor/peerjs.min.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-192.png', './icons/maskable-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return; // שרת התיאום של האונליין – תמיד מהרשת
  if (e.request.mode === 'navigate') { // דף ראשי: קודם רשת (עדכון מיידי), נפילה למטמון אחרי 3 שניות / בלי אינטרנט
    e.respondWith(new Promise(res => {
      let done = false;
      const fromCache = () => caches.match('./index.html', { ignoreVary: true }).then(h => { if (!done && h) { done = true; res(h); } return h; });
      const t = setTimeout(fromCache, 3000);
      fetch(e.request).then(r => { clearTimeout(t); if (!done) { done = true; res(r); } })
        .catch(() => { clearTimeout(t); fromCache().then(h => { if (!done) { done = true; res(h || Response.error()); } }); });
    }));
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true, ignoreVary: true }).then(hit => hit || fetch(e.request).catch(() => caches.match('./index.html', { ignoreVary: true })))
  );
});
