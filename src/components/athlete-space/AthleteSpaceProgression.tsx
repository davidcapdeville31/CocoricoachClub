import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Clock, Trophy, FlaskConical, Filter } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getTestCategoriesForSport } from "@/lib/constants/testCategories";
import { BatteryRadarCharts } from "@/components/category/tests/GenericTestsSection";
import { useCustomTestsMap } from "@/hooks/useCustomTestsMap";
import { useSuggestedBenchmarks } from "@/hooks/useSuggestedBenchmarks";
import { computeBenchmarkLevel } from "@/lib/benchmarks/computeLevel";
import { matchesBenchmark } from "@/lib/benchmarks/matchTestType";

interface Props {
  playerId: string;
  categoryId: string;
  sportType?: string;
}

export function AthleteSpaceProgression({ playerId, categoryId, sportType }: Props) {
  const testCategories = useMemo(() => getTestCategoriesForSport(sportType || ""), [sportType]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { map: customTestsMap } = useCustomTestsMap();
  const { suggestions: benchmarkSuggestions } = useSuggestedBenchmarks(playerId, categoryId);

  const { data: playerInfo } = useQuery({
    queryKey: ["athlete-space-player-weight", playerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("weight_kg")
        .eq("id", playerId)
        .maybeSingle();
      return data;
    },
  });
  const playerWeight = playerInfo?.weight_kg ?? null;

  const customTestsList = useMemo(
    () => Object.values(customTestsMap).map(c => ({ id: c.id, name: c.name })),
    [customTestsMap],
  );


  const { data: speedTests = [] } = useQuery({
    queryKey: ["athlete-space-speed-tests", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speed_tests")
        .select("*")
        .eq("player_id", playerId)
        .order("test_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: strengthTests = [] } = useQuery({
    queryKey: ["athlete-space-strength-tests", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strength_tests")
        .select("*")
        .eq("player_id", playerId)
        .order("test_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: genericTests = [] } = useQuery({
    queryKey: ["athlete-space-generic-tests", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generic_tests")
        .select("*")
        .eq("player_id", playerId)
        .order("test_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: matchStats = [] } = useQuery({
    queryKey: ["athlete-space-match-stats", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_match_stats")
        .select("*, matches!inner(match_date, opponent, score_home, score_away)")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // Speed test chart
  const speedChartData = speedTests
    .filter(t => t.time_40m_seconds)
    .map(t => ({
      date: format(new Date(t.test_date), "dd/MM", { locale: fr }),
      temps: t.time_40m_seconds,
    }));

  // Strength - group by test_name
  const strengthByExercise: Record<string, { date: string; value: number }[]> = {};
  strengthTests.forEach(t => {
    const key = t.test_name;
    if (!strengthByExercise[key]) strengthByExercise[key] = [];
    strengthByExercise[key].push({
      date: format(new Date(t.test_date), "dd/MM", { locale: fr }),
      value: t.weight_kg,
    });
  });

  // Generic tests - group by test_type for charts
  const genericByType: Record<string, { date: string; value: number; unit: string; label: string; categoryLabel: string; categoryValue: string }[]> = {};
  genericTests.forEach(t => {
    const key = `${t.test_category}__${t.test_type}`;
    if (!genericByType[key]) genericByType[key] = [];
    
    const cat = testCategories.find(c => c.value === t.test_category);
    const testDef = cat?.tests.find(tt => tt.value === t.test_type);
    const label = testDef?.label || t.test_type?.replace(/_/g, " ") || "Test";
    const categoryLabel = cat?.label || t.test_category?.replace(/_/g, " ") || "";
    
    genericByType[key].push({
      date: format(new Date(t.test_date), "dd/MM", { locale: fr }),
      value: t.result_value,
      unit: t.result_unit || "",
      label,
      categoryLabel,
      categoryValue: t.test_category,
    });
  });

  // Latest generic test results for summary
  const latestGenericByType: Record<string, { value: number; unit: string; label: string; categoryLabel: string; categoryValue: string; date: string }> = {};
  genericTests.forEach(t => {
    const key = `${t.test_category}__${t.test_type}`;
    const cat = testCategories.find(c => c.value === t.test_category);
    const testDef = cat?.tests.find(tt => tt.value === t.test_type);
    const label = testDef?.label || t.test_type?.replace(/_/g, " ") || "Test";
    const categoryLabel = cat?.label || t.test_category?.replace(/_/g, " ") || "";
    latestGenericByType[key] = { value: t.result_value, unit: t.result_unit || "", label, categoryLabel, categoryValue: t.test_category, date: t.test_date };
  });

  // Determine which categories actually have data
  const categoriesWithData = useMemo(() => {
    const catSet = new Set<string>();
    // Speed tests → mapped to "sprint" or "speed"
    if (speedTests.length > 0) catSet.add("__speed__");
    // Strength tests → mapped to "strength"  
    if (strengthTests.length > 0) catSet.add("__strength__");
    // Generic tests
    genericTests.forEach(t => catSet.add(t.test_category));
    return catSet;
  }, [speedTests, strengthTests, genericTests]);

  // Build filter tabs from categories that have data
  const availableFilters = useMemo(() => {
    const filters: { value: string; label: string }[] = [];
    
    // Check for speed tests
    if (categoriesWithData.has("__speed__")) {
      filters.push({ value: "__speed__", label: "Vitesse" });
    }
    // Check for strength tests
    if (categoriesWithData.has("__strength__")) {
      filters.push({ value: "__strength__", label: "Musculation" });
    }
    // Generic test categories
    testCategories.forEach(cat => {
      if (categoriesWithData.has(cat.value)) {
        filters.push({ value: cat.value, label: cat.label });
      }
    });
    // Also check for generic categories not in testCategories definition
    categoriesWithData.forEach(catValue => {
      if (catValue.startsWith("__")) return;
      if (!testCategories.find(c => c.value === catValue)) {
        filters.push({ value: catValue, label: catValue.replace(/_/g, " ") });
      }
    });
    
    return filters;
  }, [categoriesWithData, testCategories]);

  // Filter logic
  const showSpeed = selectedCategory === "all" || selectedCategory === "__speed__";
  const showStrength = selectedCategory === "all" || selectedCategory === "__strength__";
  const filteredGenericByType = useMemo(() => {
    if (selectedCategory === "all") return genericByType;
    return Object.fromEntries(
      Object.entries(genericByType).filter(([, data]) => data[0]?.categoryValue === selectedCategory)
    );
  }, [selectedCategory, genericByType]);

  const filteredLatestGeneric = useMemo(() => {
    if (selectedCategory === "all") return latestGenericByType;
    return Object.fromEntries(
      Object.entries(latestGenericByType).filter(([, data]) => data.categoryValue === selectedCategory)
    );
  }, [selectedCategory, latestGenericByType]);

  const getProgressionFeedback = (): string[] => {
    const msgs: string[] = [];

    if (showSpeed && speedTests.length >= 2) {
      const latest = speedTests[speedTests.length - 1];
      const previous = speedTests[speedTests.length - 2];
      if (latest.time_40m_seconds && previous.time_40m_seconds) {
        const diff = latest.time_40m_seconds - previous.time_40m_seconds;
        if (diff < 0) {
          msgs.push(`🏃 Vitesse: tu as progressé de ${Math.abs(diff).toFixed(2)}s par rapport à ton dernier test !`);
        } else if (diff > 0) {
          msgs.push(`🏃 Vitesse: +${diff.toFixed(2)}s par rapport à ton dernier test. Continue de travailler ta vitesse.`);
        }
      }
    }

    if (showStrength) {
      Object.entries(strengthByExercise).forEach(([exercise, data]) => {
        if (data.length >= 2) {
          const latest = data[data.length - 1].value;
          const previous = data[data.length - 2].value;
          const diff = latest - previous;
          if (diff > 0) {
            msgs.push(`💪 ${exercise}: +${diff}kg depuis ton dernier test. Belle progression !`);
          }
        }
      });
    }

    // Generic tests progression feedback
    Object.entries(filteredGenericByType).forEach(([, data]) => {
      if (data.length >= 2) {
        const latest = data[data.length - 1];
        const previous = data[data.length - 2];
        const diff = latest.value - previous.value;
        const isTimeTest = latest.unit === "s" || latest.unit === "min";
        if (isTimeTest) {
          if (diff < 0) {
            msgs.push(`⏱️ ${latest.label}: -${Math.abs(diff).toFixed(1)}${latest.unit} par rapport à ton dernier test !`);
          }
        } else {
          if (diff > 0) {
            msgs.push(`📈 ${latest.label}: +${diff.toFixed(1)}${latest.unit} depuis ton dernier test !`);
          }
        }
      }
    });

    if (msgs.length === 0) {
      msgs.push("📊 Tes résultats de tests s'afficheront ici au fur et à mesure.");
    }

    return msgs;
  };

  const CHART_COLORS = [
    "hsl(var(--accent))",
    "hsl(var(--primary))",
    "hsl(var(--warning, 38 92% 50%))",
    "hsl(var(--destructive))",
  ];

  return (
    <div className="space-y-6">
      {/* Category filter tabs */}
      {availableFilters.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Filtrer par catégorie</span>
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Tous les tests
              </button>
              {availableFilters.map(f => (
                <button
                  key={f.value}
                  onClick={() => setSelectedCategory(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    selectedCategory === f.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Card "Ta progression" supprimée à la demande utilisateur */}

      {/* Latest results + radar side-by-side */}
      {(() => {
        const batteryTests = genericTests.filter(t => /^\[Batterie:/i.test((t as any).notes || ""));
        const hasResults = Object.keys(filteredLatestGeneric).length > 0;
        const hasRadar = batteryTests.length > 0;
        if (!hasResults && !hasRadar) return null;
        return (
          <div className="space-y-4">
            {hasResults && (
              <Card className="bg-gradient-card shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    Derniers résultats de tests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Object.entries(filteredLatestGeneric).map(([key, test]) => {
                      const series = filteredGenericByType[key] || [];
                      let progression: { pct: number; positive: boolean } | null = null;
                      if (series.length >= 2) {
                        const latest = series[series.length - 1].value;
                        const previous = series[series.length - 2].value;
                        if (previous !== 0) {
                          const isTimeTest = test.unit === "s" || test.unit === "min";
                          const rawPct = ((latest - previous) / Math.abs(previous)) * 100;
                          const positive = isTimeTest ? rawPct < 0 : rawPct > 0;
                          progression = { pct: Math.abs(rawPct), positive };
                        }
                      }
                      return (
                        <div key={key} className="p-3 rounded-lg bg-muted/30 text-center relative min-w-0">
                          {progression && (
                            <Badge
                              variant="secondary"
                              className={`absolute top-1 right-1 text-[10px] px-1.5 py-0 leading-tight ${
                                progression.positive ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                              }`}
                            >
                              {progression.positive ? "▲" : "▼"} {progression.pct.toFixed(0)}%
                            </Badge>
                          )}
                          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide truncate">{test.categoryLabel}</p>
                          <p className="text-xs text-muted-foreground truncate">{test.label}</p>
                          <p className="text-lg font-bold leading-tight mt-1">
                            {test.value}
                            <span className="text-xs font-normal text-muted-foreground ml-1">{test.unit}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {format(new Date(test.date), "dd MMM yy", { locale: fr })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {hasRadar && (
              <div>
                <BatteryRadarCharts
                  tests={batteryTests}
                  isViewer={true}
                  categoryId={categoryId}
                  onDelete={() => {}}
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* Comparatif test précédent → dernier test (format mobile-friendly) */}
      {(() => {
        type Row = {
          key: string;
          categoryLabel: string;
          label: string;
          unit: string;
          prevDate: string;
          prevValue: number;
          lastDate: string;
          lastValue: number;
          isTimeTest: boolean;
        };
        const rows: Row[] = [];

        // Speed (40m)
        if (showSpeed) {
          const series = speedTests.filter(t => t.time_40m_seconds);
          if (series.length >= 2) {
            const prev = series[series.length - 2];
            const last = series[series.length - 1];
            rows.push({
              key: "speed_40m",
              categoryLabel: "Vitesse",
              label: "40m",
              unit: "s",
              prevDate: prev.test_date,
              prevValue: prev.time_40m_seconds!,
              lastDate: last.test_date,
              lastValue: last.time_40m_seconds!,
              isTimeTest: true,
            });
          }
        }

        // Strength
        if (showStrength) {
          const byEx: Record<string, typeof strengthTests> = {};
          strengthTests.forEach(t => {
            if (!byEx[t.test_name]) byEx[t.test_name] = [];
            byEx[t.test_name].push(t);
          });
          Object.entries(byEx).forEach(([exercise, list]) => {
            if (list.length >= 2) {
              const prev = list[list.length - 2];
              const last = list[list.length - 1];
              rows.push({
                key: `str_${exercise}`,
                categoryLabel: "Musculation",
                label: exercise,
                unit: "kg",
                prevDate: prev.test_date,
                prevValue: prev.weight_kg,
                lastDate: last.test_date,
                lastValue: last.weight_kg,
                isTimeTest: false,
              });
            }
          });
        }

        // Generic tests
        Object.entries(filteredGenericByType).forEach(([key, data]) => {
          if (data.length < 2) return;
          const raw = genericTests
            .filter(t => `${t.test_category}__${t.test_type}` === key)
            .sort((a, b) => new Date(a.test_date).getTime() - new Date(b.test_date).getTime());
          if (raw.length < 2) return;
          const prev = raw[raw.length - 2];
          const last = raw[raw.length - 1];
          const isTimeTest = (last.result_unit || "") === "s" || (last.result_unit || "") === "min";
          rows.push({
            key,
            categoryLabel: data[0].categoryLabel,
            label: data[0].label,
            unit: last.result_unit || "",
            prevDate: prev.test_date,
            prevValue: prev.result_value,
            lastDate: last.test_date,
            lastValue: last.result_value,
            isTimeTest,
          });
        });

        if (rows.length === 0) return null;

        return (
          <Card className="bg-gradient-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                Comparatif tests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rows.map(row => {
                const diff = row.lastValue - row.prevValue;
                const rawPct = row.prevValue !== 0 ? (diff / Math.abs(row.prevValue)) * 100 : 0;
                const positive = row.isTimeTest ? rawPct < 0 : rawPct > 0;
                const pct = Math.abs(rawPct);
                return (
                  <div key={row.key} className="rounded-xl bg-muted/40 p-2 sm:p-3">
                    <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground/70 uppercase tracking-wide truncate">{row.categoryLabel}</p>
                        <p className="text-[12px] sm:text-sm font-semibold truncate">{row.label}</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0 sm:py-0.5 shrink-0 ${
                          positive ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                        }`}
                      >
                        {positive ? "▲" : "▼"} {pct.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      <div className="rounded-lg bg-background/60 p-1.5 sm:p-2 text-center">
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                          {format(new Date(row.prevDate), "dd MMM yy", { locale: fr })}
                        </p>
                        <p className="text-sm sm:text-base font-bold leading-tight">
                          {row.prevValue} <span className="text-[9px] sm:text-[10px] font-normal text-muted-foreground">{row.unit}</span>
                        </p>
                      </div>
                      <div className="rounded-lg bg-background/60 p-1.5 sm:p-2 text-center ring-1 ring-primary/30">
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                          {format(new Date(row.lastDate), "dd MMM yy", { locale: fr })}
                        </p>
                        <p className="text-sm sm:text-base font-bold leading-tight">
                          {row.lastValue} <span className="text-[9px] sm:text-[10px] font-normal text-muted-foreground">{row.unit}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

    </div>
  );
}
