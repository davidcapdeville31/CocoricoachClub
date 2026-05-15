import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ---- Service Worker registration (PWA assets + Background Sync) ----
// Activé uniquement en production (cocoricoachclub.com ou PWA installée).
// La preview Lovable et les iframes désenregistrent tout SW pour ne pas casser l'éditeur.
(function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("lovable.app") ||
    host.includes("lovableproject.com") ||
    host.includes("lovable.dev") ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (isInIframe || isPreviewHost) {
    // Nettoyage : si un ancien sw.js avait été enregistré, on le retire ici.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        if (r.active && r.active.scriptURL.endsWith("/sw.js")) r.unregister();
      });
    }).catch(() => null);
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("[SW] registration failed", err));
  });
})();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
