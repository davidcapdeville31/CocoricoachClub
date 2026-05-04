import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { GenericTestsSection } from "./tests/GenericTestsSection";
import { getTestCategoriesForSport } from "@/lib/constants/testCategories";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ColoredNavTabsList } from "@/components/ui/colored-nav-tabs";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { TestBatteriesManager } from "./tests/TestBatteriesManager";
import { formatCategoryLabel } from "./tests/customTestCatalog";
import { CategoryVisibilityManager } from "./tests/CategoryVisibilityManager";
import { Button } from "@/components/ui/button";
import { FolderPlus, Plus, ClipboardList, CalendarPlus } from "lucide-react";
import { CreateCustomTestDialog } from "./tests/CreateCustomTestDialog";
import { CreateThemeCategoryDialog } from "./tests/CreateThemeCategoryDialog";
import { useViewerModeContext } from "@/contexts/ViewerModeContext";
import { PlanTestsSection } from "./tests/PlanTestsSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

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

function TestCategoryTrigger({
  value,
  label,
  colorIndex,
  customColor,
  editable = false,
  onRename,
  onClickOverride,
}: {
  value: string;
  label: string;
  colorIndex: number;
  customColor?: string | null;
  editable?: boolean;
  onRename?: (newLabel: string) => Promise<void> | void;
  onClickOverride?: () => void;
}) {
  const color = customColor || TEST_TAB_COLORS[colorIndex % TEST_TAB_COLORS.length];
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(label);
  }, [label, isEditing]);

  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing]);

  const commit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === label || !onRename) {
      setIsEditing(false);
      setDraft(label);
      return;
    }
    setSaving(true);
    try {
      await onRename(trimmed);
      setIsEditing(false);
    } catch {
      setDraft(label);
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <span
        className="inline-flex items-center px-2.5 py-1 rounded-md border-[1.5px]"
        style={{ borderColor: color }}
      >
        <input
          ref={inputRef}
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setIsEditing(false);
              setDraft(label);
            }
          }}
          className="bg-transparent outline-none text-xs font-medium min-w-[60px] max-w-[180px]"
          style={{ color }}
        />
      </span>
    );
  }

  return (
    <TabsPrimitive.Trigger
      value={value}
      onDoubleClick={editable ? () => setIsEditing(true) : undefined}
      onClick={onClickOverride ? (e) => { e.preventDefault(); onClickOverride(); } : undefined}
      title={editable ? "Double-cliquez pour renommer" : undefined}
      className={cn(
        "group relative inline-flex items-center px-2.5 py-1 rounded-md font-medium text-xs",
        "transition-all duration-200 ease-out whitespace-nowrap cursor-pointer",
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
        .select("id, value, label, color")
        .eq("category_id", categoryId);
      if (error) throw error;
      return (data || []) as unknown as Array<{ id: string; value: string; label: string; color: string | null }>;
    },
  });

  const themeColorMap = useMemo(() => {
    const m = new Map<string, string>();
    (themeCategories || []).forEach((tc) => {
      if (tc.color) m.set(tc.value, tc.color);
    });
    return m;
  }, [themeCategories]);

  // Map value -> id (only existing rows in test_theme_categories) and value -> overridden label
  const themeIdMap = useMemo(() => {
    const m = new Map<string, string>();
    (themeCategories || []).forEach((tc) => m.set(tc.value, tc.id));
    return m;
  }, [themeCategories]);

  const themeLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    (themeCategories || []).forEach((tc) => {
      if (tc.label) m.set(tc.value, tc.label);
    });
    return m;
  }, [themeCategories]);

  // Fetch club_id once for renames/inserts
  const { data: clubData } = useQuery({
    queryKey: ["category-club", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("club_id")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const queryClient = useQueryClient();

  const handleRenameCategory = async (value: string, newLabel: string) => {
    try {
      const existingId = themeIdMap.get(value);
      if (existingId) {
        const { error } = await supabase
          .from("test_theme_categories" as any)
          .update({ label: newLabel })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        if (!clubData?.club_id) {
          toast.error("Club introuvable");
          throw new Error("club_id missing");
        }
        const { error } = await supabase
          .from("test_theme_categories" as any)
          .insert({
            category_id: categoryId,
            club_id: clubData.club_id,
            value,
            label: newLabel,
          });
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["test-theme-categories", categoryId] });
      toast.success("Titre mis à jour");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du renommage");
      throw e;
    }
  };

  const testCategories = useMemo(() => {
    const all = getTestCategoriesForSport(sportType || "");
    // Apply label overrides from test_theme_categories on default sport categories
    const nonRehab = all
      .filter(c => !c.value.startsWith("rehab_"))
      .map(c => ({ ...c, label: themeLabelMap.get(c.value) || c.label }));
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
  }, [sportType, customCategoryValues, themeCategories, themeLabelMap]);

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

  // Favorites persisted with the same key used by GenericTestsSection so they stay in sync
  const favStorageKey = `tests-fav-categories:${categoryId}`;
  const [favoriteValues, setFavoriteValues] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(favStorageKey);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {}
    return new Set();
  });
  useEffect(() => {
    try {
      localStorage.setItem(favStorageKey, JSON.stringify(Array.from(favoriteValues)));
    } catch {}
    // Notify other components in the same tab (storage event only fires across tabs)
    window.dispatchEvent(new CustomEvent("tests-fav-categories-changed", { detail: { key: favStorageKey } }));
  }, [favoriteValues, favStorageKey]);

  const visibilityItems = useMemo(() => {
    const items = testCategories.nonRehab.map(c => ({ value: c.value, label: c.label }));
    if (testCategories.hasRehab) items.push({ value: "rehab", label: "Réathlétisation" });
    return items;
  }, [testCategories]);

  const filteredNonRehab = testCategories.nonRehab.filter(c => visibleValues.has(c.value));
  const showRehab = testCategories.hasRehab && visibleValues.has("rehab");

  const { isViewer } = useViewerModeContext();
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isCreateTestOpen, setIsCreateTestOpen] = useState(false);
  const [isCreateBatteryOpen, setIsCreateBatteryOpen] = useState(false);
  const [isPlanTestOpen, setIsPlanTestOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle>Tests de Performance</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {!isViewer && (
            <>
              <Button size="sm" variant="outline" onClick={() => setIsCreateCategoryOpen(true)}>
                <FolderPlus className="h-4 w-4 mr-1" /> Créer / Modifier une catégorie
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsCreateTestOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Créer un test
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPlanTestOpen(true)}
                className="border-primary/40 text-primary hover:bg-primary/10"
              >
                <CalendarPlus className="h-4 w-4 mr-1" /> Planifier un test
              </Button>
              <Button
                size="sm"
                onClick={() => setIsCreateBatteryOpen(true)}
                className="bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white hover:opacity-90 border-0"
              >
                <ClipboardList className="h-4 w-4 mr-1" /> Créer une batterie de tests
              </Button>
            </>
          )}
          <CategoryVisibilityManager
            items={visibilityItems}
            visibleValues={visibleValues}
            onChange={setVisibleValues}
            favoriteValues={favoriteValues}
            onFavoritesChange={setFavoriteValues}
          />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v)}
          className="space-y-4"
        >
          <ScrollArea className="w-full">
            <ColoredNavTabsList className="flex flex-wrap w-full gap-1 p-1.5">
              <TestCategoryTrigger
                value="all"
                label={activeTab === "all" ? "Aucun" : "Tous"}
                colorIndex={0}
                onClickOverride={() => {
                  setActiveTab(activeTab === "all" ? "none" : "all");
                }}
              />
              {filteredNonRehab.map((cat, i) => (
                <TestCategoryTrigger
                  key={cat.value}
                  value={cat.value}
                  label={cat.label}
                  colorIndex={i + 1}
                  customColor={themeColorMap.get(cat.value)}
                  editable={!isViewer}
                  onRename={(newLabel) => handleRenameCategory(cat.value, newLabel)}
                />
              ))}
              {showRehab && (
                <TestCategoryTrigger
                  value="rehab"
                  label="Réathlétisation"
                  colorIndex={filteredNonRehab.length + 1}
                />
              )}
            </ColoredNavTabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value="all" className="space-y-6">
            <GenericTestsSection categoryId={categoryId} sportType={sportType} />
          </TabsContent>

          <TabsContent value="none" className="space-y-6">
            <GenericTestsSection categoryId={categoryId} sportType={sportType} hideTestCatalog />
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

        </Tabs>

        <div className="mt-8">
          <TestBatteriesManager
            categoryId={categoryId}
            externalCreateOpen={isCreateBatteryOpen}
            onExternalCreateOpenChange={setIsCreateBatteryOpen}
            hideCreateButton
          />
        </div>

        {/* PlanTestsSection inline retiré — disponible via le bouton "Planifier un test" en haut */}
      </CardContent>

      <CreateThemeCategoryDialog
        open={isCreateCategoryOpen}
        onOpenChange={setIsCreateCategoryOpen}
        categoryId={categoryId}
      />
      <CreateCustomTestDialog
        open={isCreateTestOpen}
        onOpenChange={setIsCreateTestOpen}
        categoryId={categoryId}
        sportType={sportType}
      />

      <Dialog open={isPlanTestOpen} onOpenChange={setIsPlanTestOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" />
              Planifier un test
            </DialogTitle>
          </DialogHeader>
          <PlanTestsSection categoryId={categoryId} sportType={sportType} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
