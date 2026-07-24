import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Clock, Trophy, FlaskConical, Filter, Target } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getTestCategoriesForSport } from "@/lib/constants/testCategories";
import { BatteryRadarCharts } from "@/components/category/tests/GenericTestsSection";
import { useCustomTestsMap } from "@/hooks/useCustomTestsMap";
import { useSuggestedBenchmarks } from "@/hooks/useSuggestedBenchmarks";
import { computeBenchmarkLevel } from "@/lib/benchmarks/computeLevel";
import { matchesBenchmark } from "@/lib/benchmarks/matchTestType";
import { collectLatestPlayerWeights } from "@/lib/benchmarks/playerWeights";
import { getPositionGroupsForSport, playerBelongsToGroup } from "@/lib/constants/sportPositionGroups";
import { BenchmarkPositionMatrix } from "@/components/tonnage/BenchmarkPositionMatrix";
import { AllTestsBenchmarkMatrix } from "@/components/tonnage/AllTestsBenchmarkMatrix";


interface Props {
  playerId: string;
  categoryId: string;
  sportType?: string;
}

const isBodyWeightRatioUnit = (unit?: string | null) => {
  const normalized = String(unit || "").toLowerCase();
  return /pdc|poids\s*de\s*corps|body\s*weight|bodyweight|ratio/.test(normalized);
};

const isBodyWeightRatioTest = (
  unit: string | null | undefined,
  testType: string | null | undefined,
  customTestsMap: Record<string, { unit?: string | null }>,
) => {
  if (isBodyWeightRatioUnit(unit)) return true;
  const customUnit = testType?.startsWith("custom:") ? customTestsMap[testType]?.unit : null;
  return isBodyWeightRatioUnit(customUnit);
};

const formatFrNumber = (value: number, digits = 2) => {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(digits).replace(/\.0+$/, "").replace(".", ",");
};

const buildRatioDisplay = (rawValue: unknown, playerWeight?: number | null) => {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return { main: String(rawValue ?? ""), sub: "ratio charge/poids", ratio: null as number | null, loadKg: null as number | null };
  }

  if (!playerWeight || playerWeight <= 0) {
    return { main: formatFrNumber(value), sub: "ratio charge/poids", ratio: null as number | null, loadKg: value };
  }

  const loadKg = value >= 5 ? value : value * playerWeight;
  const ratio = value >= 5 ? loadKg / playerWeight : value;
  return {
    main: `ratio ${formatFrNumber(ratio, 2)}`,
    sub: `${formatFrNumber(loadKg, 1)}/${formatFrNumber(playerWeight, 1)} kg`,
    ratio,
    loadKg,
  };
};

const getRatioComparableValue = (rawValue: unknown, playerWeight?: number | null) => {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return null;
  if (!playerWeight || playerWeight <= 0) return value;
  return value >= 5 ? value / playerWeight : value;
};

