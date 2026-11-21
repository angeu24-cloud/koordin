// KOORDIN — service worker : l'application s'ouvre même avec un réseau faible.
// Les fichiers de l'application sont mis en cache ; les données viennent toujours de Supabase.
const CACHE = 'koordin-v45';
const FICHIERS = ['./', 'index.html', 'styles.css?v=45', 'app.js?v=45', 'config.js?v=45', 'vendor/supabase.js', 'vendor/chart.umd.js', 'icon.svg', 'icon-192.png', 'badge-96.png', 'manifest.webmanifest', 'version.json'];

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

// ─── Notifications (même quand KOORDIN est fermé) ───
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { corps: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // KOORDIN est ouvert et visible : l'application affiche déjà l'alerte (ou fait sonner l'appel)
    if (fenetres.some((c) => c.visibilityState === 'visible')) return;
    await self.registration.showNotification(d.titre || 'KOORDIN', {
      body: d.corps || '',
      icon: 'icon-192.png',
      badge: 'badge-96.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      requireInteraction: !!d.urgent,
      vibrate: d.urgent ? [400, 200, 400, 200, 800] : [120, 60, 120],
      data: { lien: d.lien || '#/dashboard' },
      lang: 'fr',
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const lien = (e.notification.data && e.notification.data.lien) || '#/dashboard';
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const ouverte = fenetres.find((c) => c.url.startsWith(self.registration.scope));
    if (ouverte) { await ouverte.focus(); ouverte.postMessage({ type: 'koordin-aller', lien }); return; }
    await self.clients.openWindow(new URL(lien, self.registration.scope).href);
  })());
});
