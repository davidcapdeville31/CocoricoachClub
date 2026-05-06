import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const TRIGGER_DISTANCE = 80;
const MAX_PULL = 140;

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-ignore - iOS
    window.navigator.standalone === true
  );
};

const isInIframe = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const PullToRefresh = () => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const active = useRef(false);

  useEffect(() => {
    // Désactivé en preview/iframe et sur desktop non-tactile
    if (isInIframe()) return;
    const isTouch = "ontouchstart" in window;
    if (!isTouch) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
      active.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active.current || startY.current === null || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      // Friction
      const eased = Math.min(MAX_PULL, delta * 0.5);
      setPull(eased);
    };

    const onTouchEnd = async () => {
      if (!active.current) return;
      active.current = false;
      const shouldRefresh = pull >= TRIGGER_DISTANCE;
      startY.current = null;

      if (!shouldRefresh) {
        setPull(0);
        return;
      }

      setRefreshing(true);
      setPull(TRIGGER_DISTANCE);

      try {
        // Force la vérification d'une nouvelle version PWA
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.update().catch(() => {})));
        }
      } catch {
        // ignore
      }

      // Petit délai pour feedback visuel puis reload
      setTimeout(() => {
        window.location.reload();
      }, 400);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pull, refreshing]);

  if (pull === 0 && !refreshing) return null;

  const progress = Math.min(1, pull / TRIGGER_DISTANCE);
  const ready = pull >= TRIGGER_DISTANCE;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-start justify-center pointer-events-none"
      style={{
        transform: `translateY(${Math.max(0, pull - 40)}px)`,
        transition: refreshing ? "transform 200ms ease-out" : "none",
      }}
    >
      <div className="mt-2 rounded-full bg-background/95 backdrop-blur-sm shadow-lg border border-border p-2.5">
        <RefreshCw
          className={`w-5 h-5 text-primary ${refreshing ? "animate-spin" : ""}`}
          style={{
            transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
            opacity: ready || refreshing ? 1 : 0.4 + progress * 0.6,
          }}
        />
      </div>
    </div>
  );
};

export default PullToRefresh;
