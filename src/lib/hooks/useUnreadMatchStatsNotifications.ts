import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadMatchStatsNotifications(categoryId?: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["unread-match-stats", categoryId, user?.id],
    enabled: !!categoryId && !!user,
    queryFn: async () => {
      if (!categoryId || !user) return [];
      const { data, error } = await supabase.from("notifications").select("id, metadata")
        .eq("category_id", categoryId).eq("user_id", user.id)
        .eq("notification_type", "match_stats_submission").eq("is_read", false);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15_000,
  });
  useEffect(() => {
    if (!user || !categoryId) return;
    const channel = supabase.channel(`match-stats-unread-${categoryId}-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        client.invalidateQueries({ queryKey: ["unread-match-stats", categoryId, user.id] });
        client.invalidateQueries({ queryKey: ["staff-athlete-match-feedback"] });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, categoryId, client]);
  const rows = query.data || [];
  return { rows, count: rows.length, countForMatch: (id: string) => rows.filter(r => {
    const meta = r.metadata;
    return meta && typeof meta === "object" && !Array.isArray(meta) && meta.match_id === id;
  }).length };
}