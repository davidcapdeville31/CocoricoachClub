/* CocoriCoach Club — Service Worker (assets cache + Background Sync)
 * Activé uniquement en production (cocoricoachclub.com / PWA installée).
 * La preview Lovable et les iframes désenregistrent ce SW depuis main.tsx.
 */

const CACHE_VERSION = "v2";
const STATIC_CACHE = `ccc-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `ccc-runtime-${CACHE_VERSION}`;
const API_CACHE = `ccc-api-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => null))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("ccc-") && ![STATIC_CACHE, RUNTIME_CACHE, API_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Helpers
const isStaticAsset = (url) =>
  /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico|gif)$/i.test(url.pathname);

const isSupabaseApi = (url) => /\.supabase\.co$/.test(url.hostname) && url.pathname.startsWith("/rest/");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Ne jamais intercepter OAuth / auth / realtime / functions
  if (
    url.pathname.startsWith("/~oauth") ||
    url.pathname.startsWith("/auth/") ||
    (isSupabaseApi(url) === false && /\.supabase\.co$/.test(url.hostname))
  ) {
    return;
  }

  // 1) Static assets → Cache First
  if (url.origin === self.location.origin && isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => null);
          }
          return res;
        });
      })
    );
    return;
  }

  // 2) Supabase REST GET → Network First avec fallback cache
  if (isSupabaseApi(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(API_CACHE).then((c) => c.put(req, copy)).catch(() => null);
          }
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } })))
    );
    return;
  }

  // 3) Navigations HTML → Network First, fallback shell cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/").then((c) => c || Response.error()))
    );
    return;
  }
});

// Background Sync — déclenche un message à tous les clients pour qu'ils flush la queue IndexedDB
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-pending-data") {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        clients.forEach((c) => c.postMessage({ type: "SYNC_PENDING_DATA" }));
      })()
    );
  }
});
