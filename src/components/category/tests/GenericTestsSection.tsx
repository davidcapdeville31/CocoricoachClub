import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Plus, Trash2, Filter, ClipboardList, CalendarPlus, FolderPlus, Pencil, Star, Copy, ChevronDown, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip as RTooltip,
} from "recharts";
import { CreateCustomTestDialog } from "./CreateCustomTestDialog";
import { CreateThemeCategoryDialog } from "./CreateThemeCategoryDialog";
import { EditCustomTestDialog, type EditableTest } from "./EditCustomTestDialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { UnifiedTestDialog } from "./UnifiedTestDialog";
import { ScheduleTestDialog } from "./ScheduleTestDialog";
import { TEST_CATEGORIES, getTestLabel, getTestCategoriesForSport, TestCategory } from "@/lib/constants/testCategories";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";

interface GenericTestsSectionProps {
  categoryId: string;
  sportType?: string;
  defaultCategory?: string;
}

export function BatteryRadarCharts({
  tests,
  isViewer,
  categoryId,
  onDelete,
}: {
  tests: any[];
  isViewer: boolean;
  categoryId: string;
  onDelete: (id: string) => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [radarMode, setRadarMode] = useState<Record<string, "tests" | "qualities">>({});

  // Lookup max_points and levels from battery definitions
  const { data: batteryLookup } = useQuery({
    queryKey: ["battery_lookup", categoryId],
    queryFn: async () => {
      const { data: cat } = await supabase
        .from("categories")
        .select("club_id")
        .eq("id", categoryId)
        .single();
      const clubId = (cat as any)?.club_id;
      if (!clubId) return { maxPoints: {} as Record<string, number>, levels: {} as Record<string, any[]> };
      const { data } = await supabase
        .from("test_batteries")
        .select("name, levels, items:test_battery_items(test_name, max_points, test_category, custom_test:custom_tests(test_category))")
        .eq("club_id", clubId);
      const maxPoints: Record<string, number> = {};
      const levels: Record<string, any[]> = {};
      const categories: Record<string, string> = {};
      (data || []).forEach((b: any) => {
        if (Array.isArray(b.levels)) levels[b.name] = b.levels;
        (b.items || []).forEach((it: any) => {
          if (it.test_name && it.max_points != null) {
            maxPoints[`${b.name}::${it.test_name}`] = Number(it.max_points);
          }
          if (it.test_name) {
            const liveCat = it.custom_test?.test_category || it.test_category;
            if (liveCat) categories[`${b.name}::${it.test_name}`] = liveCat;
          }
        });
      });
      return { maxPoints, levels, categories };
    },
  });

  const groups = useMemo(() => {
    type Item = { id: string; testName: string; points: number; maxPoints: number; resultValue: any; resultUnit: any; rawIds: string[]; testCategory: string | null };
    const map = new Map<string, {
      key: string;
      playerName: string;
      playerId: string | null;
      batteryName: string;
      date: string;
      itemsByBase: Map<string, Item>; // merge bilateral pairs by base test name
      raw: any[];
    }>();

    for (const test of tests) {
      const notes: string = test.notes || "";
      const battMatch = notes.match(/^\[Batterie:\s*([^\]]+)\]/i);
      if (!battMatch) continue;
      const batteryName = battMatch[1].trim();
      const testNameMatch = notes.match(/Test:\s*(.+?)\s*·/i);
      const testNameFull = (testNameMatch?.[1] || "Test").trim();
      const sideMatch = testNameFull.match(/\((Droit|Gauche)\)\s*$/i);
      const baseTestName = testNameFull.replace(/\s*\((Droit|Gauche)\)\s*$/i, "").trim();

      // Try full format "Score N/M pts", else legacy "Score N pts"
      const fullMatch = notes.match(/Score\s+(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/i);
      const legacyMatch = !fullMatch ? notes.match(/Score\s+(\d+(?:[.,]\d+)?)\s*pts/i) : null;
      const points = fullMatch
        ? Number(fullMatch[1].replace(",", "."))
        : legacyMatch ? Number(legacyMatch[1].replace(",", ".")) : 0;
      const maxFromNotes = fullMatch ? Number(fullMatch[2].replace(",", ".")) : 0;
      const maxFromLookup = batteryLookup?.maxPoints?.[`${batteryName}::${baseTestName}`] ?? 0;
      const maxPoints = maxFromNotes > 0 ? maxFromNotes : maxFromLookup;

      const playerName = test.players?.name || "Athlète";
      const playerId = test.player_id || null;
      const key = `${playerId || playerName}__${test.test_date}__${batteryName}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          playerName,
          playerId,
          batteryName,
          date: test.test_date,
          itemsByBase: new Map(),
          raw: [],
        });
      }
      const g = map.get(key)!;
      const existing = g.itemsByBase.get(baseTestName);
      if (existing) {
        // Bilateral pair → sum points, keep max once, label as base name
        existing.points += points;
        existing.testName = baseTestName;
        existing.rawIds.push(test.id);
        existing.resultValue = `${existing.resultValue} / ${test.result_value}`;
      } else {
        g.itemsByBase.set(baseTestName, {
          id: test.id,
          testName: sideMatch ? baseTestName : (testNameMatch?.[1] || "Test"),
          points,
          maxPoints,
          resultValue: test.result_value,
          resultUnit: test.result_unit,
          rawIds: [test.id],
          testCategory: batteryLookup?.categories?.[`${batteryName}::${baseTestName}`] || test.test_category || null,
        });
      }
      g.raw.push(test);
    }

    return Array.from(map.values())
      .map((g) => ({
        key: g.key,
        playerName: g.playerName,
        playerId: g.playerId,
        batteryName: g.batteryName,
        date: g.date,
        items: Array.from(g.itemsByBase.values()),
        raw: g.raw,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [tests, batteryLookup]);

  // Helper: pick color from battery levels by % (highest minPercent ≤ pct wins)
  const getLevelInfo = (batteryName: string, pct: number): { color: string; label: string } => {
    const levels = batteryLookup?.levels?.[batteryName];
    if (Array.isArray(levels) && levels.length > 0) {
      const sorted = [...levels].sort((a: any, b: any) => Number(b.minPercent) - Number(a.minPercent));
      const match = sorted.find((l: any) => pct >= Number(l.minPercent));
      if (match) return { color: match.color || "hsl(var(--primary))", label: match.label || "" };
    }
    // Fallback if no levels defined
    if (pct >= 75) return { color: "hsl(142 71% 45%)", label: "Bon" };
    if (pct >= 50) return { color: "hsl(38 92% 50%)", label: "Moyen" };
    return { color: "hsl(0 84% 60%)", label: "Faible" };
  };


  if (groups.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Aucun résultat de batterie pour générer un diagramme.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((g) => {
        const totalPoints = g.items.reduce((s, i) => s + i.points, 0);
        const totalMax = g.items.reduce((s, i) => s + i.maxPoints, 0);
        const pct = totalMax > 0 ? Math.round((totalPoints / totalMax) * 100) : 0;
        const { color, label } = getLevelInfo(g.batteryName, pct);
        const mode = radarMode[g.key] || "tests";

        // Per-test radar data
        const testsRadarData = g.items.map((it) => {
          const v = it.maxPoints > 0 ? Math.round((it.points / it.maxPoints) * 100) : 0;
          return {
            axis: it.testName,
            value: v,
            points: it.points,
            maxPoints: it.maxPoints,
            color: getLevelInfo(g.batteryName, v).color,
          };
        });

        // Per physical-quality radar (aggregate items by test_category)
        const byCat = new Map<string, { points: number; max: number }>();
        g.items.forEach((it) => {
          const cat = it.testCategory || "autre";
          const cur = byCat.get(cat) || { points: 0, max: 0 };
          cur.points += it.points;
          cur.max += it.maxPoints;
          byCat.set(cat, cur);
        });
        const qualitiesRadarData = Array.from(byCat.entries()).map(([cat, v]) => {
          const pctv = v.max > 0 ? Math.round((v.points / v.max) * 100) : 0;
          return {
            axis: formatCategoryLabel(cat),
            value: pctv,
            points: v.points,
            maxPoints: v.max,
            color: getLevelInfo(g.batteryName, pctv).color,
          };
        });

        const radarData = mode === "qualities" ? qualitiesRadarData : testsRadarData;
        const isOpen = !!openGroups[g.key];

        return (
          <Card key={g.key} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{g.playerName}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {g.batteryName} · {format(new Date(g.date), "dd/MM/yyyy", { locale: fr })}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold" style={{ color }}>
                    {totalPoints}/{totalMax}
                  </div>
                  <div className="text-xs font-medium" style={{ color }}>
                    {pct}% · {label}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData} outerRadius="75%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={({ payload, x, y, textAnchor }: any) => {
                      const item = radarData.find((d) => d.axis === payload.value);
                      return (
                        <text
                          x={x}
                          y={y}
                          textAnchor={textAnchor}
                          fill={item?.color || "hsl(var(--foreground))"}
                          fontSize={11}
                          fontWeight={600}
                        >
                          {payload.value}
                        </text>
                      );
                    }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name={g.playerName}
                    dataKey="value"
                    stroke={color}
                    fill={color}
                    fillOpacity={0.2}
                    strokeWidth={2}
                    dot={false}
                  />
                  <RTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(_v: any, _n: any, p: any) => {
                      const d = p?.payload;
                      return [`${d.points}/${d.maxPoints} pts (${d.value}%)`, d.axis];
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [g.key]: !prev[g.key] }))}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {isOpen ? "Masquer le détail" : "Voir le détail"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRadarMode((prev) => ({
                      ...prev,
                      [g.key]: (prev[g.key] || "tests") === "tests" ? "qualities" : "tests",
                    }))
                  }
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border bg-muted/40 hover:bg-muted text-foreground"
                >
                  {mode === "tests" ? "Voir par qualité physique" : "Voir par test"}
                </button>
              </div>

              {isOpen && (
                <div className="mt-3 space-y-1 border-t pt-3">
                  {g.items.map((it, idx) => {
                    const itemPct = it.maxPoints > 0 ? Math.round((it.points / it.maxPoints) * 100) : 0;
                    const itemColor = getLevelInfo(g.batteryName, itemPct).color;
                    const raw = g.raw[idx];
                    return (
                      <div key={it.id} className="flex items-center justify-between text-sm gap-2">
                        <span className="flex-1 truncate">{it.testName}</span>
                        <span className="text-muted-foreground text-xs">
                          {it.resultValue} {it.resultUnit}
                        </span>
                        <span className="font-semibold tabular-nums" style={{ color: itemColor }}>
                          {it.points}/{it.maxPoints}
                        </span>
                        {!isViewer && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onDelete(raw.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function GenericTestsSection({ categoryId, sportType, defaultCategory }: GenericTestsSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<{
    testCategory: string;
    testType: string;
    testCategoryLabel: string;
    testTypeLabel: string;
    testUnit: string;
  } | null>(null);
  const [isCreateTestDialogOpen, setIsCreateTestDialogOpen] = useState(false);
  const [isCreateCategoryDialogOpen, setIsCreateCategoryDialogOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<EditableTest | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const isRehabMode = defaultCategory === "rehab";
  const isSingleCategoryMode = !!defaultCategory && defaultCategory !== "rehab" && defaultCategory !== "all";
  const [filterCategory, setFilterCategory] = useState<string>(
    isRehabMode ? "all" : (defaultCategory || "all")
  );
  const [filterTestType, setFilterTestType] = useState<string>("all");
  const queryClient = useQueryClient();
  const { isViewer } = useViewerModeContext();

  // Favorite categories persisted in localStorage per category
  const favStorageKey = `tests-fav-categories:${categoryId}`;
  const [favoriteCategories, setFavoriteCategories] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(favStorageKey);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {}
    return new Set();
  });
  // Sync favorites from localStorage when the manager updates them
  useEffect(() => {
    const reload = () => {
      try {
        const raw = localStorage.getItem(favStorageKey);
        setFavoriteCategories(raw ? new Set(JSON.parse(raw) as string[]) : new Set());
      } catch {}
    };
    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.key === favStorageKey) reload();
    };
    window.addEventListener("tests-fav-categories-changed", handleCustom);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("tests-fav-categories-changed", handleCustom);
      window.removeEventListener("storage", reload);
    };
  }, [favStorageKey]);

  // Get filtered test categories based on sport type and mode
  const allSportCategories = getTestCategoriesForSport(sportType || "");

  // Fetch all tests to discover unique categories and types from DB
  const { data: allTestsForDiscovery } = useQuery({
    queryKey: ["generic_tests_discovery", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generic_tests")
        .select("test_category, test_type, result_unit")
        .eq("category_id", categoryId);
      if (error) throw error;
      return data;
    },
  });

  // Fetch custom tests defined in this category (so they show even without results yet)
  const { data: customTestsList } = useQuery({
    queryKey: ["custom_tests_list", categoryId, defaultCategory],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_test_categories")
        .select("custom_tests(id, name, test_category, unit, unit_kind, is_time, description, objectives, scoring_scale, max_points, image_url, video_url, formula_config, bilateral)")
        .eq("category_id", categoryId);
      if (error) throw error;
      const tests = (data || [])
        .map((row: any) => row.custom_tests)
        .filter(Boolean);
      if (defaultCategory && defaultCategory !== "all" && defaultCategory !== "rehab") {
        return tests.filter((t: any) => t.test_category === defaultCategory);
      }
      if (isRehabMode) return tests.filter((t: any) => t.test_category?.startsWith("rehab_"));
      return tests.filter((t: any) => !t.test_category?.startsWith("rehab_"));
    },
  });

  // Duplicate a custom test (creates a copy with " (copie)" suffix and opens it for editing)
  const duplicateTest = useMutation({
    mutationFn: async (test: any) => {
      const { data: catData, error: catErr } = await supabase
        .from("categories")
        .select("club_id")
        .eq("id", categoryId)
        .single();
      if (catErr) throw catErr;
      const { data: user } = await supabase.auth.getUser();
      const { data: newTest, error: insErr } = await supabase
        .from("custom_tests")
        .insert({
          club_id: (catData as any).club_id,
          name: `${test.name} (copie)`,
          test_category: test.test_category,
          unit: test.unit,
          unit_kind: test.unit_kind,
          is_time: test.is_time,
          description: test.description,
          objectives: test.objectives,
          scoring_scale: test.scoring_scale,
          max_points: test.max_points,
          formula_config: test.formula_config,
          image_url: test.image_url,
          video_url: test.video_url,
          bilateral: test.bilateral ?? false,
          created_by: user?.user?.id || null,
        } as any)
        .select("*")
        .single();
      if (insErr) throw insErr;
      const { error: linkErr } = await supabase
        .from("custom_test_categories")
        .insert({ custom_test_id: (newTest as any).id, category_id: categoryId });
      if (linkErr) throw linkErr;
      return newTest;
    },
    onSuccess: (newTest: any) => {
      toast.success("Test dupliqué — modifiez les caractéristiques");
      queryClient.invalidateQueries({ queryKey: ["custom_tests_list", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["custom-test-categories", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["custom-tests", categoryId] });
      setEditingTest({
        id: newTest.id,
        name: newTest.name,
        test_category: newTest.test_category,
        unit: newTest.unit,
        description: newTest.description,
        objectives: newTest.objectives,
        scoring_scale: newTest.scoring_scale ?? null,
        formula_config: newTest.formula_config ?? null,
        image_url: newTest.image_url ?? null,
        video_url: newTest.video_url ?? null,
        bilateral: (newTest as any).bilateral ?? false,
        source: "custom",
      });
      setIsEditDialogOpen(true);
    },
    onError: (e: any) => toast.error("Erreur duplication: " + e.message),
  });

  // Build categories depending on mode
  const filteredTestCategories = useMemo(() => {
    // Separate rehab and non-rehab categories
    const rehabCats = allSportCategories.filter(c => c.value.startsWith("rehab_"));
    const nonRehabCats = allSportCategories.filter(c => !c.value.startsWith("rehab_"));

    let categories: TestCategory[];
    
    if (isRehabMode) {
      // In rehab mode: show each rehab subcategory as a selectable category
      categories = [...rehabCats];
    } else {
      // In normal mode: show non-rehab categories only
      categories = [...nonRehabCats];
    }

    // Dynamically add categories discovered from DB
    const existingCategoryValues = new Set(categories.map(c => c.value));
    const existingTestsByCategory = new Map<string, Set<string>>();

    categories.forEach(cat => {
      existingTestsByCategory.set(cat.value, new Set(cat.tests.map(t => t.value)));
    });

    if (allTestsForDiscovery?.length) {
      allTestsForDiscovery.forEach(test => {
        const catValue = test.test_category;
        const testType = test.test_type;
        if (!catValue || !testType) return;

        // Only add if it matches current mode
        const isRehabCat = catValue.startsWith("rehab_");
        if (isRehabMode !== isRehabCat) return;

        if (!existingCategoryValues.has(catValue)) {
          const newCategory: TestCategory = {
            value: catValue,
            label: formatCategoryLabel(catValue),
            tests: [{ value: testType, label: formatTestTypeLabel(testType), unit: test.result_unit || "" }]
          };
          categories.push(newCategory);
          existingCategoryValues.add(catValue);
          existingTestsByCategory.set(catValue, new Set([testType]));
        } else {
          const existingTests = existingTestsByCategory.get(catValue);
          if (existingTests && !existingTests.has(testType)) {
            const category = categories.find(c => c.value === catValue);
            if (category) {
              category.tests.push({ value: testType, label: formatTestTypeLabel(testType), unit: test.result_unit || "" });
              existingTests.add(testType);
            }
          }
        }
      });
    }

    // Inject custom_tests definitions (so they appear in the filter dropdown
    // even before any result has been recorded)
    if (customTestsList?.length) {
      customTestsList.forEach((ct: any) => {
        const catValue = ct.test_category;
        if (!catValue) return;
        const isRehabCat = catValue.startsWith("rehab_");
        if (isRehabMode !== isRehabCat) return;

        // Use the custom test id as the test "value" so it's unique
        const testValue = `custom:${ct.id}`;
        const testLabel = ct.name;
        const testUnit = ct.unit || "";

        if (!existingCategoryValues.has(catValue)) {
          categories.push({
            value: catValue,
            label: formatCategoryLabel(catValue),
            tests: [{ value: testValue, label: testLabel, unit: testUnit }],
          });
          existingCategoryValues.add(catValue);
          existingTestsByCategory.set(catValue, new Set([testValue]));
        } else {
          const existingTests = existingTestsByCategory.get(catValue);
          if (existingTests && !existingTests.has(testValue)) {
            const category = categories.find(c => c.value === catValue);
            if (category) {
              category.tests.push({ value: testValue, label: testLabel, unit: testUnit });
              existingTests.add(testValue);
            }
          }
        }
      });
    }

    return categories;
  }, [allSportCategories, allTestsForDiscovery, customTestsList, isRehabMode]);

  const { data: tests, isLoading } = useQuery({
    queryKey: ["generic_tests", categoryId, filterCategory, filterTestType, isRehabMode],
    queryFn: async () => {
      let query = supabase
        .from("generic_tests")
        .select("*, players(name, first_name)")
        .eq("category_id", categoryId)
        .order("test_date", { ascending: false });

      if (isRehabMode) {
        query = query.ilike("test_category", "rehab_%");
      } else {
        query = query.or("test_category.not.ilike.rehab_%,test_category.is.null");
      }

      if (filterCategory === "__custom__") {
        // Show only results coming from coach's custom tests
        query = query.ilike("test_type", "custom:%");
      } else if (filterCategory !== "all") {
        query = query.eq("test_category", filterCategory);
      }
      if (filterTestType !== "all" && !filterTestType.startsWith("custom:")) {
        query = query.eq("test_type", filterTestType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const deleteTest = useMutation({
    mutationFn: async (testId: string) => {
      const { error } = await supabase.from("generic_tests").delete().eq("id", testId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generic_tests", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["generic_tests_discovery", categoryId] });
      toast.success("Test supprimé avec succès");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression du test");
    },
  });

  const selectedCategory = filteredTestCategories.find(c => c.value === filterCategory);

  const handleCategoryFilterChange = (value: string) => {
    setFilterCategory(value);
    setFilterTestType("all");
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  return (
    <Card className="bg-gradient-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          {isRehabMode 
            ? "Tests de Réathlétisation" 
            : isSingleCategoryMode 
              ? (filteredTestCategories.find(c => c.value === defaultCategory)?.label || formatCategoryLabel(defaultCategory || ""))
              : "Tous les Tests de Performance"
          }
        </CardTitle>
        {!isViewer && filterTestType !== "all" && selectedCategory && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsScheduleDialogOpen(true)}>
              <CalendarPlus className="h-4 w-4 mr-1" /> Planifier
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* Filtres */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filtrer:</span>
          </div>

          {/* Category dropdown - hidden in single category mode */}
          {!isSingleCategoryMode && (
            <Select value={filterCategory} onValueChange={handleCategoryFilterChange}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Toutes catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                <SelectItem value="__custom__">
                  <span className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                    Mes tests personnalisés
                  </span>
                </SelectItem>
                {(() => {
                  const favs = filteredTestCategories.filter(c => favoriteCategories.has(c.value));
                  const others = filteredTestCategories.filter(c => !favoriteCategories.has(c.value));
                  const ordered = [...favs, ...others];
                  return ordered.map((category) => {
                    const isFav = favoriteCategories.has(category.value);
                    return (
                      <SelectItem key={category.value} value={category.value}>
                        <span className="flex items-center gap-2">
                          {isFav && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />}
                          {category.label}
                        </span>
                      </SelectItem>
                    );
                  });
                })()}
              </SelectContent>
            </Select>
          )}

          {/* Test type dropdown - always visible when a category is selected */}
          {filterCategory !== "all" && selectedCategory && (
            <Select value={filterTestType} onValueChange={setFilterTestType}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Tous les tests" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les tests</SelectItem>
                {selectedCategory.tests.map((test) => (
                  <SelectItem key={test.value} value={test.value}>
                    {test.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Edit/customize the currently selected test */}
          {!isViewer && filterCategory !== "all" && filterTestType !== "all" && selectedCategory && (() => {
            const selectedTest = selectedCategory.tests.find(t => t.value === filterTestType);
            if (!selectedTest) return null;
            const isCustom = filterTestType.startsWith("custom:");
            const customId = isCustom ? filterTestType.replace("custom:", "") : undefined;
            const customDef = isCustom ? customTestsList?.find((t: any) => t.id === customId) : null;
            return (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (isCustom && customDef) {
                    setEditingTest({
                      id: customDef.id,
                      name: customDef.name,
                      test_category: customDef.test_category,
                      unit: customDef.unit,
                      description: customDef.description,
                      objectives: customDef.objectives,
                      scoring_scale: (customDef as any).scoring_scale ?? null,
                      formula_config: (customDef as any).formula_config ?? null,
                      image_url: (customDef as any).image_url ?? null,
                      video_url: (customDef as any).video_url ?? null,
                      bilateral: (customDef as any).bilateral ?? false,
                      source: "custom",
                    });
                  } else {
                    setEditingTest({
                      name: selectedTest.label,
                      test_category: filterCategory,
                      unit: selectedTest.unit || null,
                      source: "seed",
                      seedTestType: filterTestType,
                    });
                  }
                  setIsEditDialogOpen(true);
                }}
              >
                <Pencil className="h-4 w-4 mr-1" />
                {isCustom ? "Modifier le test" : "Personnaliser"}
              </Button>
            );
          })()}
        </div>

        {/* Tests disponibles dans cette catégorie (custom_tests définis) */}
        {(() => {
          const visibleCustomTests = (customTestsList || []).filter((t: any) => {
            if (filterCategory === "all") return true;
            if (filterCategory === "__custom__") return true;
            return t.test_category === filterCategory;
          });
          if (!visibleCustomTests.length) return null;
          return (
          <div className="mb-4 rounded-2xl border bg-muted/30 p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Tests disponibles dans cette catégorie ({visibleCustomTests.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleCustomTests.map((t: any) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (isViewer) return;
                    setEditingTest({
                      id: t.id,
                      name: t.name,
                      test_category: t.test_category,
                      unit: t.unit,
                      description: t.description,
                      objectives: t.objectives,
                      scoring_scale: t.scoring_scale ?? null,
                      formula_config: t.formula_config ?? null,
                      image_url: t.image_url ?? null,
                      video_url: t.video_url ?? null,
                      bilateral: (t as any).bilateral ?? false,
                      source: "custom",
                    });
                    setIsEditDialogOpen(true);
                  }}
                  className={`group inline-flex items-center gap-2 rounded-2xl bg-background border hover:border-primary hover:bg-accent transition-colors text-sm ${t.image_url ? "p-1.5 pr-3" : "px-2.5 py-1 text-xs"}`}
                  title={isViewer ? (t.description || "") : "Cliquer pour modifier ce test"}
                >
                  {t.image_url && (
                    <img
                      src={t.image_url}
                      alt=""
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(t.image_url);
                      }}
                      className="h-16 w-16 rounded-xl object-cover border hover:opacity-90 hover:scale-105 transition-transform cursor-zoom-in"
                    />
                  )}
                  <span className="font-medium">{t.name}</span>
                  {t.unit && <span className="text-muted-foreground">({t.unit})</span>}
                  {!isViewer && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />}
                  {!isViewer && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setScheduleTarget({
                          testCategory: t.test_category,
                          testType: `custom:${t.id}`,
                          testCategoryLabel: formatCategoryLabel(t.test_category),
                          testTypeLabel: t.name,
                          testUnit: t.unit || "",
                        });
                        setIsScheduleDialogOpen(true);
                      }}
                      className="ml-1 inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 px-2 py-0.5 text-[11px] text-primary"
                      title="Planifier ce test dans le calendrier"
                    >
                      <CalendarPlus className="h-3 w-3" /> Planifier
                    </span>
                  )}
                  {!isViewer && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateTest.mutate(t);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-muted-foreground/30 bg-muted hover:bg-muted/70 px-2 py-0.5 text-[11px] text-foreground"
                      title="Dupliquer ce test"
                    >
                      <Copy className="h-3 w-3" /> Dupliquer
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          );
        })()}

        {!tests || tests.length === 0 ? (
          <div className="text-center py-12">
            {!isViewer ? (
              <Button onClick={() => setIsDialogOpen(true)} size="lg" className="gap-2 px-8 py-6 text-base">
                <ClipboardList className="h-5 w-5" />
                Saisir des résultats
              </Button>
            ) : (
              <p className="text-muted-foreground">Aucun test enregistré</p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <BatteryRadarCharts
              tests={tests}
              isViewer={isViewer}
              categoryId={categoryId}
              onDelete={(id) => {
                if (confirm("Êtes-vous sûr de vouloir supprimer ce test ?")) {
                  deleteTest.mutate(id);
                }
              }}
            />

            {(() => {
              const singles = (tests || []).filter((t: any) => !/^\[Batterie:/i.test(t.notes || ""));
              if (singles.length === 0) return null;
              return (
                <div className="overflow-x-auto">
                  <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Tests isolés</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Joueur</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Test</TableHead>
                        <TableHead>Résultat</TableHead>
                        <TableHead>Notes</TableHead>
                        {!isViewer && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {singles.map((test: any) => (
                        <TableRow key={test.id} className="animate-fade-in">
                          <TableCell className="font-medium">{test.players?.name}</TableCell>
                          <TableCell>{format(new Date(test.test_date), "dd/MM/yyyy", { locale: fr })}</TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground block">
                              {filteredTestCategories.find(c => c.value === test.test_category)?.label || formatCategoryLabel(test.test_category)}
                            </span>
                            {filteredTestCategories.find(c => c.value === test.test_category)?.tests.find(t => t.value === test.test_type)?.label || formatTestTypeLabel(test.test_type)}
                          </TableCell>
                          <TableCell className="font-semibold text-primary">
                            {test.result_value} {test.result_unit}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-muted-foreground text-sm">
                            {test.notes || "-"}
                          </TableCell>
                          {!isViewer && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => {
                                if (confirm("Êtes-vous sûr de vouloir supprimer ce test ?")) {
                                  deleteTest.mutate(test.id);
                                }
                              }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>

      <UnifiedTestDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        categoryId={categoryId}
        sportType={sportType}
        defaultFilterCategory={filterCategory !== "all" ? filterCategory : undefined}
        defaultFilterTestType={filterTestType !== "all" ? filterTestType : undefined}
        allowCustomTest={!defaultCategory || defaultCategory === "all"}
      />

      {(() => {
        let target = scheduleTarget;
        if (!target && filterTestType !== "all" && selectedCategory) {
          const cat = filteredTestCategories.find(c => c.value === filterCategory);
          const test = cat?.tests.find(t => t.value === filterTestType);
          if (cat && test) {
            target = {
              testCategory: cat.value,
              testType: test.value,
              testCategoryLabel: cat.label,
              testTypeLabel: test.label,
              testUnit: test.unit || "",
            };
          }
        }
        if (!target) return null;
        return (
          <ScheduleTestDialog
            open={isScheduleDialogOpen}
            onOpenChange={(o) => {
              setIsScheduleDialogOpen(o);
              if (!o) setScheduleTarget(null);
            }}
            categoryId={categoryId}
            testCategoryLabel={target.testCategoryLabel}
            testTypeLabel={target.testTypeLabel}
            testCategory={target.testCategory}
            testType={target.testType}
            testUnit={target.testUnit}
          />
        );
      })()}

      <CreateCustomTestDialog
        open={isCreateTestDialogOpen}
        onOpenChange={setIsCreateTestDialogOpen}
        categoryId={categoryId}
        sportType={sportType}
      />

      <CreateThemeCategoryDialog
        open={isCreateCategoryDialogOpen}
        onOpenChange={setIsCreateCategoryDialogOpen}
        categoryId={categoryId}
      />

      <EditCustomTestDialog
        open={isEditDialogOpen}
        onOpenChange={(o) => {
          setIsEditDialogOpen(o);
          if (!o) setEditingTest(null);
        }}
        categoryId={categoryId}
        sportType={sportType}
        test={editingTest}
      />

      <Dialog open={!!previewImage} onOpenChange={(o) => !o && setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-2 bg-background/95 backdrop-blur">
          {previewImage && (
            <img
              src={previewImage}
              alt="Aperçu"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Helper functions to format labels
function formatCategoryLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatTestTypeLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}