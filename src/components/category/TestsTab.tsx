import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { GenericTestsSection } from "./tests/GenericTestsSection";
import { getTestCategoriesForSport } from "@/lib/constants/testCategories";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ColoredNavTabsList } from "@/components/ui/colored-nav-tabs";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { BenchmarkManager } from "./benchmarks/BenchmarkManager";
import { BenchmarkComparison } from "./benchmarks/BenchmarkComparison";
import { TestBatteriesManager } from "./tests/TestBatteriesManager";
import { formatCategoryLabel } from "./tests/customTestCatalog";
import { CategoryVisibilityManager } from "./tests/CategoryVisibilityManager";

interface TestsTabProps {
  categoryId: string;
  sportType?: string;
}

// Color palette for test categories
const TEST_TAB_COLORS = [
  "hsl(220 80% 55%)",   // blue
  "hsl(320 75% 55%)",   // magenta
  "hsl(35 90% 55%)",    // orange
  "hsl(160 65% 45%)",   // green
  "hsl(280 70% 55%)",   // purple
  "hsl(200 85% 50%)",   // cyan
  "hsl(350 80% 60%)",   // red
  "hsl(45 95% 50%)",    // yellow
  "hsl(190 80% 45%)",   // teal
  "hsl(260 70% 60%)",   // indigo
  "hsl(140 60% 45%)",   // emerald
  "hsl(10 80% 55%)",    // coral
] as const;

function TestCategoryTrigger({ value, label, colorIndex }: { value: string; label: string; colorIndex: number }) {
  const color = TEST_TAB_COLORS[colorIndex % TEST_TAB_COLORS.length];

  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "group relative inline-flex items-center px-2.5 py-1 rounded-md font-medium text-xs",
        "transition-all duration-200 ease-out whitespace-nowrap",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "hover:opacity-80",
        "data-[state=active]:shadow-sm data-[state=active]:scale-105",
      )}
      style={{
        borderWidth: "1.5px",
        borderColor: color,
        borderStyle: "solid",
      }}
    >
      {/* Active fill background */}
      <span
        className={cn(
          "absolute inset-0 rounded-md transition-all duration-200",
          "opacity-0 scale-95",
          "group-data-[state=active]:opacity-100 group-data-[state=active]:scale-100"
        )}
        style={{ backgroundColor: color }}
      />
      {/* Colored text by default, white text when active (dual-span trick to avoid inline style override) */}
      <span className="relative z-10">
        <span className="group-data-[state=active]:hidden" style={{ color }}>{label}</span>
        <span className="hidden group-data-[state=active]:inline text-white">{label}</span>
      </span>
    </TabsPrimitive.Trigger>
  );
}

