import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Counts unread notifications related to athlete self-planned sessions
 * (notification_type = "athlete_session") for the CURRENT user in a given category.
 * Used to display a red dot/badge on Planification & Calendrier Global menus.
 */
export function useUnreadAthleteSessionsCount(categoryId?: string) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["unread-athlete-sessions-count", categoryId, user?.id],
    queryFn: async () => {
      if (!categoryId || !user?.id) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("category_id", categoryId)
        .eq("notification_type", "athlete_session")
        .eq("is_read", false);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!categoryId && !!user?.id,
    refetchInterval: 30000,
  });
  return data || 0;
}
