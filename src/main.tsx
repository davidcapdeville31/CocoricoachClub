import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ---- Service Worker cleanup for Lovable editor/preview ----
// Le SW de l'app (`/sw.js`) est enregistré par <PWAUpdatePrompt /> via Workbox,
// qui gère proprement les updates (skipWaiting + controllerchange + reload auto).
// Ici on se contente de nettoyer les enregistrements en preview/iframe.
(function cleanupServiceWorkerInPreview() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const host = window.location.hostname;

  const isLovableEditorPreview =
    host.endsWith("lovableproject.com") ||
    host.endsWith("lovable.dev") ||
    host.startsWith("id-preview--") ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (isInIframe || isLovableEditorPreview) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        const url = r.active?.scriptURL || "";
        if (url.endsWith("/sw.js")) r.unregister();
      });
    }).catch(() => null);
  }
})();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
