import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWellnessQuestions } from "@/lib/wellness/questionConfig";
import { collectWeightHistory, isWeightQuestionKeyLabel, type WeightEntry } from "@/lib/weight/weightHistory";

interface Options {
  categoryId?: string;
  /** Restrict to one athlete (athlete space). */
  playerId?: string;
}

/**
 * Aggregate every body-weight source (body composition, measurements,
 * anthropometry tests, wellness custom "poids" question) for a category
 * or a single athlete. Generic: works for every sport/discipline.
 */
export function useWeightHistory({ categoryId, playerId }: Options) {
  const { data: questions = [] } = useWellnessQuestions(categoryId);
  const configuredWeightQuestionKeys = questions
    .filter((q) => q.is_custom && isWeightQuestionKeyLabel(q.label))
    .map((q) => q.key);

  const query = useQuery({
    queryKey: ["weight-history", categoryId, playerId, configuredWeightQuestionKeys.join(",")],
    enabled: !!categoryId || !!playerId,
    queryFn: async (): Promise<WeightEntry[]> => {
      let resolvedCategoryId = categoryId;
      if (!resolvedCategoryId && playerId) {
        const { data: player } = await supabase
          .from("players")
          .select("category_id")
          .eq("id", playerId)
          .maybeSingle();
        resolvedCategoryId = player?.category_id || undefined;
      }

      let weightQuestionKeys = configuredWeightQuestionKeys;
      if (weightQuestionKeys.length === 0 && resolvedCategoryId) {
        const { data: config } = await supabase
          .from("wellness_question_configs")
          .select("questions")
          .eq("category_id", resolvedCategoryId)
          .maybeSingle();
        const configuredQuestions = Array.isArray(config?.questions) ? config.questions : [];
        weightQuestionKeys = configuredQuestions
          .filter((q: any) => q?.is_custom && isWeightQuestionKeyLabel(q?.label))
          .map((q: any) => q.key)
          .filter(Boolean);
      }

      const filter = <T extends { eq: (c: string, v: string) => T }>(q: T) => {
        let out = q;
        if (playerId) out = out.eq("player_id", playerId);
        else if (resolvedCategoryId) out = out.eq("category_id", resolvedCategoryId);
        return out;
      };

      const [bc, pm, gt, ct, wt] = await Promise.all([
        filter(supabase.from("body_composition").select("player_id, weight_kg, measurement_date, created_at") as any),
        filter(supabase.from("player_measurements").select("player_id, weight_kg, measurement_date, created_at") as any),
        filter(
          supabase
            .from("generic_tests")
            .select("player_id, test_type, test_category, result_value, result_unit, test_date, created_at") as any,
        ),
        supabase.from("custom_tests").select("id, name, unit, test_category"),
        weightQuestionKeys.length > 0
          ? filter(
              supabase
                .from("wellness_tracking")
                .select("player_id, tracking_date, custom_answers, created_at") as any,
            )
          : Promise.resolve({ data: [] } as any),
      ]);

      return collectWeightHistory({
        bodyComps: (bc as any).data || [],
        playerMeasurements: (pm as any).data || [],
        genericTests: (gt as any).data || [],
        customTests: ((ct as any).data || []) as any,
        wellness: (wt as any).data || [],
        weightQuestionKeys,
      });
    },
  });

  return { entries: query.data || [], isLoading: query.isLoading, weightQuestionKeys: configuredWeightQuestionKeys };
}
