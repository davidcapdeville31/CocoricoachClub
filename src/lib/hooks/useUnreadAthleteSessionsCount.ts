import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Counts unread notifications related to athlete self-planned sessions
 * (notification_type = "athlete_session") for the CURRENT user in a given category.
 * Also auto-marks as read any "orphan" notifications whose underlying session
 * no longer exists (e.g. session cancelled/deleted by the athlete) — otherwise
 * the coach would have no way to clear the badge from the calendar.
 */
export function useUnreadAthleteSessionsCount(categoryId?: string) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["unread-athlete-sessions-count", categoryId, user?.id],
    queryFn: async () => {
      if (!categoryId || !user?.id) return 0;

      // 1. Fetch all unread athlete_session notifications for this user/category
      const { data: notifs, error } = await supabase
        .from("notifications")
        .select("id, metadata")
        .eq("user_id", user.id)
        .eq("category_id", categoryId)
        .eq("notification_type", "athlete_session")
        .eq("is_read", false);

      if (error || !notifs) return 0;
      if (notifs.length === 0) return 0;

      // 2. Identify referenced session IDs and check which still exist
      const sessionIds = Array.from(
        new Set(
          notifs
            .map((n) => (n.metadata as any)?.session_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        )
      );

      let existingIds = new Set<string>();
      if (sessionIds.length > 0) {
        const { data: sessions } = await supabase
          .from("training_sessions")
          .select("id")
          .in("id", sessionIds);
        existingIds = new Set((sessions || []).map((s) => s.id));
      }

      // 3. Auto-mark as read notifications whose session no longer exists
      const orphanIds = notifs
        .filter((n) => {
          const sid = (n.metadata as any)?.session_id;
          return !sid || !existingIds.has(sid);
        })
        .map((n) => n.id);

      if (orphanIds.length > 0) {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .in("id", orphanIds);
      }

      return notifs.length - orphanIds.length;
    },
    enabled: !!categoryId && !!user?.id,
    refetchInterval: 30000,
  });
  return data || 0;
}
