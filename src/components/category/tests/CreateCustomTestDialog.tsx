import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getTestCategoriesForSport } from "@/lib/constants/testCategories";
import { formatCategoryLabel, normalizeCustomTestType } from "./customTestCatalog";
import { TEST_UNIT_OPTIONS, getUnitByKind, type ScoringScale } from "@/lib/constants/testUnits";
import { ScoringScaleEditor } from "./ScoringScaleEditor";

interface CreateCustomTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  sportType?: string;
}

export function CreateCustomTestDialog({ open, onOpenChange, categoryId, sportType }: CreateCustomTestDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [categoryMode, setCategoryMode] = useState<"existing" | "new">("existing");
  const [testCategory, setTestCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [unitKind, setUnitKind] = useState<string>("");
  const [customUnit, setCustomUnit] = useState("");
  const [description, setDescription] = useState("");
  const [enableScoring, setEnableScoring] = useState(false);
  const [scoringScale, setScoringScale] = useState<ScoringScale | null>(null);

  const baseTestCategories = useMemo(() => {
    return getTestCategoriesForSport(sportType || "").filter(c => !c.value.startsWith("rehab_"));
  }, [sportType]);

  const { data: existingCustomCategories } = useQuery({
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
            .filter((value): value is string => Boolean(value))
        )
      );
    },
    enabled: open,
  });

  const testCategories = useMemo(() => {
    const categoryMap = new Map(baseTestCategories.map((category) => [category.value, category.label]));

    (existingCustomCategories || []).forEach((categoryValue) => {
      if (!categoryMap.has(categoryValue)) {
        categoryMap.set(categoryValue, formatCategoryLabel(categoryValue));
      }
    });

    return Array.from(categoryMap.entries()).map(([value, label]) => ({ value, label }));
  }, [baseTestCategories, existingCustomCategories]);

  const groupedUnits = useMemo(() => {
    const groups = new Map<string, typeof TEST_UNIT_OPTIONS>();
    TEST_UNIT_OPTIONS.forEach(opt => {
      const arr = groups.get(opt.group) ?? [];
      arr.push(opt);
      groups.set(opt.group, arr);
    });
    return Array.from(groups.entries());
  }, []);

  const selectedUnit = getUnitByKind(unitKind);
  const effectiveUnit = unitKind === "custom" ? customUnit : (selectedUnit?.unit ?? "");
  const isTime = Boolean(selectedUnit?.isTime);

  const { data: categoryData } = useQuery({
    queryKey: ["category-club-id", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("club_id").eq("id", categoryId).single();
      if (error) throw error;
      return data;
    },
  });

  const createTest = useMutation({
    mutationFn: async () => {
      if (!categoryData?.club_id) throw new Error("Club introuvable");
      const trimmedName = name.trim();
      const trimmedDescription = description.trim();
      const finalCategory = categoryMode === "new" ? normalizeCustomTestType(newCategoryName) : testCategory;

      if (!trimmedName) throw new Error("Le nom du test est requis");
      if (!finalCategory) throw new Error("La catégorie du test est requise");
      if (!unitKind) throw new Error("Choisissez une unité de mesure");
      if (unitKind === "custom" && !customUnit.trim()) throw new Error("Saisissez l'unité personnalisée");

      if (categoryMode === "new") {
        const existingCategoryValues = new Set(testCategories.map((category) => category.value));
        if (existingCategoryValues.has(finalCategory)) {
          throw new Error("Cette catégorie existe déjà. Sélectionnez-la dans la liste.");
        }
      }

      const maxPoints = enableScoring && scoringScale
        ? scoringScale.ranges.reduce((m, r) => Math.max(m, r.points), 0)
        : null;

      const { data: user } = await supabase.auth.getUser();

      const { data: customTest, error: testError } = await supabase
        .from("custom_tests")
        .insert({
          club_id: categoryData.club_id,
          name: trimmedName,
          test_category: finalCategory,
          unit: effectiveUnit || null,
          unit_kind: unitKind,
          is_time: isTime,
          description: trimmedDescription || null,
          scoring_scale: enableScoring ? (scoringScale as any) : null,
          max_points: maxPoints,
          created_by: user?.user?.id || null,
        } as any)
        .select("id")
        .single();

      if (testError) throw testError;

      const { error: linkError } = await supabase
        .from("custom_test_categories")
        .insert({ custom_test_id: customTest.id, category_id: categoryId });

      if (linkError) throw linkError;
    },
    onSuccess: () => {
      toast.success("Test personnalisé créé avec succès");
      queryClient.invalidateQueries({ queryKey: ["custom-test-categories", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["custom-tests", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["generic_tests_discovery", categoryId] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la création: " + error.message);
    },
  });

  const resetForm = () => {
    setName("");
    setCategoryMode("existing");
    setTestCategory("");
    setNewCategoryName("");
    setUnitKind("");
    setCustomUnit("");
    setDescription("");
    setEnableScoring(false);
    setScoringScale(null);
  };

  const handleSubmit = () => {
    if (createTest.isPending) return;
    if (!name.trim()) return toast.error("Le nom du test est requis");
    if (categoryMode === "existing" && !testCategory) return toast.error("Choisissez une catégorie de test");
    if (categoryMode === "new" && !newCategoryName.trim()) return toast.error("Saisissez le nom de la nouvelle catégorie");
    if (!unitKind) return toast.error("Choisissez une unité de mesure");
    if (unitKind === "custom" && !customUnit.trim()) return toast.error("Saisissez l'unité personnalisée");
    createTest.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un test personnalisé</DialogTitle>
          <DialogDescription>
            Configurez l'unité de mesure et un barème de notation optionnel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={categoryMode === "existing" ? "default" : "outline"}
                onClick={() => { setCategoryMode("existing"); setNewCategoryName(""); }}>
                Catégorie existante
              </Button>
              <Button type="button" size="sm" variant={categoryMode === "new" ? "default" : "outline"}
                onClick={() => { setCategoryMode("new"); setTestCategory(""); }}>
                Nouvelle catégorie
              </Button>
            </div>

            {categoryMode === "existing" ? (
              <Select value={testCategory} onValueChange={setTestCategory}>
                <SelectTrigger><SelectValue placeholder="Choisir une catégorie..." /></SelectTrigger>
                <SelectContent>
                  {testCategories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                placeholder="Ex: Coordination spécifique bowling" />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Nom du test</Label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Équilibre unipodal yeux fermés" />
          </div>

          <div className="space-y-1.5">
            <Label>Unité de mesure</Label>
            <Select value={unitKind} onValueChange={setUnitKind}>
              <SelectTrigger><SelectValue placeholder="Choisir une unité..." /></SelectTrigger>
              <SelectContent>
                {groupedUnits.map(([group, opts]) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {opts.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {unitKind === "custom" && (
              <Input value={customUnit} onChange={e => setCustomUnit(e.target.value)}
                placeholder="Ex: niveau, étoiles..." className="mt-2" />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Description (optionnel)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Description du test..." />
          </div>

          <div className="flex items-center justify-between rounded-2xl border bg-muted/40 p-4">
            <div>
              <Label className="text-sm font-semibold cursor-pointer">Activer un barème de notation</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Convertit automatiquement les résultats en points selon vos plages.
              </p>
            </div>
            <Switch checked={enableScoring} onCheckedChange={setEnableScoring} />
          </div>

          {enableScoring && (
            <ScoringScaleEditor
              value={scoringScale}
              onChange={setScoringScale}
              unit={effectiveUnit}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit}>
            {createTest.isPending ? "Création..." : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
