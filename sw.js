/* Road Trip EV — service worker
   Coquille d'application mise en cache : l'app se lance et fonctionne
   sans réseau une fois visitée. Les saisies vivent dans localStorage,
   elles ne dépendent pas d'ici.

   À chaque modification d'un fichier listé, incrémenter VERSION —
   sinon les anciens fichiers restent servis depuis le cache. */

const VERSION = 'roadtrip-ev-v1';
/* Pas de './' ici : c'est la même ressource que './index.html', et si
   l'hébergeur ne la sert pas, addAll échoue en bloc et le worker ne
   s'installe jamais — le hors ligne meurt en silence. */
const COQUILLE = [
  './index.html',
  './style.css',
  './app.js',
  './data.json',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      // Une entrée manquante ne doit pas empêcher les autres d'être mises
      // en cache : addAll est tout ou rien, c.add par fichier ne l'est pas.
      .then((c) => Promise.all(
        COQUILLE.map((u) => c.add(u).catch((err) => console.warn('non caché :', u, err)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

/* Réseau d'abord, cache en secours : en ligne on voit toujours la
   dernière version ; hors ligne on garde l'app. */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((rep) => {
        const copie = rep.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copie));
        return rep;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
