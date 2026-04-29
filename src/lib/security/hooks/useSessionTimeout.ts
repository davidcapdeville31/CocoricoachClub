import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { logSecurityEvent } from "../securityLogger";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "click"];
const STORAGE_KEY = "ccc_last_activity";
const WARNING_BEFORE_MS = 60_000; // Warn 1 min before logout

/**
 * Auto-logout after inactivity. Default 30 minutes.
 * Tracks activity across tabs via localStorage.
 */
export function useSessionTimeout(timeoutMinutes: number = 30) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedRef = useRef(false);

  const performLogout = useCallback(async () => {
    await logSecurityEvent({
      eventType: "session_timeout",
      severity: "info",
      metadata: { reason: "inactivity", timeoutMinutes },
    });
    await supabase.auth.signOut();
    toast.info("Session expirée pour inactivité. Reconnectez-vous.");
    navigate("/auth");
  }, [navigate, timeoutMinutes]);

  const resetTimer = useCallback(() => {
    if (!user) return;
    const now = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      /* ignore */
    }
    warnedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    const timeoutMs = timeoutMinutes * 60 * 1000;

    warningRef.current = setTimeout(() => {
      if (!warnedRef.current) {
        warnedRef.current = true;
        toast.warning("Vous serez déconnecté dans 1 minute pour inactivité.");
      }
    }, timeoutMs - WARNING_BEFORE_MS);

    timerRef.current = setTimeout(performLogout, timeoutMs);
  }, [user, timeoutMinutes, performLogout]);

  useEffect(() => {
    if (!user) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      return;
    }

    // On (re)login, always reset the activity timestamp.
    // The previous stored value may be stale from a prior session that already
    // expired — using it would immediately log the user back out.
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }

    resetTimer();

    const handler = () => resetTimer();
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, handler, { passive: true }));

    // Sync activity across tabs
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) resetTimer();
    };
    window.addEventListener("storage", storageHandler);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, handler));
      window.removeEventListener("storage", storageHandler);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [user, timeoutMinutes, resetTimer, performLogout]);
}
