import { useEffect } from "react";

const CACHE_RESET_VERSION = "2026-09-14-wellness-v1";

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

    const clearLegacyAppCache = async () => {
      const controllerUrl = navigator.serviceWorker.controller?.scriptURL ?? "";
      const wasControlledByLegacyAppWorker =
        controllerUrl.endsWith("/sw.js") && !controllerUrl.includes("/push/onesignal/");

      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.map((registration) => {
          const url = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || "";
          if (url.includes("/push/onesignal/")) return Promise.resolve(false);
          return registration.unregister();
        }),
      );

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) =>
              key.includes("workbox") ||
              key.includes("html-cache") ||
              key.includes("supabase-api-cache") ||
              key.includes("ccc-"),
            )
            .map((key) => caches.delete(key)),
        );
      }

      // Une page déjà contrôlée peut avoir lancé ses requêtes avant le nettoyage.
      // Un seul rechargement remet aussi le cache mémoire de données à zéro.
      if (
        wasControlledByLegacyAppWorker &&
        sessionStorage.getItem("ccc-cache-reset") !== CACHE_RESET_VERSION
      ) {
        sessionStorage.setItem("ccc-cache-reset", CACHE_RESET_VERSION);
        window.location.reload();
      }
    };

    clearLegacyAppCache().catch(() => null);

    return () => {
      void swDisabled;
    };
  }, [swDisabled]);

  return null;
};

export default PWAUpdatePrompt;
