import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BenchmarkManager } from "./BenchmarkManager";
import { BenchmarkComparison } from "./BenchmarkComparison";
import { IdentityComparisonPanel } from "@/components/analytics/IdentityComparisonPanel";

interface BenchmarkTabProps {
  categoryId: string;
  sportType?: string;
}

export function BenchmarkTab({ categoryId, sportType }: BenchmarkTabProps) {
  // Récupère le dernier VMA par joueur pour alimenter la comparaison par identité
  const { data: speedTests = [] } = useQuery({
    queryKey: ["benchmark_tab_vma", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speed_tests")
        .select("player_id, vma_kmh, test_date")
        .eq("category_id", categoryId)
        .not("vma_kmh", "is", null)
        .order("test_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const vmaByPlayer = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of speedTests as any[]) {
      if (t.vma_kmh != null && !m.has(t.player_id)) {
        m.set(t.player_id, Number(t.vma_kmh));
      }
    }
    return m;
  }, [speedTests]);

  return (
    <div className="space-y-6">
      <BenchmarkManager categoryId={categoryId} sportType={sportType} />
      <BenchmarkComparison categoryId={categoryId} sportType={sportType} />
      {vmaByPlayer.size > 0 && (
        <IdentityComparisonPanel
          categoryId={categoryId}
          values={vmaByPlayer}
          metricLabel="VMA (km/h) — dernier test par athlète"
          allowedDimensions={[
            "position",
            "discipline",
            "performance_profile",
            "technical_style",
            "genre",
            "age_category",
          ]}
        />
      )}
    </div>
  );
}
