const CACHE = "english-drill-2026.08.2-r2";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./src/app.js",
  "./src/content-service.js",
  "./src/storage-service.js",
  "./data/manifest.json",
  "./data/curriculum.json",
  "./data/import-report.json",
  ...["a1", "a2", "b1", "b2"].flatMap((level) => ["verbs", "pronouns", "vocabulary", "expressions", "grammar-items", "communication"].map((catalog) => `./data/levels/${level}/${catalog}.json`)),
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match("./index.html"));
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === "navigate";
  const isVersionPointer = url.pathname.endsWith("/data/manifest.json") || url.pathname.endsWith("/index.html");
  event.respondWith(isNavigation || isVersionPointer ? networkFirst(request) : cacheFirst(request));
});
