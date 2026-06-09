import { useEffect } from "react";

const isPreviewHost = () => {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return (
    import.meta.env.DEV ||
    hostname.includes("id-preview--") ||
    hostname.includes("localhost") ||
    hostname.includes("lovableproject.com")
  );
};

const PWAUpdatePrompt = () => {
  const swDisabled = isPreviewHost();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        const url = r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || "";
        if (url.includes("/push/onesignal/")) return;
        r.unregister().catch(() => null);
      });
    }).catch(() => null);

    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          if (key.includes("workbox") || key.includes("html-cache") || key.includes("supabase-api-cache") || key.includes("ccc-")) {
            caches.delete(key).catch(() => false);
          }
        });
      }).catch(() => null);
    }

    return () => {
      void swDisabled;
    };
  }, [swDisabled]);

  return null;
};

export default PWAUpdatePrompt;
