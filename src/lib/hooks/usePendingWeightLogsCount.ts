import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePendingWeightLogsCount(categoryId?: string) {
  const { data } = useQuery({
    queryKey: ["pending-weight-logs-count", categoryId],
    queryFn: async () => {
      if (!categoryId) return 0;
      const { count, error } = await supabase
        .from("athlete_exercise_logs")
        .select("id", { count: "exact", head: true })
        .eq("category_id", categoryId)
        .eq("validation_status", "pending");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!categoryId,
    refetchInterval: 30000,
  });
  return data || 0;
}
