// KOORDIN — service worker : l'application s'ouvre même avec un réseau faible.
// Les fichiers de l'application sont mis en cache ; les données viennent toujours de Supabase.
const CACHE = 'koordin-v336';
const FICHIERS = ['./', 'index.html', 'styles.min.css?v=336', 'app.min.js?v=336', 'config.js?v=336', 'vendor/supabase.js', 'icon.svg', 'icon-192.png', 'badge-96.png', 'manifest.webmanifest', 'version.json'];

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

const mettreEnCache = (req, rep) => { if (rep && rep.ok) { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put(req, copie)); } return rep; };
// Réseau avec délai : au-delà, on montre la version gardée sur le téléphone
const reseauAvecDelai = (req, ms) => new Promise((ok, ko) => {
  const t = setTimeout(() => ko(new Error('lent')), ms);
  fetch(req, { cache: 'no-cache' }).then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); ko(e); });
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Les vidéos du guide sont lues directement (trop lourdes pour le cache)
  if (/\/guide-[a-z]+\.(mp4|jpg)$/.test(url.pathname)) return;
  const page = e.request.mode === 'navigate' || /\/(index\.html|version\.json)?$/.test(url.pathname);
  if (page) {
    // La page d'accueil et le numéro de version : réseau d'abord (3 s), sinon cache
    const reseau = fetch(e.request, { cache: 'no-cache' }).then((r) => mettreEnCache(e.request, r));
    e.respondWith(reseauAvecDelai(e.request, 3000).then((r) => mettreEnCache(e.request, r))
      .catch(() => caches.match(e.request).then((r) => r || reseau).catch(() => caches.match('index.html'))));
    return;
  }
  // Fichiers de l'application (versionnés) : cache d'abord, c'est instantané ; sinon réseau puis cache
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((rep) => mettreEnCache(e.request, rep))));
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
