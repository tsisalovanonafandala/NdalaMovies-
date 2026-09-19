/* NdalaMovies — service worker : application utilisable hors ligne */
const CACHE = 'ndalamovies-v3';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Fichiers du SDK Firebase (versions figées) : cache d'abord */
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

/* Fichiers de l'app : réseau d'abord (mises à jour immédiates), cache si hors ligne ou trop lent */
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
  net.catch(() => {});
  try {
    const res = await Promise.race([net, new Promise(r => setTimeout(() => r(null), 4000))]);
    if (res) return res;
  } catch (e) {}
  const hit = (await cache.match(req, { ignoreSearch: true })) ||
              (req.mode === 'navigate' ? await cache.match('./index.html') : null);
  if (hit) return hit;
  return net.catch(() => Response.error());
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/')) {
    e.respondWith(cacheFirst(req));
  } else if (u.origin === location.origin) {
    e.respondWith(networkFirst(req));
  }
});
