/* Service worker de Pronoun Drill.
 * Al cambiar el "shell" (index.html, sw.js, iconos) sube el número de versión
 * para forzar la actualización en los dispositivos ya instalados. */
const CACHE = "english-drill-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./frases.json",
  "./modales.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Datos → network-first: si hay conexión, ves las ediciones al recargar.
  if (url.pathname.endsWith("frases.json") || url.pathname.endsWith("modales.json")) {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Resto → cache-first (rápido y offline).
  e.respondWith(caches.match(req).then((res) => res || fetch(req)));
});
