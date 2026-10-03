import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Counts unread athlete wellness submissions for this staff user and category. */
export function useUnreadWellnessNotificationsCount(categoryId?: string) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["unread-wellness-notifications-count", categoryId, user?.id],
    queryFn: async () => {
      if (!categoryId || !user?.id) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("category_id", categoryId)
        .eq("notification_type", "wellness_submitted")
        .eq("is_read", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!categoryId && !!user?.id,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  });
  return data || 0;
}