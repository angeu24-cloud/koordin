// KOORDIN — service worker : l'application s'ouvre même avec un réseau faible.
// Les fichiers de l'application sont mis en cache ; les données viennent toujours de Supabase.
const CACHE = 'koordin-v14';
const FICHIERS = ['./', 'index.html', 'styles.css?v=14', 'app.js?v=14', 'config.js?v=14', 'vendor/supabase.js', 'vendor/chart.umd.js', 'icon.svg', 'manifest.webmanifest', 'version.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord (pour toujours avoir la dernière version), cache si hors ligne.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Les vidéos du guide sont lues directement (trop lourdes pour le cache)
  if (/\/guide-[a-z]+\.(mp4|jpg)$/.test(url.pathname)) return;
  // Toujours vérifier auprès du serveur pour récupérer la dernière version publiée
  const reseau = e.request.mode === 'navigate' ? fetch(e.request) : fetch(e.request, { cache: 'no-cache' });
  e.respondWith(
    reseau
      .then((rep) => {
        const copie = rep.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copie));
        return rep;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
