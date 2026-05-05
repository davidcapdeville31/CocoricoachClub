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
    hostname.includes("localhost")
  );
};

const isInIframe = () => {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    return true;
  }
};

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

const PWAUpdatePrompt = () => {
  const disabled = isPreviewHost() || isInIframe();
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

    // Nouvelle version en attente → propose au user
    wb.addEventListener("waiting", () => setNeedRefresh(true));

    wb.register()
      .then((registration) => {
        if (!registration) return;
        const check = () => registration.update().catch(() => {});
        const intervalId = window.setInterval(check, CHECK_INTERVAL_MS);
        window.addEventListener("focus", check);
        window.addEventListener("online", check);
        return () => {
          window.clearInterval(intervalId);
          window.removeEventListener("focus", check);
          window.removeEventListener("online", check);
        };
      })
      .catch((err) => console.warn("[PWA] SW registration error", err));

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
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
                Mettre à jour
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
