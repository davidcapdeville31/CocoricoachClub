import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Target, TrendingUp, TrendingDown, Minus, Weight } from "lucide-react";
import { computeBenchmarkLevel } from "@/lib/benchmarks/computeLevel";
import { matchesBenchmark } from "@/lib/benchmarks/matchTestType";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  categoryId: string;
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

interface ResultPoint {
  date: string;
  value: number;
}

const UNKNOWN_POS = "Sans poste";

export function BenchmarkPositionMatrix({ categoryId }: Props) {
  const [benchmarkId, setBenchmarkId] = useState<string>("");

  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks-matrix", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("benchmarks")
        .select("*")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return (data || []).map((b: any) => ({
        ...b,
        levels: Array.isArray(b.levels) ? b.levels : [],
      })) as Benchmark[];
    },
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players-matrix", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name, position")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: customTests = [] } = useQuery({
    queryKey: ["custom-tests-matrix", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_test_categories")
        .select("custom_tests(id, name, test_category)")
        .eq("category_id", categoryId);
      if (error) throw error;
      return (data || [])
        .map((r: any) => r.custom_tests)
        .filter(Boolean) as { id: string; name: string }[];
    },
  });

  const { data: bodyComps = [] } = useQuery({
    queryKey: ["body-comp-matrix", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_composition")
        .select("player_id, weight_kg, measurement_date")
        .eq("category_id", categoryId)
        .order("measurement_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const playerWeights = useMemo(() => {
    const m = new Map<string, number>();
    for (const bc of bodyComps as any[]) {
      if (bc.weight_kg && !m.has(bc.player_id)) m.set(bc.player_id, bc.weight_kg);
    }
    return m;
  }, [bodyComps]);

  const bm = useMemo(
    () => benchmarks.find((b) => b.id === benchmarkId) || null,
    [benchmarks, benchmarkId],
  );


  const { data: genericTests = [] } = useQuery({
    queryKey: ["generic-tests-matrix", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generic_tests")
        .select("player_id, test_type, test_category, result_value, test_date")
        .eq("category_id", categoryId)
        .order("test_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: benchmarks.length > 0,
  });

  const { data: speedTests = [] } = useQuery({
    queryKey: ["speed-tests-matrix", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speed_tests")
        .select("player_id, test_type, vma_kmh, speed_kmh, time_40m_seconds, test_date")
        .eq("category_id", categoryId)
        .order("test_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: benchmarks.length > 0,
  });

  const { data: strengthTests = [] } = useQuery({
    queryKey: ["strength-tests-matrix", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strength_tests")
        .select("player_id, test_name, weight_kg, test_date")
        .eq("category_id", categoryId)
        .order("test_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: benchmarks.length > 0,
  });

  // Build player -> sorted list of results for the selected benchmark
  const playerSeries = useMemo(() => {
    const map = new Map<string, ResultPoint[]>();
    if (!bm) return map;

    const push = (pid: string, date: string, value: number) => {
      if (value == null || !isFinite(value)) return;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push({ date, value });
    };

    genericTests.forEach((t: any) => {
      if (!matchesBenchmark(t.test_type, bm.test_type, customTests as any)) return;
      push(t.player_id, t.test_date, Number(t.result_value));
    });

    if (bm.test_category === "speed" || bm.test_category === "sprint") {
      speedTests.forEach((t: any) => {
        if (!matchesBenchmark(t.test_type, bm.test_type, customTests as any)) return;
        const v = t.vma_kmh ?? t.speed_kmh ?? t.time_40m_seconds;
        if (v != null) push(t.player_id, t.test_date, Number(v));
      });
    }
    if (bm.test_category === "strength" || bm.test_category === "force" || bm.test_category === "musculation") {
      strengthTests.forEach((t: any) => {
        if (!matchesBenchmark(t.test_name, bm.test_type, customTests as any)) return;
        if (t.weight_kg != null) push(t.player_id, t.test_date, Number(t.weight_kg));
      });
    }

    // sort ascending by date
    for (const arr of map.values()) {
      arr.sort((a, b) => a.date.localeCompare(b.date));
    }
    return map;
  }, [bm, genericTests, speedTests, strengthTests, customTests]);

  // All distinct dates across players (ascending)
  const allDates = useMemo(() => {
    const s = new Set<string>();
    for (const arr of playerSeries.values()) arr.forEach((p) => s.add(p.date));
    return Array.from(s).sort();
  }, [playerSeries]);

  // Group players by position
  const playersByPosition = useMemo(() => {
    const groups = new Map<string, typeof players>();
    for (const p of players as any[]) {
      const pos = p.position || UNKNOWN_POS;
      if (!groups.has(pos)) groups.set(pos, [] as any);
      groups.get(pos)!.push(p);
    }
    // Order positions alphabetically, unknown last
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === UNKNOWN_POS) return 1;
      if (b === UNKNOWN_POS) return -1;
      return a.localeCompare(b);
    });
  }, [players]);

  // Benchmark ajusté par poste : si le benchmark sélectionné cible tous les postes,
  // on regarde s'il existe des variantes benchmarks (même test_type) filtrées par poste
  const benchmarksForTestType = useMemo(() => {
    if (!bm) return [] as Benchmark[];
    return benchmarks.filter((b) => b.test_type === bm.test_type);
  }, [benchmarks, bm]);

  const getBenchmarkForPosition = (position: string): Benchmark | null => {
    if (!bm) return null;
    const perPos = benchmarksForTestType.find(
      (b) => b.filter_type === "position" && b.filter_value === position,
    );
    return perPos || bm;
  };

  const fmtDate = (d: string) => {
    try {
      return format(parseISO(d), "dd/MM/yy", { locale: fr });
    } catch {
      return d;
    }
  };

  if (benchmarks.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Target className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            Aucun barème défini. Va dans <strong>Effectif → Tests</strong> pour en créer.
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
              Vue effectif par poste & barème
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Sélectionne un test — évolution colorée entre chaque date.
            </p>
          </div>
          <div className="min-w-[240px]">
            <Select
              value={bm?.id || ""}
              onValueChange={(v) => setBenchmarkId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un test / barème" />
              </SelectTrigger>
              <SelectContent>
                {benchmarks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                    {b.filter_type === "position" && b.filter_value
                      ? ` · ${b.filter_value}`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {bm && bm.levels?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {bm.levels.map((lvl, i) => (
              <Badge
                key={i}
                className="text-white text-[11px]"
                style={{ backgroundColor: lvl.color }}
              >
                {lvl.label}
                {lvl.threshold != null && (
                  <span className="ml-1 opacity-90">
                    {bm.lower_is_better ? "≤" : "≥"} {lvl.threshold}
                    {bm.use_body_weight_ratio ? "× PDC" : bm.unit ? ` ${bm.unit}` : ""}
                  </span>
                )}
              </Badge>
            ))}
            {bm.use_body_weight_ratio && (
              <Badge variant="outline" className="text-[11px]">
                <Weight className="h-3 w-3 mr-1" /> Ratio × poids de corps
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {allDates.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Aucun résultat enregistré pour ce test.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[110px]">Poste</TableHead>
                  <TableHead className="min-w-[160px]">Joueur</TableHead>
                  <TableHead className="min-w-[140px]">Barème du poste</TableHead>
                  {allDates.map((d) => (
                    <TableHead key={d} className="text-center min-w-[110px]">
                      {fmtDate(d)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {playersByPosition.map(([pos, list]) => {
                  const posBm = getBenchmarkForPosition(pos);
                  return list.map((p: any, idx: number) => {
                    const series = playerSeries.get(p.id) || [];
                    const weight = playerWeights.get(p.id);
                    return (
                      <TableRow key={p.id}>
                        {idx === 0 ? (
                          <TableCell
                            rowSpan={list.length}
                            className="align-top font-semibold text-sm bg-muted/40 border-r"
                          >
                            {pos}
                            <div className="text-[10px] text-muted-foreground font-normal">
                              {list.length} joueur{list.length > 1 ? "s" : ""}
                            </div>
                          </TableCell>
                        ) : null}
                        <TableCell className="font-medium">
                          {p.first_name ? `${p.first_name} ${p.name}` : p.name}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {posBm?.levels?.length ? (
                            <div className="flex flex-col gap-0.5">
                              {posBm.levels.slice().reverse().map((l, i) => (
                                <span key={i} style={{ color: l.color }}>
                                  ● {l.label}
                                  {l.threshold != null && (
                                    <> {posBm.lower_is_better ? "≤" : "≥"} {
                                      posBm.use_body_weight_ratio && weight
                                        ? (l.threshold * weight).toFixed(1)
                                        : l.threshold
                                    }{posBm.unit ? ` ${posBm.unit}` : ""}</>
                                  )}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span>—</span>
                          )}
                        </TableCell>
                        {allDates.map((d, di) => {
                          const point = series.find((s) => s.date === d);
                          if (!point) {
                            return (
                              <TableCell key={d} className="text-center text-muted-foreground">
                                —
                              </TableCell>
                            );
                          }
                          const prev = series
                            .filter((s) => s.date < d)
                            .slice(-1)[0];
                          const level = posBm
                            ? computeBenchmarkLevel(point.value, posBm, weight)
                            : null;
                          let delta = 0;
                          let improved: 1 | 0 | -1 = 0;
                          if (prev) {
                            delta = point.value - prev.value;
                            if (posBm?.lower_is_better) {
                              improved = delta < 0 ? 1 : delta > 0 ? -1 : 0;
                            } else {
                              improved = delta > 0 ? 1 : delta < 0 ? -1 : 0;
                            }
                          }
                          const bg =
                            improved === 1
                              ? "bg-emerald-500/15"
                              : improved === -1
                              ? "bg-rose-500/15"
                              : "";
                          const displayValue =
                            posBm?.use_body_weight_ratio && weight
                              ? `${point.value} (${(point.value / weight).toFixed(2)}×)`
                              : point.value.toString();
                          return (
                            <TableCell key={d} className={`text-center ${bg}`}>
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="font-mono font-semibold text-sm">
                                  {displayValue}
                                </span>
                                {level && (
                                  <Badge
                                    className="text-[10px] px-1.5 py-0 text-white"
                                    style={{ backgroundColor: level.color }}
                                  >
                                    {level.label}
                                  </Badge>
                                )}
                                {prev && (
                                  <span
                                    className={`inline-flex items-center text-[10px] font-medium ${
                                      improved === 1
                                        ? "text-emerald-600"
                                        : improved === -1
                                        ? "text-rose-600"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {improved === 1 ? (
                                      <TrendingUp className="h-3 w-3 mr-0.5" />
                                    ) : improved === -1 ? (
                                      <TrendingDown className="h-3 w-3 mr-0.5" />
                                    ) : (
                                      <Minus className="h-3 w-3 mr-0.5" />
                                    )}
                                    {delta > 0 ? "+" : ""}
                                    {delta.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  });
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
