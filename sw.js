// Escale — service worker : permet d'installer l'appli et de l'ouvrir sans réseau.
// Stratégie « réseau d'abord » : la version en ligne est toujours prise si possible,
// la copie en cache sert seulement hors ligne.
const CACHE = 'escale-v1';
const SHELL = ['./', 'index.html', 'app.js', 'firebase-config.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Fichiers de l'appli + bibliothèque Firebase (pour démarrer hors ligne). Jamais les requêtes de données.
  const ok = url.origin === location.origin || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));
  if (!ok) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
