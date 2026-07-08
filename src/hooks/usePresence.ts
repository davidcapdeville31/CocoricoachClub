import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Suivi de présence en ligne pour une catégorie via Supabase Realtime Presence.
 * Retourne l'ensemble des `user_id` actuellement en ligne.
 */
export function usePresence(categoryId: string | null | undefined) {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!categoryId || !user?.id) return;

    const channelName = `presence:cat:${categoryId}:${user.id}:${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: user.id } },
    });

    const applyState = () => {
      const state = channel.presenceState() as Record<string, Array<{ user_id?: string }>>;
      const ids = new Set<string>();
      Object.keys(state).forEach((key) => {
        ids.add(key);
        state[key]?.forEach((entry) => {
          if (entry?.user_id) ids.add(entry.user_id);
        });
      });
      setOnlineIds(ids);
    };

    channel
      .on("presence", { event: "sync" }, applyState)
      .on("presence", { event: "join" }, applyState)
      .on("presence", { event: "leave" }, applyState)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [categoryId, user?.id]);

  return onlineIds;
}
