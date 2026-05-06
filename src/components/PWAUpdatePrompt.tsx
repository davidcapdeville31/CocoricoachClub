import { useEffect, useRef, useState } from "react";
import { Workbox } from "workbox-window";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, X } from "lucide-react";

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

const isInIframe = () => {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    return true;
  }
};

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // toutes les 5 min

const PWAUpdatePrompt = () => {
  const disabled = isPreviewHost();
  const [needRefresh, setNeedRefresh] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const wbRef = useRef<Workbox | null>(null);

  useEffect(() => {
    if (disabled || !("serviceWorker" in navigator)) {
      navigator.serviceWorker?.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      return;
    }

    const wb = new Workbox("/sw.js");
    wbRef.current = wb;

    // Reload automatique quand le nouveau SW prend le contrôle
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Nouvelle version en attente → activation automatique immédiate
    const autoApply = () => {
      setNeedRefresh(true);
      try {
        wb.messageSkipWaiting();
      } catch {
        // fallback
        setTimeout(() => window.location.reload(), 500);
      }
    };
    wb.addEventListener("waiting", autoApply);
    // @ts-ignore - workbox émet aussi 'externalwaiting' dans certains cas
    wb.addEventListener("externalwaiting" as any, autoApply);

    let cleanup: (() => void) | undefined;

    wb.register({ immediate: true })
      .then((registration) => {
        if (!registration) return;

        // Si un SW est déjà en attente au moment du load → activation auto
        if (registration.waiting) {
          setNeedRefresh(true);
          try {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          } catch {}
        }

        const check = () => registration.update().catch(() => {});
        const intervalId = window.setInterval(check, CHECK_INTERVAL_MS);
        const onFocus = () => check();
        const onOnline = () => check();
        const onVisibility = () => {
          if (document.visibilityState === "visible") check();
        };
        window.addEventListener("focus", onFocus);
        window.addEventListener("online", onOnline);
        document.addEventListener("visibilitychange", onVisibility);

        // Vérification immédiate
        check();

        cleanup = () => {
          window.clearInterval(intervalId);
          window.removeEventListener("focus", onFocus);
          window.removeEventListener("online", onOnline);
          document.removeEventListener("visibilitychange", onVisibility);
        };
      })
      .catch((err) => console.warn("[PWA] SW registration error", err));

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      cleanup?.();
    };
  }, [disabled]);

  if (disabled || !needRefresh || dismissed) return null;

  const handleUpdate = () => {
    const wb = wbRef.current;
    if (!wb) {
      window.location.reload();
      return;
    }
    // Demande au SW en attente de s'activer → controllerchange → reload
    wb.messageSkipWaiting();
    // Filet de sécurité au cas où controllerchange ne se déclencherait pas
    setTimeout(() => window.location.reload(), 1500);
  };

  const handleDismiss = () => setDismissed(true);

  return (
    <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-top-5">
      <Card className="p-4 shadow-lg border-2 border-primary/20 bg-background">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Nouvelle version disponible</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Une nouvelle version de l'application est disponible. Mettez à jour pour profiter des dernières améliorations.
            </p>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleUpdate} size="sm" className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" />
                Rafraîchir
              </Button>
              <Button onClick={handleDismiss} size="sm" variant="ghost">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PWAUpdatePrompt;