export function AthleteSpaceProgression({ playerId, categoryId, sportType }: Props) {
  const testCategories = useMemo(() => getTestCategoriesForSport(sportType || ""), [sportType]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { map: customTestsMap } = useCustomTestsMap();
  const { suggestions: benchmarkSuggestions } = useSuggestedBenchmarks(playerId, categoryId);

  const { data: playerInfo } = useQuery({
    queryKey: ["athlete-space-player-weight", playerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("body_composition")
        .select("weight_kg, measurement_date")
        .eq("player_id", playerId)
        .order("measurement_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const bodyCompWeight = playerInfo?.weight_kg ?? null;

  const { data: measurementWeight = null } = useQuery({
    queryKey: ["athlete-space-measurement-weight", playerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("player_measurements")
        .select("weight_kg, measurement_date")
        .eq("player_id", playerId)
        .not("weight_kg", "is", null)
        .order("measurement_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? { w: Number(data.weight_kg), d: (data as any).measurement_date as string } : null;
    },
  });

  const customTestsList = useMemo(
    () => Object.values(customTestsMap).map(c => ({ id: c.id, name: c.name })),
    [customTestsMap],
  );
  const customTestsForWeights = useMemo(
    () => Object.values(customTestsMap).map(c => ({ id: c.id, name: c.name, unit: c.unit, test_category: c.test_category })),
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

  // Aggregate latest body weight across all sources (including custom anthropometry/Poids tests)
  const playerWeight = useMemo(() => {
    const bodyComps = bodyCompWeight != null && (playerInfo as any)?.measurement_date
      ? [{ player_id: playerId, weight_kg: bodyCompWeight, measurement_date: (playerInfo as any).measurement_date }]
      : [];
    const playerMeasurements = measurementWeight
      ? [{ player_id: playerId, weight_kg: measurementWeight.w, measurement_date: measurementWeight.d }]
      : [];

    return collectLatestPlayerWeights({
      bodyComps,
      playerMeasurements,
      weightTests: genericTests as any[],
      customTests: customTestsForWeights,
    }).get(playerId) || null;
  }, [bodyCompWeight, playerInfo, measurementWeight, genericTests, customTestsForWeights, playerId]);

  // Player position (for "Poste" column and benchmark scale display)
  const { data: playerRow } = useQuery({
    queryKey: ["athlete-space-player-position", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("position, gender")
        .eq("id", playerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const positionGroups = useMemo(() => getPositionGroupsForSport(sportType || ""), [sportType]);
  const positionLabel = useMemo(() => {
    const raw = playerRow?.position;
    if (!raw) return "—";
    for (const g of positionGroups) {
      if (playerBelongsToGroup(raw, g)) return g.label;
    }
    return raw;
  }, [playerRow, positionGroups]);

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
    const customInfo = t.test_type?.startsWith("custom:") ? customTestsMap[t.test_type] : null;
    const label = customInfo?.name || testDef?.label || t.test_type?.replace(/_/g, " ") || "Test";
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
  const latestGenericByType: Record<string, { value: number; unit: string; label: string; categoryLabel: string; categoryValue: string; date: string; testType: string }> = {};
  genericTests.forEach(t => {
    const key = `${t.test_category}__${t.test_type}`;
    const cat = testCategories.find(c => c.value === t.test_category);
    const testDef = cat?.tests.find(tt => tt.value === t.test_type);
    const customInfo = t.test_type?.startsWith("custom:") ? customTestsMap[t.test_type] : null;
    const label = customInfo?.name || testDef?.label || t.test_type?.replace(/_/g, " ") || "Test";
    const categoryLabel = cat?.label || t.test_category?.replace(/_/g, " ") || "";
    latestGenericByType[key] = { value: t.result_value, unit: t.result_unit || "", label, categoryLabel, categoryValue: t.test_category, date: t.test_date, testType: t.test_type };
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
                          const isRatioTest = isBodyWeightRatioTest(test.unit, test.testType, customTestsMap);
                          const latestComparable = isRatioTest ? getRatioComparableValue(latest, playerWeight) : latest;
                          const previousComparable = isRatioTest ? getRatioComparableValue(previous, playerWeight) : previous;
                          if (latestComparable == null || previousComparable == null || previousComparable === 0) return null;
                          const rawPct = ((latestComparable - previousComparable) / Math.abs(previousComparable)) * 100;
                          // Ignore les variations non significatives (< 0.5%) pour éviter d'afficher "▼ 0%" en rouge
                          if (Math.abs(rawPct) >= 0.5) {
                            const positive = isTimeTest ? rawPct < 0 : rawPct > 0;
                            progression = { pct: Math.abs(rawPct), positive };
                          }
                        }
                      }
                      // Best matching benchmark for this test
                      const bench = benchmarkSuggestions.find(b =>
                        b.test_category === test.categoryValue &&
                        matchesBenchmark(test.testType, b.test_type, customTestsList)
                      );
                      const isRatioTest = !!bench?.use_body_weight_ratio || isBodyWeightRatioTest(test.unit, test.testType, customTestsMap);
                      const ratioDisplay = isRatioTest ? buildRatioDisplay(test.value, playerWeight) : null;
                      const level = bench
                        ? computeBenchmarkLevel(ratioDisplay?.loadKg ?? test.value, bench, playerWeight)
                        : null;
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
                            {ratioDisplay ? ratioDisplay.main : test.value}
                            {!ratioDisplay && test.unit && (
                              <span className="text-xs font-normal text-muted-foreground ml-1">
                                {test.unit}
                              </span>
                            )}
                          </p>
                          {ratioDisplay?.sub && (
                            <p className="text-[11px] font-semibold text-primary mt-0.5">
                              <span className="text-muted-foreground font-normal">({ratioDisplay.sub})</span>
                            </p>
                          )}
                          {level && (
                            <Badge
                              className="mt-1 text-[10px] px-1.5 py-0 leading-tight border-0"
                              style={{ backgroundColor: level.color, color: "#fff" }}
                            >
                              {level.label}
                            </Badge>
                          )}
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

      {/* Tableau + graphique pour CHAQUE test avec des résultats */}
      <AllTestsBenchmarkMatrix categoryId={categoryId} filterPlayerId={playerId} />



    </div>
  );
}
