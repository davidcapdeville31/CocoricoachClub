import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAthleteAttributes } from "./useAthleteAttributes";

export interface SuggestedBenchmarkLevel {
  label: string;
  threshold: number | null;
  color: string;
}

export interface SuggestedBenchmark {
  id: string;
  name: string;
  test_category: string;
  test_type: string;
  unit: string | null;
  lower_is_better: boolean;
  use_body_weight_ratio: boolean;
  body_weight_multiplier: number | null;
  filter_type: string;
  filter_value: string | null;
  levels: SuggestedBenchmarkLevel[];
  /** Score de pertinence pour CET athlète (plus haut = plus pertinent) */
  matchScore: number;
  /** Raison(s) du match : "position:pilier", "discipline:sprint", "default" */
  matchReasons: string[];
}

/**
 * Phase 4 — Identité Athlète :
 * Pour un joueur donné, retourne les benchmarks de la catégorie classés par pertinence
 * en fonction de ses attributs (positions, disciplines, styles, profils de performance).
 *
 * Logique de scoring :
 *  - +10 si filter_type/value matche un attribut PRIMAIRE de l'athlète
 *  - +5  si filter_type/value matche un attribut SECONDAIRE
 *  - +1  si benchmark "all" (fallback générique)
 *  - Les benchmarks sans match dimensionnel mais sans filtre restent dispo en fallback
 */
export function useSuggestedBenchmarks(playerId?: string | null, categoryId?: string | null) {
  const { data: attributes = [] } = useAthleteAttributes(playerId);

  const { data: benchmarks = [], isLoading } = useQuery({
    queryKey: ["benchmarks_for_suggestions", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("benchmarks")
        .select("*")
        .eq("category_id", categoryId!);
      if (error) throw error;
      return (data || []).map((b: any) => ({
        ...b,
        levels: Array.isArray(b.levels) ? b.levels : [],
      }));
    },
  });

  const suggestions = useMemo<SuggestedBenchmark[]>(() => {
    if (!benchmarks.length) return [];

    // Index attributs : dimension -> { value -> is_primary }
    const attrIndex = new Map<string, Map<string, boolean>>();
    for (const a of attributes) {
      if (!attrIndex.has(a.dimension)) attrIndex.set(a.dimension, new Map());
      const dimMap = attrIndex.get(a.dimension)!;
      // Garde le statut "primary" si présent au moins une fois
      const prev = dimMap.get(a.value) ?? false;
      dimMap.set(a.value, prev || a.is_primary);
    }

    return benchmarks
      .map((bm: any): SuggestedBenchmark => {
        let score = 0;
        const reasons: string[] = [];

        if (bm.filter_type === "all" || !bm.filter_value) {
          score += 1;
          reasons.push("générique");
        } else {
          const dimMap = attrIndex.get(bm.filter_type);
          if (dimMap?.has(bm.filter_value)) {
            const isPrimary = dimMap.get(bm.filter_value);
            score += isPrimary ? 10 : 5;
            reasons.push(
              `${bm.filter_type}:${bm.filter_value}${isPrimary ? " ⭐" : ""}`,
            );
          }
        }

        return {
          id: bm.id,
          name: bm.name,
          test_category: bm.test_category,
          test_type: bm.test_type,
          unit: bm.unit,
          lower_is_better: bm.lower_is_better,
          use_body_weight_ratio: bm.use_body_weight_ratio,
          body_weight_multiplier: bm.body_weight_multiplier,
          filter_type: bm.filter_type,
          filter_value: bm.filter_value,
          levels: bm.levels,
          matchScore: score,
          matchReasons: reasons,
        };
      })
      .filter((s) => s.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [benchmarks, attributes]);

  /**
   * Retourne le MEILLEUR barème pour un test donné (test_category + test_type)
   * en se basant sur l'identité de l'athlète.
   */
  const getBestBenchmarkFor = (testCategory: string, testType: string): SuggestedBenchmark | null => {
    const candidates = suggestions.filter(
      (s) => s.test_category === testCategory && s.test_type === testType,
    );
    return candidates[0] ?? null;
  };

  return { suggestions, getBestBenchmarkFor, isLoading };
}