export function TestsTab({ categoryId, sportType }: TestsTabProps) {
  const { data: customCategoryValues } = useQuery({
    queryKey: ["custom-test-categories", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_test_categories")
        .select("custom_tests(test_category)")
        .eq("category_id", categoryId);
      if (error) throw error;
      return Array.from(
        new Set(
          (data || [])
            .map((row: any) => row.custom_tests?.test_category)
            .filter((v): v is string => Boolean(v))
        )
      );
    },
  });

  const { data: themeCategories } = useQuery({
    queryKey: ["test-theme-categories", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_theme_categories" as any)
        .select("value, label")
        .eq("category_id", categoryId);
      if (error) throw error;
      return (data || []) as unknown as Array<{ value: string; label: string }>;
    },
  });

  const testCategories = useMemo(() => {
    const all = getTestCategoriesForSport(sportType || "");
    const nonRehab = all.filter(c => !c.value.startsWith("rehab_"));
    const hasRehab = all.some(c => c.value.startsWith("rehab_"));

    const existingValues = new Set(nonRehab.map(c => c.value));
    const extras: Array<{ value: string; label: string; tests: any[] }> = [];

    (themeCategories || []).forEach((tc) => {
      if (!existingValues.has(tc.value) && !tc.value.startsWith("rehab_")) {
        extras.push({ value: tc.value, label: tc.label, tests: [] });
        existingValues.add(tc.value);
      }
    });

    (customCategoryValues || []).forEach((v) => {
      if (!existingValues.has(v) && !v.startsWith("rehab_")) {
        extras.push({ value: v, label: formatCategoryLabel(v), tests: [] });
        existingValues.add(v);
      }
    });

    return { nonRehab: [...nonRehab, ...extras], hasRehab };
  }, [sportType, customCategoryValues, themeCategories]);

  // Visibility persisted in localStorage per category
  const storageKey = `tests-visible-categories:${categoryId}`;
  const [visibleValues, setVisibleValues] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {}
    return new Set(); // empty = "first time" -> default to all visible (computed below)
  });
  const [initialized, setInitialized] = useState(false);

  // Initialize defaults on first load: show all by default
  useEffect(() => {
    if (initialized) return;
    const stored = localStorage.getItem(storageKey);
    if (stored === null) {
      const all = new Set<string>(testCategories.nonRehab.map(c => c.value));
      if (testCategories.hasRehab) all.add("rehab");
      setVisibleValues(all);
    }
    setInitialized(true);
  }, [initialized, storageKey, testCategories]);

  useEffect(() => {
    if (!initialized) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(visibleValues)));
    } catch {}
  }, [visibleValues, storageKey, initialized]);

  const visibilityItems = useMemo(() => {
    const items = testCategories.nonRehab.map(c => ({ value: c.value, label: c.label }));
    if (testCategories.hasRehab) items.push({ value: "rehab", label: "Réathlétisation" });
    return items;
  }, [testCategories]);

  const filteredNonRehab = testCategories.nonRehab.filter(c => visibleValues.has(c.value));
  const showRehab = testCategories.hasRehab && visibleValues.has("rehab");

  const benchmarkColorIndex = filteredNonRehab.length + (showRehab ? 2 : 1);

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle>Tests de Performance</CardTitle>
        <CategoryVisibilityManager
          items={visibilityItems}
          visibleValues={visibleValues}
          onChange={setVisibleValues}
        />
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="space-y-4">
          <ScrollArea className="w-full">
            <ColoredNavTabsList className="flex flex-wrap w-full gap-1 p-1.5">
              <TestCategoryTrigger value="all" label="Tous" colorIndex={0} />
              {filteredNonRehab.map((cat, i) => (
                <TestCategoryTrigger
                  key={cat.value}
                  value={cat.value}
                  label={cat.label}
                  colorIndex={i + 1}
                />
              ))}
              {showRehab && (
                <TestCategoryTrigger
                  value="rehab"
                  label="Réathlétisation"
                  colorIndex={filteredNonRehab.length + 1}
                />
              )}
              <TestCategoryTrigger
                value="benchmarks"
                label="📊 Benchmarks"
                colorIndex={benchmarkColorIndex}
              />
              <TestCategoryTrigger
                value="batteries"
                label="🎯 Batteries"
                colorIndex={benchmarkColorIndex + 1}
              />
            </ColoredNavTabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value="all" className="space-y-6">
            <GenericTestsSection categoryId={categoryId} sportType={sportType} />
          </TabsContent>

          {testCategories.nonRehab.map((cat) => (
            <TabsContent key={cat.value} value={cat.value} className="space-y-6">
              <GenericTestsSection
                categoryId={categoryId}
                sportType={sportType}
                defaultCategory={cat.value}
              />
            </TabsContent>
          ))}

          {testCategories.hasRehab && (
            <TabsContent value="rehab" className="space-y-6">
              <GenericTestsSection
                categoryId={categoryId}
                sportType={sportType}
                defaultCategory="rehab"
              />
            </TabsContent>
          )}

          <TabsContent value="benchmarks" className="space-y-6">
            <BenchmarkManager categoryId={categoryId} sportType={sportType} />
            <BenchmarkComparison categoryId={categoryId} sportType={sportType} />
          </TabsContent>

          <TabsContent value="batteries" className="space-y-6">
            <TestBatteriesManager categoryId={categoryId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
