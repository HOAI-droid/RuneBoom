// runeBOOM offline: einmal geladen, startet das Spiel auch ohne Netz. Neue Fassungen werden im Hintergrund geholt.
const SPEICHER = 'runeboom-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(SPEICHER).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest']))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SPEICHER).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET' || !r.url.startsWith(self.location.origin)) return;
  // Seite: zuerst das Netz (neue Fassung), sonst aus dem Speicher; alles andere: Speicher zuerst (Dateien tragen Prüfsummen im Namen)
  if (r.mode === 'navigate') { e.respondWith(fetch(r).then((a) => { const k = a.clone(); caches.open(SPEICHER).then((c) => c.put(r, k)); return a; }).catch(() => caches.match(r).then((x) => x || caches.match('./index.html')))); return; }
  e.respondWith(caches.match(r).then((x) => x || fetch(r).then((a) => { if (a.ok) { const k = a.clone(); caches.open(SPEICHER).then((c) => c.put(r, k)); } return a; })));
});
