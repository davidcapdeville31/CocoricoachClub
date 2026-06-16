import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PresenceUser {
  user_id: string;
  name: string;
  email?: string | null;
  joined_at: string;
}

/**
 * Realtime presence for the CompetitionRoundsDialog.
 * Broadcasts the current user's identity on a per-match channel and
 * returns the list of OTHER users currently viewing/editing the same match.
 */
export function useCompetitionRoundsPresence(matchId: string | undefined, open: boolean) {
  const [others, setOthers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!open || !matchId) {
      setOthers([]);
      return;
    }

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let currentUserId: string | null = null;

    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user || cancelled) return;
      currentUserId = user.id;

      // Fetch a display name from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      const displayName =
        profile?.full_name ||
        profile?.email ||
        user.email ||
        "Utilisateur";

      const ch = supabase.channel(`competition-rounds:${matchId}`, {
        config: { presence: { key: user.id } },
      });

      const refreshOthers = () => {
        const state = ch.presenceState() as Record<string, PresenceUser[]>;
        const list: PresenceUser[] = [];
        for (const [key, metas] of Object.entries(state)) {
          if (key === currentUserId) continue;
          const meta = metas[0];
          if (meta) list.push(meta);
        }
        setOthers(list);
      };

      ch.on("presence", { event: "sync" }, refreshOthers)
        .on("presence", { event: "join" }, refreshOthers)
        .on("presence", { event: "leave" }, refreshOthers);

      await ch.subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !cancelled) {
          await ch.track({
            user_id: user.id,
            name: displayName,
            email: profile?.email ?? user.email ?? null,
            joined_at: new Date().toISOString(),
          });
        }
      });

      channel = ch;
    })();

    return () => {
      cancelled = true;
      if (channel) {
        channel.untrack().catch(() => {});
        supabase.removeChannel(channel);
      }
      setOthers([]);
    };
  }, [matchId, open]);

  return others;
}
