const CACHE_PREFIX = "passage-pwa-";
const CACHE_VERSION = `${CACHE_PREFIX}v1`;
const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cacheControl = response.headers.get("Cache-Control") || "";
          if (
            response.ok &&
            response.type === "basic" &&
            !/\bno-store\b/i.test(cacheControl)
          ) {
            const cache = await caches.open(CACHE_VERSION);
            await cache.put(new Request(`${url.origin}${url.pathname}`), response.clone());
          }
          return response;
        } catch {
          const cachedPage = await caches.match(new Request(`${url.origin}${url.pathname}`));
          return cachedPage || caches.match("/offline.html");
        }
      })()
    );
    return;
  }

  if (!url.pathname.startsWith("/_next/static/")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cachedAsset = await cache.match(request);
      if (cachedAsset) return cachedAsset;

      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    })()
  );
});
