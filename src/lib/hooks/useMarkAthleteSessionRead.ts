import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Marks athlete_session notifications as read for the current user
 * when the coach hovers / previews the related session in the calendar.
 * The badge on the Planification tab will decrement accordingly.
 */
export function useMarkAthleteSessionRead() {
  const queryClient = useQueryClient();
  const processed = useRef<Set<string>>(new Set());

  return useCallback(
    async (sessionId?: string | null) => {
      if (!sessionId || processed.current.has(sessionId)) return;
      processed.current.add(sessionId);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", user.id)
          .eq("notification_type", "athlete_session")
          .eq("is_read", false)
          .filter("metadata->>session_id", "eq", sessionId)
          .select("id");

        if (error) {
          processed.current.delete(sessionId);
          return;
        }

        if (data && data.length > 0) {
          queryClient.invalidateQueries({
            predicate: (q) => {
              const k = q.queryKey?.[0];
              return (
                k === "unread-athlete-sessions-count" ||
                k === "notifications" ||
                k === "unread-notifications-count"
              );
            },
          });
        }
      } catch {
        processed.current.delete(sessionId);
      }
    },
    [queryClient]
  );
}
