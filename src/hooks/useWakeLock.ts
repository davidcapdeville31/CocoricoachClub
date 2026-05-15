import { useEffect, useRef, useState, useCallback } from "react";

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

/**
 * Maintient l'écran allumé pendant l'utilisation (mode Live match).
 * - Acquiert un wake lock à l'activation
 * - Le libère au démontage / désactivation
 * - Le ré-acquiert automatiquement quand l'app revient au premier plan
 */
export function useWakeLock(active: boolean = true) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);
  const isSupported =
    typeof navigator !== "undefined" && "wakeLock" in navigator;

  const acquire = useCallback(async () => {
    if (!isSupported) return;
    try {
      const sentinel = await (navigator as any).wakeLock.request("screen");
      sentinelRef.current = sentinel;
      setIsWakeLockActive(true);
      sentinel.addEventListener("release", () => {
        setIsWakeLockActive(false);
      });
    } catch {
      // Silencieux : permission refusée, batterie faible, etc.
      setIsWakeLockActive(false);
    }
  }, [isSupported]);

  const release = useCallback(async () => {
    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        await sentinelRef.current.release();
      }
    } catch {
      /* noop */
    }
    sentinelRef.current = null;
    setIsWakeLockActive(false);
  }, []);

  useEffect(() => {
    if (!active || !isSupported) {
      release();
      return;
    }
    acquire();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && active) {
        // Le navigateur libère automatiquement le wake lock en arrière-plan
        acquire();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };
  }, [active, isSupported, acquire, release]);

  return { isWakeLockActive, isSupported };
}
