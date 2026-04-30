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
import { Plus, Trash2, Filter, ClipboardList, CalendarPlus, FolderPlus, Pencil, Star } from "lucide-react";
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

export function GenericTestsSection({ categoryId, sportType, defaultCategory }: GenericTestsSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isCreateTestDialogOpen, setIsCreateTestDialogOpen] = useState(false);
  const [isCreateCategoryDialogOpen, setIsCreateCategoryDialogOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<EditableTest | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
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
  useEffect(() => {
    try {
      localStorage.setItem(favStorageKey, JSON.stringify(Array.from(favoriteCategories)));
    } catch {}
  }, [favoriteCategories, favStorageKey]);
  const toggleFavoriteCategory = (value: string) => {
    setFavoriteCategories((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

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
        .select("custom_tests(id, name, test_category, unit, unit_kind, is_time, description, objectives, scoring_scale, max_points)")
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
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .order("test_date", { ascending: false });

      if (isRehabMode) {
        query = query.ilike("test_category", "rehab_%");
      } else {
        query = query.or("test_category.not.ilike.rehab_%,test_category.is.null");
      }

      if (filterCategory !== "all") {
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
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Toutes catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {filteredTestCategories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
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
                <SelectGroup>
                  <SelectLabel>{selectedCategory.label}</SelectLabel>
                  {selectedCategory.tests.map((test) => (
                    <SelectItem key={test.value} value={test.value}>
                      {test.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
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
        {customTestsList && customTestsList.length > 0 && (
          <div className="mb-4 rounded-2xl border bg-muted/30 p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Tests disponibles dans cette catégorie ({customTestsList.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {customTestsList.map((t: any) => (
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
                      source: "custom",
                    });
                    setIsEditDialogOpen(true);
                  }}
                  className="group inline-flex items-center gap-1.5 rounded-full bg-background border px-2.5 py-1 text-xs hover:border-primary hover:bg-accent transition-colors"
                  title={isViewer ? (t.description || "") : "Cliquer pour modifier ce test"}
                >
                  <span className="font-medium">{t.name}</span>
                  {t.unit && <span className="text-muted-foreground">({t.unit})</span>}
                  {!isViewer && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />}
                </button>
              ))}
            </div>
          </div>
        )}

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
          <div className="overflow-x-auto">
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
                {tests.map((test: any) => (
                  <TableRow key={test.id} className="animate-fade-in">
                    <TableCell className="font-medium">{test.players?.name}</TableCell>
                    <TableCell>
                      {format(new Date(test.test_date), "dd/MM/yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground block">
                        {filteredTestCategories.find(c => c.value === test.test_category)?.label || formatCategoryLabel(test.test_category)}
                      </span>
                      {filteredTestCategories
                        .find(c => c.value === test.test_category)
                        ?.tests.find(t => t.value === test.test_type)?.label || formatTestTypeLabel(test.test_type)}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {test.result_value} {test.result_unit}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground text-sm">
                      {test.notes || "-"}
                    </TableCell>
                    {!isViewer && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Êtes-vous sûr de vouloir supprimer ce test ?")) {
                              deleteTest.mutate(test.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

      {filterTestType !== "all" && selectedCategory && (() => {
        const cat = filteredTestCategories.find(c => c.value === filterCategory);
        const test = cat?.tests.find(t => t.value === filterTestType);
        if (!cat || !test) return null;
        return (
          <ScheduleTestDialog
            open={isScheduleDialogOpen}
            onOpenChange={setIsScheduleDialogOpen}
            categoryId={categoryId}
            testCategoryLabel={cat.label}
            testTypeLabel={test.label}
            testCategory={cat.value}
            testType={test.value}
            testUnit={test.unit || ""}
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