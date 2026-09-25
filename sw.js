// URBANSTYLE FASHION service worker
// - The store page is fetched fresh from the network every time (so updates show immediately),
//   with the last saved copy used only when the customer is offline.
// - Icons and other files from this site are cached for fast repeat visits.
// - Anything from other sites (Firebase, Paystack, fonts) and the /api/ payment check is never cached.
const CACHE = "urbanstyle-v3"; // change this name whenever you want every visitor's saved copy cleared
const SHELL = ["./", "./index.html", "./icon-192.png", "./icon-512.png", "./manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    // network first: always the latest store; fall back to the saved copy offline
    e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("./index.html")).then(r => r || caches.match("./"))));
    return;
  }
  // other same-site files: serve from cache, refresh in the background
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
