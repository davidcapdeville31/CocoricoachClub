import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePendingTestResultsCount(categoryId?: string) {
  const { data } = useQuery({
    queryKey: ["pending-test-results-count", categoryId],
    queryFn: async () => {
      if (!categoryId) return 0;
      const { count, error } = await supabase
        .from("pending_test_results")
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
