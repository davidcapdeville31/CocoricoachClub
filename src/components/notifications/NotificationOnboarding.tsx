import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { initOneSignal, oneSignalLogin, buildUserTags, requestOneSignalPermission, getOneSignalPermission, checkOneSignalSubscriptionStatus } from "@/lib/onesignal";

const STORAGE_KEY = "notification_onboarding_done";
/** Sticky flag: once the user clicks "Accepter", never re-show the onboarding automatically. */
const PERMISSION_GRANTED_KEY = "notification_permission_granted";
const LAST_SHOWN_KEY = "notification_reminder_last_shown";

/**
 * Check if we've already confirmed permission was granted (survives browser quirks).
 * Some browsers (iOS Safari PWA) don't reliably persist window.Notification.permission.
 */
function wasPermissionGranted(userId: string): boolean {
  try {
    return localStorage.getItem(`${PERMISSION_GRANTED_KEY}_${userId}`) === "true";
  } catch {
    return false;
  }
}

function markPermissionGranted(userId: string) {
  try {
    localStorage.setItem(`${PERMISSION_GRANTED_KEY}_${userId}`, "true");
  } catch {}
}

function markReminderShown(userId: string) {
  try {
    localStorage.setItem(`${LAST_SHOWN_KEY}_${userId}`, Date.now().toString());
  } catch {}
}

/**
 * Resets the onboarding flag if push permission is genuinely still "default"
 * AND we never recorded a successful grant.
 */
export function resetOnboardingIfNeeded(userId: string) {
  try {
    if (getOneSignalPermission() === "granted") return;
    localStorage.removeItem(`${PERMISSION_GRANTED_KEY}_${userId}`);
  } catch {
    // Silently ignore
  }
}

export function NotificationOnboarding() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [isHandling, setIsHandling] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let timeoutId: number | undefined;

    (async () => {
      const perm = getOneSignalPermission();
      const hasServerSubscription = await checkOneSignalSubscriptionStatus(user.id).catch(() => false);

      if (cancelled) return;

      if (perm === "granted" || hasServerSubscription) {
        markPermissionGranted(user.id);
        try {
          await initOneSignal();
          const tags = await buildUserTags(user.id);
          await oneSignalLogin(user.id, user.email || "", tags);
          console.log("[NotificationOnboarding] Auto-synced existing user to OneSignal");
        } catch (err) {
          console.error("[NotificationOnboarding] Auto-sync error:", err);
        }
        localStorage.setItem(`${STORAGE_KEY}_${user.id}`, "done");
        return;
      }

      if (wasPermissionGranted(user.id)) {
        localStorage.removeItem(`${PERMISSION_GRANTED_KEY}_${user.id}`);
      }

      if (perm === "denied") return;

      const done = localStorage.getItem(`${STORAGE_KEY}_${user.id}`);
      if (done) return;

      timeoutId = window.setTimeout(() => setShow(true), 800);
    })();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [user]);

  const markDone = () => {
    if (user) {
      localStorage.setItem(`${STORAGE_KEY}_${user.id}`, "done");
    }
    setShow(false);
  };

  const handleActivate = async () => {
    if (!user || isHandling) return;
    setIsHandling(true);

    localStorage.setItem(`${STORAGE_KEY}_${user.id}`, "done");

    // Safety net: never let the button stay stuck on "Activation en cours..."
    // (iOS PWA / reconnections can hang OneSignal calls indefinitely)
    const safetyTimeout = setTimeout(() => {
      console.warn("[NotificationOnboarding] Activation timeout — closing modal");
      setIsHandling(false);
      markDone();
    }, 4000);

    const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T | null> =>
      Promise.race<T | null>([
        p,
        new Promise<null>((resolve) =>
          setTimeout(() => {
            console.warn(`[NotificationOnboarding] ${label} timed out`);
            resolve(null);
          }, ms)
        ),
      ]);

    try {
      await withTimeout(initOneSignal(), 2000, "initOneSignal");
      const granted = await withTimeout(requestOneSignalPermission(), 3000, "requestPermission");
      if (granted) {
        markPermissionGranted(user.id);
        // Fire-and-forget background sync — don't block the UI
        (async () => {
          try {
            const tags = await buildUserTags(user.id);
            await oneSignalLogin(user.id, user.email || "", tags);
            console.log("[NotificationOnboarding] Push permission granted & synced");
          } catch (err) {
            console.error("[NotificationOnboarding] Background sync error:", err);
          }
        })();
      }
    } catch (err) {
      console.error("[NotificationOnboarding] Error:", err);
    } finally {
      clearTimeout(safetyTimeout);
      setIsHandling(false);
      markDone();
    }
  };

  const handleDecline = () => {
    setDeclined(true);
    if (user) {
      markReminderShown(user.id);
      localStorage.setItem(`${STORAGE_KEY}_${user.id}`, "done");
    }

    // Persist immediately so closing/backgrounding the app cannot make the fullscreen
    // onboarding come back on the next launch. The ReminderModal handles any later re-ask.
    setTimeout(() => {
      markDone();
    }, 2500);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm mx-auto px-6 text-center space-y-8">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center ring-8 ring-primary/5">
            <Bell className="w-12 h-12 text-primary" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight">
            Active les notifications
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Reçois les convocations, entraînements et rappels importants directement sur ton appareil — même quand l'app est fermée
          </p>
        </div>

        {/* Benefits */}
        <div className="space-y-3 text-left">
          {[
            { emoji: "📣", label: "Notifications push instantanées" },
            { emoji: "📧", label: "Alertes par email" },
            { emoji: "🏋️", label: "Rappels d'entraînements" },
            { emoji: "⚕️", label: "Alertes médicales importantes" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <span className="text-xl">{item.emoji}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Declined message */}
        {declined ? (
          <div className="py-2 text-sm text-muted-foreground">
            ✓ Tu peux activer les notifications plus tard dans ton profil
          </div>
        ) : (
          <div className="space-y-3">
            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={handleActivate}
              disabled={isHandling}
            >
              <Bell className="mr-2 h-5 w-5" />
              {isHandling ? "Activation en cours..." : "Accepter les notifications"}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={handleDecline}
            >
              Pas maintenant
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
