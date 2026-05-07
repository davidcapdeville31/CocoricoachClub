import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Counts unread notifications related to athlete self-planned sessions
 * (notification_type = "athlete_session") for a given category.
 * Used to display a red dot/badge on Planification & Calendrier Global menus.
 */
export function useUnreadAthleteSessionsCount(categoryId?: string) {
  const { data } = useQuery({
    queryKey: ["unread-athlete-sessions-count", categoryId],
    queryFn: async () => {
      if (!categoryId) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("category_id", categoryId)
        .eq("notification_type", "athlete_session")
        .eq("is_read", false);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!categoryId,
    refetchInterval: 30000,
  });
  return data || 0;
}
