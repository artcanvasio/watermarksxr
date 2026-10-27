/* WatermarksXR service worker: app shell + assets cached for offline use. Bump VERSION on every release. */
const VERSION = 'wxr-v1.0.0';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'ar.js', 'manifest.webmanifest',
  'vendor/lucide.min.js', 'vendor/three.module.min.js', 'vendor/mindar-image.prod.js', 'vendor/controller-mGt1s8dJ.js', 'vendor/ui-fBadYuor.js',
  'targets/targets.mind',
  'assets/souvenir.png', 'assets/souvenir-front.png', 'assets/map.png', 'assets/fountain.png', 'assets/riverside.png', 'assets/icekanal.png',
  'assets/panel-towers.jpg', 'assets/panel-fountain.jpg', 'assets/panel-kanal.jpg', 'assets/panel-river.jpg', 'assets/icon.svg', 'assets/icon-180.png', 'assets/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // network first for the shell (so updates land), cache first for everything else
  const shell = /\/(index\.html)?$|\.js$|\.css$|\.webmanifest$/.test(url.pathname);
  e.respondWith(shell
    ? fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request))
    : caches.match(e.request).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })));
});
