import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Check if the browser supports push notifications
const isPushSupported = () => {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
};

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  // Check if push notifications are supported
  useEffect(() => {
    const supported = isPushSupported();
    setIsSupported(supported);
    if (supported && "Notification" in window) {
      setPermission(window.Notification.permission);
    }
  }, []);

  // Check if user is already subscribed
  useEffect(() => {
    const checkSubscription = async () => {
      if (!user?.id || !isPushSupported()) return;

      try {
        const { data } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        setIsSubscribed((data?.length || 0) > 0);
      } catch (error) {
        console.error("Error checking subscription:", error);
      }
    };

    checkSubscription();
  }, [user?.id]);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      toast.error("Les notifications ne sont pas supportées par ce navigateur");
      return false;
    }

    try {
      const result = await window.Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        toast.success("Notifications activées !");
        return true;
      } else if (result === "denied") {
        toast.error("Notifications refusées. Vous pouvez les activer dans les paramètres du navigateur.");
        return false;
      }

      return false;
    } catch (error) {
      console.error("Error requesting permission:", error);
      toast.error("Erreur lors de la demande de permission");
      return false;
    }
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!user?.id) {
      toast.error("Vous devez être connecté");
      return false;
    }

    if (!isPushSupported()) {
      toast.error("Les notifications push ne sont pas supportées");
      return false;
    }

    setIsLoading(true);

    try {
      // First request permission if not already granted
      if ("Notification" in window && window.Notification.permission !== "granted") {
        const granted = await requestPermission();
        if (!granted) {
          setIsLoading(false);
          return false;
        }
      }

      // Register service worker if not already registered
      await navigator.serviceWorker.ready;

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert({
          user_id: user.id,
          endpoint: `placeholder-${user.id}-${Date.now()}`,
          p256dh: "placeholder",
          auth: "placeholder",
        }, {
          onConflict: "user_id,endpoint"
        });

      if (error) throw error;

      setIsSubscribed(true);
      toast.success("Notifications push activées !");
      return true;
    } catch (error) {
      console.error("Error subscribing:", error);
      toast.error("Erreur lors de l'activation des notifications");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, requestPermission]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!user?.id) return false;

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      setIsSubscribed(false);
      toast.success("Notifications push désactivées");
      return true;
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("Erreur lors de la désactivation");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Show a local notification (for testing or when online)
  const showLocalNotification = useCallback(async (title: string, body: string, options?: NotificationOptions) => {
    if (!("Notification" in window)) return;

    if (window.Notification.permission !== "granted") {
      const granted = await requestPermission();
      if (!granted) return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        ...options,
      });
    } catch (error) {
      // Fallback to regular notification (guarded)
      try {
        new window.Notification(title, { body, icon: "/pwa-192x192.png", ...options });
      } catch {
        // silently ignore if still unsupported
      }
    }
  }, [requestPermission]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    requestPermission,
    showLocalNotification,
  };
}
