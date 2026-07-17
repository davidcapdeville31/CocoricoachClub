import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, TrendingUp, Weight } from "lucide-react";
import { computeBenchmarkLevel } from "@/lib/benchmarks/computeLevel";
import { matchesBenchmark, normalizeTestKey } from "@/lib/benchmarks/matchTestType";


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
        .from("custom_test_categories")
        .select("custom_tests(id, name, test_category)")
        .eq("category_id", categoryId);
      if (error) throw error;
      return (data || [])
        .map((r: any) => r.custom_tests)
        .filter(Boolean) as { id: string; name: string; test_category: string | null }[];
    },
  });


  // Regroupe les benchmarks par test (nom/test_type normalisé) : une seule colonne
  // par test dans la table, avec toutes les variantes (poste / sexe / base).
  const benchmarkGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; unit: string | null; use_body_weight_ratio: boolean; body_weight_multiplier: number | null; variants: Benchmark[] }>();
    for (const bm of benchmarks) {
      const k = normalizeTestKey(bm.test_type) || bm.id;
      if (!groups.has(k)) {
        groups.set(k, {
          key: k,
          label: bm.name,
          unit: bm.unit,
          use_body_weight_ratio: bm.use_body_weight_ratio,
          body_weight_multiplier: bm.body_weight_multiplier,
          variants: [],
        });
      }
      groups.get(k)!.variants.push(bm);
    }
    return Array.from(groups.values());
  }, [benchmarks]);

  // Résout la meilleure variante d'un groupe pour un joueur donné :
  // 1) match par poste (legacy `position` ou identité athlète)
  // 2) fallback : variante générique (filter_type=all / null)
  const resolveVariant = (
    group: { variants: Benchmark[] },
    player: any,
  ): Benchmark | null => {
    const dims = playerDimensionValues.get(player.id);
    const playerPositions = new Set<string>();
    if (player.position) playerPositions.add(player.position);
    const dimPos = dims?.get("position");
    if (dimPos) dimPos.forEach((v) => playerPositions.add(v));

    let positional: Benchmark | null = null;
    let generic: Benchmark | null = null;
    for (const bm of group.variants) {
      if (bm.filter_type === "position" && bm.filter_value) {
        if (playerPositions.has(bm.filter_value) && !positional) positional = bm;
      } else if (bm.filter_type === "all" || !bm.filter_value) {
        if (!generic) generic = bm;
      } else {
        // autres filtres (sexe, etc.) : traité comme fallback secondaire
        const values = dims?.get(bm.filter_type);
        if (values?.has(bm.filter_value) && !generic) generic = bm;
      }
    }
    return positional || generic || group.variants[0] || null;
  };

  // Build player results : par groupe (test), une valeur (dernier résultat).
  const playerResults = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    const getPlayerMap = (pid: string) => {
      if (!map.has(pid)) map.set(pid, new Map());
      return map.get(pid)!;
    };

    for (const group of benchmarkGroups) {
      const anyBm = group.variants[0];
      if (!anyBm) continue;
      genericTests.forEach((t) => {
        if (!matchesBenchmark(t.test_type, anyBm.test_type, customTests as any)) return;
        const pm = getPlayerMap(t.player_id);
        if (!pm.has(group.key)) pm.set(group.key, t.result_value);
      });
      if (anyBm.test_category === "speed" || anyBm.test_category === "sprint") {
        speedTests.forEach((t) => {
          if (matchesBenchmark(t.test_type, anyBm.test_type, customTests as any)) {
            const pm = getPlayerMap(t.player_id);
            if (!pm.has(group.key)) {
              const val = t.vma_kmh || t.speed_kmh || t.time_40m_seconds;
              if (val != null) pm.set(group.key, val);
            }
          }
        });
      }
      if (anyBm.test_category === "strength" || anyBm.test_category === "force" || anyBm.test_category === "musculation") {
        strengthTests.forEach((t) => {
          if (matchesBenchmark(t.test_name, anyBm.test_type, customTests as any)) {
            const pm = getPlayerMap(t.player_id);
            if (!pm.has(group.key)) pm.set(group.key, t.weight_kg);
          }
        });
      }
    }
    return map;
  }, [benchmarkGroups, genericTests, speedTests, strengthTests, customTests]);

  // Filtre poste global
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const availablePositions = useMemo(() => {
    const s = new Set<string>();
    for (const bm of benchmarks) {
      if (bm.filter_type === "position" && bm.filter_value) s.add(bm.filter_value);
    }
    return Array.from(s).sort();
  }, [benchmarks]);

  const displayedPlayers = useMemo(() => {
    if (positionFilter === "all") return players;
    return players.filter((p: any) => {
      if (p.position === positionFilter) return true;
      const dims = playerDimensionValues.get(p.id);
      return !!dims?.get("position")?.has(positionFilter);
    });
  }, [players, positionFilter, playerDimensionValues]);

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Comparaison des performances
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Dernier résultat de chaque joueur comparé aux benchmarks définis
            </p>
          </div>
          {availablePositions.length > 0 && (
            <div className="min-w-[180px]">
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Filtrer par poste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les postes</SelectItem>
                  {availablePositions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10 min-w-[150px]">Joueur</TableHead>
                {benchmarkGroups.map(group => (
                  <TableHead key={group.key} className="text-center min-w-[140px]">
                    <div>
                      <p className="font-medium">{group.label}</p>
                      <p className="text-xs text-muted-foreground font-normal">
                        {group.unit}
                        {group.use_body_weight_ratio && (
                          <span className="ml-1">
                            <Weight className="h-3 w-3 inline" /> / PDC
                          </span>
                        )}
                        {group.variants.some(v => v.filter_type === "position" && v.filter_value) && (
                          <span className="ml-1 italic">· par poste</span>
                        )}
                      </p>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {displayedPlayers.map(player => (
                <TableRow key={player.id}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium">
                    {player.first_name ? `${player.first_name} ${player.name}` : player.name}
                  </TableCell>
                  {benchmarkGroups.map(group => {
                    const bm = resolveVariant(group, player);
                    const val = playerResults.get(player.id)?.get(group.key);
                    const weight = playerWeights.get(player.id);

                    if (val == null || !bm) {
                      return (
                        <TableCell key={group.key} className="text-center">
                          <span className="text-muted-foreground text-xs">-</span>
                        </TableCell>
                      );
                    }

                    const { label, color } = getPlayerLevel(val, bm, weight);

                    // Charge en kg + ratio (charge / PDC) entre parenthèses
                    let displayValue = String(val);
                    if (bm.use_body_weight_ratio && weight) {
                      const ratio = (val / weight).toFixed(2).replace(".", ",");
                      displayValue = `${val} kg (${ratio} / PDC)`;
                    }

                    const variantLabel =
                      bm.filter_type === "position" && bm.filter_value ? bm.filter_value : null;

                    return (
                      <TableCell key={group.key} className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-mono font-semibold text-sm">{displayValue}</span>
                          <Badge className="text-[10px] px-1.5 py-0 text-white" style={{ backgroundColor: color }}>
                            {label}
                          </Badge>
                          {variantLabel && (
                            <span className="text-[10px] text-muted-foreground italic">
                              barème {variantLabel}
                            </span>
                          )}
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
