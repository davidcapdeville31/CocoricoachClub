import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { FlaskConical, Filter } from "lucide-react";
import { format } from "date-fns";
import { getTestCategoriesForSport } from "@/lib/constants/testCategories";
import { collectLatestPlayerWeights } from "@/lib/benchmarks/playerWeights";
import { useTranslation } from "react-i18next";

interface Props {
  playerId: string;
  categoryId: string;
  sportType?: string;
}

export function AthleteSpaceTests({ playerId, sportType }: Props) {
  const { t } = useTranslation();
  const testCategories = useMemo(() => getTestCategoriesForSport(sportType || ""), [sportType]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTest, setSelectedTest] = useState<string>("all");

  const { data: genericTests = [], isLoading } = useQuery({
    queryKey: ["athlete-space-all-tests", playerId],
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

  const { data: speedTests = [] } = useQuery({
    queryKey: ["athlete-space-speed-tests-tab", playerId],
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
    queryKey: ["athlete-space-strength-tests-tab", playerId],
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

  const { data: bodyCompositionWeights = [] } = useQuery({
    queryKey: ["athlete-space-tests-body-composition-weight", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_composition")
        .select("player_id, weight_kg, measurement_date")
        .eq("player_id", playerId)
        .not("weight_kg", "is", null)
        .order("measurement_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: measurementWeights = [] } = useQuery({
    queryKey: ["athlete-space-tests-measurement-weight", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_measurements")
        .select("player_id, weight_kg, measurement_date")
        .eq("player_id", playerId)
        .not("weight_kg", "is", null)
        .order("measurement_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const customIds = useMemo(() => {
    const ids = new Set<string>();
    genericTests.forEach((t: any) => {
      const type = t.test_type as string | null;
      const cat = t.test_category as string | null;
      if (type?.startsWith("custom:")) ids.add(type.slice(7));
      if (cat?.startsWith("custom:")) ids.add(cat.slice(7));
    });
    return Array.from(ids);
  }, [genericTests]);

  const { data: customTests = [] } = useQuery({
    queryKey: ["athlete-space-custom-tests-labels", customIds.slice().sort().join(",")],
    enabled: customIds.length > 0,
    queryFn: async () => {
      // Try direct read first (works for staff / club members)
      const direct = await supabase
        .from("custom_tests")
        .select("id,name,unit,test_category")
        .in("id", customIds);
      if (!direct.error && direct.data && direct.data.length === customIds.length) {
        return direct.data;
      }
      // Fallback via security-definer RPC so athletes (who may lack club_members
      // access) can still resolve readable names for their own tests.
      const { data, error } = await supabase.rpc("get_custom_test_labels", {
        _ids: customIds,
      });
      if (error) {
        // Merge whatever direct returned
        return direct.data || [];
      }
      return data || [];
    },
  });

  const playerWeight = useMemo(() => {
    return collectLatestPlayerWeights({
      bodyComps: bodyCompositionWeights as any[],
      playerMeasurements: measurementWeights as any[],
      weightTests: genericTests as any[],
      customTests: customTests as any[],
    }).get(playerId) || null;
  }, [bodyCompositionWeights, measurementWeights, genericTests, customTests, playerId]);

  const customById = useMemo(() => {
    const m = new Map<string, any>();
    customTests.forEach((c: any) => m.set(c.id, c));
    return m;
  }, [customTests]);

  const formatResult = (test: any) => {
    const custom = typeof test.test_type === "string" && test.test_type.startsWith("custom:")
      ? customById.get(test.test_type.slice(7))
      : null;
    const rawUnit = String(test.result_unit || custom?.unit || "");
    const isBodyWeightRatio = /pdc|poids\s*de\s*corps|body\s*weight/i.test(rawUnit);
    const value = Number(test.result_value);

    if (!isBodyWeightRatio || !Number.isFinite(value)) {
      return <>{test.result_value} {test.result_unit || ""}</>;
    }

    if (!playerWeight || playerWeight <= 0) {
      return <>{test.result_value} kg <span className="block text-[10px] font-normal text-muted-foreground">{t("athleteSpace:tests.ratioLoadWeight")}</span></>;
    }

    const loadKg = value >= 5 ? value : value * playerWeight;
    const ratio = value >= 5 ? value / playerWeight : value;
    const loadText = Number.isInteger(loadKg) ? `${loadKg}` : loadKg.toFixed(1).replace(".", ",");
    const weightText = Number.isInteger(playerWeight) ? `${playerWeight}` : playerWeight.toFixed(1).replace(".", ",");

    return (
      <>
        {loadText} kg
        <span className="block text-[10px] font-normal text-muted-foreground">
          {t("athleteSpace:tests.ratioText", { ratio: ratio.toFixed(2).replace(".", ","), load: loadText, weight: weightText })}
        </span>
      </>
    );
  };

  const resolveLabel = (raw?: string | null) => {
    if (!raw) return "";
    if (raw.startsWith("custom:")) {
      const c = customById.get(raw.slice(7));
      return c?.name || raw.replace(/_/g, " ");
    }
    return raw.replace(/_/g, " ");
  };

  const categoriesWithData = useMemo(() => {
    const catSet = new Set<string>();
    if (speedTests.length > 0) catSet.add("__speed__");
    if (strengthTests.length > 0) catSet.add("__strength__");
    genericTests.forEach((t: any) => catSet.add(t.test_category));
    return catSet;
  }, [speedTests, strengthTests, genericTests]);

  const availableFilters = useMemo(() => {
    const filters: { value: string; label: string }[] = [];
    if (categoriesWithData.has("__speed__")) filters.push({ value: "__speed__", label: t("athleteSpace:tests.speed") });
    if (categoriesWithData.has("__strength__")) filters.push({ value: "__strength__", label: t("athleteSpace:tests.strength") });
    testCategories.forEach(cat => {
      if (categoriesWithData.has(cat.value)) filters.push({ value: cat.value, label: cat.label });
    });
    return filters;
  }, [categoriesWithData, testCategories, t]);

  const showSpeed = selectedCategory === "all" || selectedCategory === "__speed__";
  const showStrength = selectedCategory === "all" || selectedCategory === "__strength__";

  // Tests available inside the selected category
  const availableTests = useMemo(() => {
    if (selectedCategory === "all") return [];
    const map = new Map<string, string>();
    if (selectedCategory === "__speed__") {
      if (speedTests.length > 0) map.set("__sprint40__", t("athleteSpace:tests.sprint40"));
    } else if (selectedCategory === "__strength__") {
      strengthTests.forEach((t: any) => {
        if (t.test_name) map.set(t.test_name, t.test_name);
      });
    } else {
      genericTests
        .filter((t: any) => t.test_category === selectedCategory)
        .forEach((t: any) => {
          const cat = testCategories.find(c => c.value === t.test_category);
          const def = cat?.tests.find(x => x.value === t.test_type);
          const label = def?.label || resolveLabel(t.test_type);
          map.set(t.test_type, label);
        });
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [selectedCategory, speedTests, strengthTests, genericTests, testCategories, customById]);

  const handleSelectCategory = (value: string) => {
    setSelectedCategory(value);
    setSelectedTest("all");
  };


  if (isLoading) return null;

  const noData = genericTests.length === 0 && speedTests.length === 0 && strengthTests.length === 0;
  if (noData) {
    return (
      <Card className="bg-gradient-card">
        <CardContent className="py-8 text-center">
          <FlaskConical className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t("athleteSpace:tests.noData")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {availableFilters.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">{t("athleteSpace:tests.filterHistory")}</span>
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              <button
                onClick={() => handleSelectCategory("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t("athleteSpace:tests.all")}
              </button>
              {availableFilters.map(f => (
                <button
                  key={f.value}
                  onClick={() => handleSelectCategory(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    selectedCategory === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Second-level filter: specific test within the selected category */}
          {selectedCategory !== "all" && availableTests.length > 1 && (
            <div className="mt-2">
              <select
                value={selectedTest}
                onChange={(e) => setSelectedTest(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">{t("athleteSpace:tests.allTests")}</option>
                {availableTests.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Full test history table */}
      <Card className="bg-gradient-card shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            {t("athleteSpace:tests.fullHistory")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 [&_th]:px-2 [&_th]:py-2 [&_td]:px-2 [&_td]:py-2 [&_th]:text-[11px] [&_th]:whitespace-nowrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">{t("athleteSpace:tests.date")}</TableHead>
                  <TableHead className="whitespace-nowrap">{t("athleteSpace:tests.category")}</TableHead>
                  <TableHead className="whitespace-nowrap">{t("athleteSpace:tests.test")}</TableHead>
                  <TableHead className="text-right whitespace-nowrap">{t("athleteSpace:tests.result")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selectedCategory === "all" || (selectedCategory !== "__speed__" && selectedCategory !== "__strength__")) &&
                  genericTests
                    .filter((t: any) => selectedCategory === "all" || t.test_category === selectedCategory)
                    .filter((t: any) => selectedTest === "all" || t.test_type === selectedTest)
                    .slice()
                    .reverse()
                    .slice(0, 30)
                    .map((test: any) => {
                      const cat = testCategories.find(c => c.value === test.test_category);
                      const testDef = cat?.tests.find(t => t.value === test.test_type);
                      return (
                        <TableRow key={test.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {format(new Date(test.test_date), "dd/MM/yyyy", { locale: getDateLocale() })}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{cat?.label || resolveLabel(test.test_category)}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{testDef?.label || resolveLabel(test.test_type)}</TableCell>
                          <TableCell className="text-xs font-semibold text-primary text-right whitespace-nowrap">
                            {formatResult(test)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                {showSpeed && (selectedTest === "all" || selectedTest === "__sprint40__") && speedTests.slice().reverse().slice(0, 10).map((test: any) => (
                  <TableRow key={test.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(test.test_date), "dd/MM/yyyy", { locale: getDateLocale() })}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{t("athleteSpace:tests.speed")}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{t("athleteSpace:tests.sprint40")}</TableCell>
                    <TableCell className="text-xs font-semibold text-primary text-right whitespace-nowrap">
                      {test.time_40m_seconds}s
                    </TableCell>
                  </TableRow>
                ))}
                {showStrength && strengthTests
                  .filter((t: any) => selectedTest === "all" || t.test_name === selectedTest)
                  .slice().reverse().slice(0, 10).map((test: any) => (
                  <TableRow key={test.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(test.test_date), "dd/MM/yyyy", { locale: getDateLocale() })}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{t("athleteSpace:tests.strength")}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{test.test_name}</TableCell>
                    <TableCell className="text-xs font-semibold text-primary text-right whitespace-nowrap">
                      {test.weight_kg}kg
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
