/* Numéro de version : à incrémenter à CHAQUE mise à jour du site.
   C'est ce qui force les téléphones à récupérer la nouvelle version
   au lieu de rester bloqués sur l'ancienne en cache. */
const APP_VERSION = '3.9.0';
const CACHE_NAME = 'mes-voyages-' + APP_VERSION;

const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './leaflet.js',
  './leaflet.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Nunito:wght@400;600;700;800&family=Playfair+Display:wght@700;800&family=Caveat:wght@700&family=Bebas+Neue&family=Roboto+Mono:wght@600;700&family=Montserrat:wght@700;800&family=Lobster&family=Oswald:wght@600;700&family=Dancing+Script:wght@700&display=swap',
  './jspdf.umd.min.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS).catch(function(err) { console.warn('SW cache partial fail:', err); });
    })
  );
  // NE PAS forcer skipWaiting ici : on laisse l'appli demander la mise à jour
  // elle-même (bandeau "nouvelle version"), pour ne jamais couper l'utilisateur
  // en pleine édition.
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k!==CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('message', function(e) {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.startsWith('chrome-extension')) return;

  // Page principale (navigation) : toujours essayer le RÉSEAU d'abord,
  // pour être sûr d'avoir la dernière version quand il y a du réseau.
  // Le cache ne sert que si le téléphone est hors-ligne.
  if (e.request.mode === 'navigate' || (e.request.method==='GET' && e.request.headers.get('accept') && e.request.headers.get('accept').indexOf('text/html')>-1)) {
    e.respondWith(
      fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(e.request, clone); });
        }
        return response;
      }).catch(function(){
        return caches.match(e.request).then(function(cached){ return cached || caches.match('./index.html'); });
      })
    );
    return;
  }

  // Le reste (polices, icônes, jsPDF...) : cache d'abord, réseau en secours
  // (ces fichiers ne changent presque jamais, pas besoin de revérifier à chaque fois).
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        if (response && response.status === 200 && response.type !== 'opaque') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(e.request, clone); });
        }
        return response;
      }).catch(function(){ return caches.match('./index.html'); });
    })
  );
});
