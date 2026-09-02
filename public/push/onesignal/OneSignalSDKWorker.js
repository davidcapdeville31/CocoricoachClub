importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// --- App badge support (Android PWA / Chrome desktop) ---
// OneSignal handles the notification display; we only manage the icon badge counter.

const BADGE_CACHE = "ccc-badge-count-v1";
const BADGE_KEY = "badge-count";

async function getBadgeCount() {
  try {
    const cache = await caches.open(BADGE_CACHE);
    const response = await cache.match(BADGE_KEY);
    if (!response) return 0;
    const data = await response.json();
    return typeof data.count === "number" ? data.count : 0;
  } catch {
    return 0;
  }
}

async function setBadgeCount(count) {
  try {
    const cache = await caches.open(BADGE_CACHE);
    await cache.put(BADGE_KEY, new Response(JSON.stringify({ count })));
  } catch {
    // ignore
  }
}

async function notifyClientsBadge(count) {
  try {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: "UPDATE_APP_BADGE", count }));
  } catch {
    // ignore
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const current = await getBadgeCount();
      const next = current + 1;
      await setBadgeCount(next);
      await notifyClientsBadge(next);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.waitUntil(
    (async () => {
      await setBadgeCount(0);
      await notifyClientsBadge(0);
    })()
  );
});

