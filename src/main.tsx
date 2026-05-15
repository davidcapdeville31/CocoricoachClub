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

  // ⚠️ Important: on ne désactive le SW QUE dans les vrais previews/éditeurs Lovable.
  // Le domaine PUBLIÉ "cocoricoachclub.lovable.app" doit conserver les service workers
  // (sinon OneSignal ne peut pas enregistrer son worker push → erreur "SSL/Push registration failed").
  const isLovableEditorPreview =
    host.endsWith("lovableproject.com") || // sandbox éditeur
    host.endsWith("lovable.dev") ||        // outils Lovable
    host.startsWith("id-preview--") ||     // previews jetables
    host === "localhost" ||
    host === "127.0.0.1";

  if (isInIframe || isLovableEditorPreview) {
    // Nettoyage : si un ancien sw.js avait été enregistré dans un preview, on le retire.
    // ⚠️ On ne touche PAS au worker OneSignal, indispensable aux push.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        const url = r.active?.scriptURL || "";
        if (url.endsWith("/sw.js")) r.unregister();
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
