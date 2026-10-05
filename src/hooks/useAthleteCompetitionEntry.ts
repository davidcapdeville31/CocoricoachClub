import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Whether athletes assigned to a competition may enter their own competition data (results, RPE). */
export function useAthleteCompetitionEntry(categoryId?: string) {
  const { data } = useQuery({
    queryKey: ["athlete-competition-entry", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("athlete_competition_entry_enabled")
        .eq("id", categoryId!)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.athlete_competition_entry_enabled ?? true;
    },
  });
  return (data as boolean | undefined) ?? true;
}

export function useUpdateAthleteCompetitionEntry(categoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: boolean) => {
      const { error } = await supabase
        .from("categories")
        .update({ athlete_competition_entry_enabled: value } as any)
        .eq("id", categoryId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["athlete-competition-entry", categoryId] }),
  });
}
