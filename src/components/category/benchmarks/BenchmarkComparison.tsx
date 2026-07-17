import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, TrendingUp, Weight } from "lucide-react";
import { computeBenchmarkLevel } from "@/lib/benchmarks/computeLevel";
import { matchesBenchmark } from "@/lib/benchmarks/matchTestType";

interface BenchmarkComparisonProps {
  categoryId: string;
  sportType?: string;
}

interface BenchmarkLevel {
  label: string;
  threshold: number | null;
  color: string;
}

interface Benchmark {
  id: string;
  name: string;
  test_category: string;
  test_type: string;
  unit: string | null;
  lower_is_better: boolean;
  levels: BenchmarkLevel[];
  use_body_weight_ratio: boolean;
  body_weight_multiplier: number | null;
  filter_type: string;
  filter_value: string | null;
}

function getPlayerLevel(
  value: number,
  benchmark: Benchmark,
  playerWeight?: number | null
): { label: string; color: string } {
  const { label, color } = computeBenchmarkLevel(value, benchmark, playerWeight);
  return { label, color };
}

export function BenchmarkComparison({ categoryId, sportType }: BenchmarkComparisonProps) {
  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("benchmarks")
        .select("*")
        .eq("category_id", categoryId)
        .order("created_at");
      if (error) throw error;
      return (data || []).map((b: any) => ({
        ...b,
        levels: Array.isArray(b.levels) ? b.levels : [],
      })) as Benchmark[];
    },
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name, position")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch latest body composition for body-weight calculations
  const { data: bodyComps = [] } = useQuery({
    queryKey: ["body-comp-benchmark", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_composition")
        .select("player_id, weight_kg, measurement_date")
        .eq("category_id", categoryId)
        .order("measurement_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: benchmarks.some(b => b.use_body_weight_ratio),
  });

  // Identité athlète : récupère TOUS les attributs (positions multiples, etc.)
  // pour les joueurs de la catégorie afin d'enrichir les filtres benchmarks.
  const playerIds = useMemo(() => (players || []).map((p: any) => p.id), [players]);
  const { data: attributes = [] } = useQuery({
    queryKey: ["athlete_attributes_by_category", categoryId, playerIds.length],
    enabled: playerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athlete_attributes")
        .select("player_id, dimension, value, is_primary, weight")
        .in("player_id", playerIds);
      if (error) throw error;
      return data || [];
    },
  });

  // Index : player_id -> dimension -> Set des valeurs
  const playerDimensionValues = useMemo(() => {
    const map = new Map<string, Map<string, Set<string>>>();
    for (const a of attributes as any[]) {
      if (!map.has(a.player_id)) map.set(a.player_id, new Map());
      const dimMap = map.get(a.player_id)!;
      if (!dimMap.has(a.dimension)) dimMap.set(a.dimension, new Set());
      dimMap.get(a.dimension)!.add(a.value);
    }
    return map;
  }, [attributes]);
  const playerWeights = useMemo(() => {
    const map = new Map<string, number>();
    for (const bc of bodyComps) {
      if (bc.weight_kg && !map.has(bc.player_id)) {
        map.set(bc.player_id, bc.weight_kg);
      }
    }
    return map;
  }, [bodyComps]);

  // Fetch test results
  const { data: genericTests = [] } = useQuery({
    queryKey: ["generic_tests_benchmark", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generic_tests")
        .select("player_id, test_category, test_type, result_value, test_date")
        .eq("category_id", categoryId)
        .order("test_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: benchmarks.length > 0,
  });

  const { data: speedTests = [] } = useQuery({
    queryKey: ["speed_tests_benchmark", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speed_tests")
        .select("player_id, test_type, vma_kmh, speed_kmh, time_40m_seconds, test_date")
        .eq("category_id", categoryId)
        .order("test_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: benchmarks.length > 0,
  });

  const { data: strengthTests = [] } = useQuery({
    queryKey: ["strength_tests_benchmark", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strength_tests")
        .select("player_id, test_name, weight_kg, test_date")
        .eq("category_id", categoryId)
        .order("test_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: benchmarks.length > 0,
  });

  // Custom tests de la catégorie pour matching benchmark <-> résultat
  const { data: customTests = [] } = useQuery({
    queryKey: ["custom_tests_for_benchmark_match", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_tests")
        .select("id, name, test_category")
        .eq("category_id", categoryId);
      if (error) throw error;
      return data || [];
    },
  });

  // Build player results map
  const playerResults = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    const getPlayerMap = (pid: string) => {
      if (!map.has(pid)) map.set(pid, new Map());
      return map.get(pid)!;
    };

    benchmarks.forEach(bm => {
      genericTests.forEach(t => {
        // Category can differ if the custom test was created under a different
        // theme category ; on tolère si le test_type matche (custom UUID or preset).
        const sameCat = t.test_category === bm.test_category;
        if (!sameCat && !matchesBenchmark(t.test_type, bm.test_type, customTests as any)) return;
        if (!matchesBenchmark(t.test_type, bm.test_type, customTests as any)) return;
        const pm = getPlayerMap(t.player_id);
        if (!pm.has(bm.id)) pm.set(bm.id, t.result_value);
      });

      if (bm.test_category === "speed" || bm.test_category === "sprint") {
        speedTests.forEach(t => {
          if (matchesBenchmark(t.test_type, bm.test_type, customTests as any)) {
            const pm = getPlayerMap(t.player_id);
            if (!pm.has(bm.id)) {
              const val = t.vma_kmh || t.speed_kmh || t.time_40m_seconds;
              if (val != null) pm.set(bm.id, val);
            }
          }
        });
      }

      if (bm.test_category === "strength" || bm.test_category === "force" || bm.test_category === "musculation") {
        strengthTests.forEach(t => {
          if (matchesBenchmark(t.test_name, bm.test_type, customTests as any)) {
            const pm = getPlayerMap(t.player_id);
            if (!pm.has(bm.id)) pm.set(bm.id, t.weight_kg);
          }
        });
      }
    });

    return map;
  }, [benchmarks, genericTests, speedTests, strengthTests, customTests]);


  // Filter players based on benchmark filter
  // Désormais : on regarde l'identité athlète (positions multiples)
  // en plus du champ legacy `position` pour matcher tout poste joué.
  const getFilteredPlayers = (bm: Benchmark) => {
    if (bm.filter_type === "all" || !bm.filter_value) return players;
    return players.filter((p: any) => {
      // 1) Champ legacy
      if (p.position === bm.filter_value) return true;
      // 2) Identité athlète : positions secondaires
      const dims = playerDimensionValues.get(p.id);
      if (!dims) return false;
      // Le filter_type peut être 'position' ; sinon on tente la dimension homonyme
      const dim = bm.filter_type === "position" ? "position" : bm.filter_type;
      const values = dims.get(dim);
      return !!values && values.has(bm.filter_value);
    });
  };

  if (benchmarks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            Aucun benchmark défini. Configurez des benchmarks ci-dessus pour comparer les performances.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Comparaison des performances
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Dernier résultat de chaque joueur comparé aux benchmarks définis
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10 min-w-[150px]">Joueur</TableHead>
                {benchmarks.map(bm => (
                  <TableHead key={bm.id} className="text-center min-w-[120px]">
                    <div>
                      <p className="font-medium">{bm.name}</p>
                      <p className="text-xs text-muted-foreground font-normal">
                        {bm.unit}
                        {bm.use_body_weight_ratio && (
                          <span className="ml-1">
                            <Weight className="h-3 w-3 inline" /> {bm.body_weight_multiplier}x PDC
                          </span>
                        )}
                      </p>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map(player => (
                <TableRow key={player.id}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium">
                    {player.first_name ? `${player.first_name} ${player.name}` : player.name}
                  </TableCell>
                  {benchmarks.map(bm => {
                    const val = playerResults.get(player.id)?.get(bm.id);
                    const weight = playerWeights.get(player.id);

                    if (val == null) {
                      return (
                        <TableCell key={bm.id} className="text-center">
                          <span className="text-muted-foreground text-xs">-</span>
                        </TableCell>
                      );
                    }

                    const { label, color } = getPlayerLevel(val, bm, weight);

                    // Show ratio if body-weight based
                    let displayValue = val.toString();
                    if (bm.use_body_weight_ratio && weight) {
                      const ratio = (val / weight).toFixed(2);
                      displayValue = `${val} (${ratio}x)`;
                    }

                    return (
                      <TableCell key={bm.id} className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-mono font-semibold text-sm">{displayValue}</span>
                          <Badge className="text-[10px] px-1.5 py-0 text-white" style={{ backgroundColor: color }}>
                            {label}
                          </Badge>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
