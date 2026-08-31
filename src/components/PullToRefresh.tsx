import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const TRIGGER_DISTANCE = 70;
const MAX_PULL = 140;

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
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const getScrollTop = () => {
  return Math.max(
    window.scrollY || 0,
    document.documentElement?.scrollTop || 0,
    document.body?.scrollTop || 0,
  );
};

const getScrollableParent = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element)) return null;

  let current: Element | null = target;
  while (current && current !== document.body) {
    if (current instanceof HTMLElement) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      const canScroll = /(auto|scroll|overlay)/.test(overflowY) && current.scrollHeight > current.clientHeight;
      if (canScroll) return current;
    }
    current = current.parentElement;
  }

  return null;
};

const getTopOffset = (scrollContainer: HTMLElement | null) => {
  if (scrollContainer) return Math.max(scrollContainer.scrollTop, 0);
  return getScrollTop();
};

/**
 * Le pull-to-refresh ne doit JAMAIS déclencher un rechargement quand
 * l'utilisateur est en train de saisir des données (dialog / sheet ouvert,
 * champ de saisie actif, scroll verrouillé par Radix…) : cela ferait perdre
 * toute la séance en cours de création.
 */
const isEditingContext = (target: EventTarget | null): boolean => {
  if (typeof document === "undefined") return false;

  // Radix verrouille le scroll du body quand un Dialog/Sheet modal est ouvert
  if (document.body.hasAttribute("data-scroll-locked")) return true;

  // Un dialog / sheet / drawer / popover ouvert quelque part dans la page
  if (
    document.querySelector(
      '[role="dialog"],[role="alertdialog"],[data-radix-popper-content-wrapper],[data-vaul-drawer]',
    )
  ) {
    return true;
  }

  // Champ de saisie focus
  const activeEl = document.activeElement as HTMLElement | null;
  if (
    activeEl &&
    (activeEl.tagName === "INPUT" ||
      activeEl.tagName === "TEXTAREA" ||
      activeEl.tagName === "SELECT" ||
      activeEl.isContentEditable)
  ) {
    return true;
  }

  // Le geste démarre à l'intérieur d'un formulaire / d'une zone de saisie
  if (target instanceof Element && target.closest('form,[data-no-pull-refresh="true"]')) {
    return true;
  }

  return false;
};

const PullToRefresh = () => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const lastY = useRef<number>(0);
  const active = useRef(false);
  const pullRef = useRef(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isInIframe() && !isPreviewHost()) return;
    const isTouch = "ontouchstart" in window || (navigator as any).maxTouchPoints > 0;
    if (!isTouch) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (isEditingContext(e.target)) {
        startY.current = null;
        active.current = false;
        return;
      }
      scrollContainerRef.current = getScrollableParent(e.target);
      // On regarde le scroll au moment du touch
      if (getTopOffset(scrollContainerRef.current) > 2) {
        startY.current = null;
        active.current = false;
        return;
      }
      startY.current = e.touches[0].clientY;
      lastY.current = e.touches[0].clientY;
      active.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active.current || startY.current === null || refreshing) return;
      // Si pendant le geste on a déjà scrollé, on annule
      if (getTopOffset(scrollContainerRef.current) > 2 && pullRef.current === 0) {
        active.current = false;
        startY.current = null;
        setPull(0);
        return;
      }
      const currentY = e.touches[0].clientY;
      lastY.current = currentY;
      const delta = currentY - startY.current;
      if (delta <= 0) {
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      const eased = Math.min(MAX_PULL, delta * 0.55);
      pullRef.current = eased;
      setPull(eased);
      // Empêche le bounce iOS / scroll natif quand on tire vers le bas
      if (e.cancelable) {
        try { e.preventDefault(); } catch {}
      }
    };

    const onTouchEnd = async () => {
      if (!active.current) return;
      active.current = false;
      const shouldRefresh = pullRef.current >= TRIGGER_DISTANCE;
      startY.current = null;

      if (!shouldRefresh) {
        pullRef.current = 0;
        setPull(0);
        scrollContainerRef.current = null;
        return;
      }

      setRefreshing(true);
      pullRef.current = TRIGGER_DISTANCE;
      setPull(TRIGGER_DISTANCE);

      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.update().catch(() => {})));
        }
      } catch {
        // ignore
      }

      setTimeout(() => {
        // Bypass cache au reload
        window.location.reload();
      }, 350);

      scrollContainerRef.current = null;
    };

    // passive:false sur touchmove pour pouvoir preventDefault
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove as any);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [refreshing]);

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
