import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_COMPETITION_RPE = 8;

export function useCompetitionPlannedRpe(categoryId?: string) {
  const { data } = useQuery({
    queryKey: ["competition-planned-rpe", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("competition_planned_rpe")
        .eq("id", categoryId!)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.competition_planned_rpe ?? DEFAULT_COMPETITION_RPE;
    },
  });
  return (data as number | undefined) ?? DEFAULT_COMPETITION_RPE;
}

export function useUpdateCompetitionPlannedRpe(categoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase
        .from("categories")
        .update({ competition_planned_rpe: value } as any)
        .eq("id", categoryId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competition-planned-rpe", categoryId] }),
  });
}
