import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getTestCategoriesForSport } from "@/lib/constants/testCategories";
import { formatCategoryLabel } from "./customTestCatalog";
import { TEST_UNIT_OPTIONS, getUnitByKind, type ScoringScale } from "@/lib/constants/testUnits";
import { ScoringScaleEditor } from "./ScoringScaleEditor";
import { FormulaConfigEditor } from "./FormulaConfigEditor";
import type { FormulaConfig } from "@/lib/tests/formulaEngine";
import { Trash2, Upload, X, ImageIcon, Loader2 } from "lucide-react";

export interface EditableTest {
  id?: string;                 // custom_tests.id (undefined si seed catalogue)
  name: string;
  test_category: string;
  unit: string | null;
  unit_kind?: string | null;
  is_time?: boolean | null;
  description?: string | null;
  objectives?: string | null;
  scoring_scale?: ScoringScale | null;
  formula_config?: FormulaConfig | null;
  image_url?: string | null;
  source: "custom" | "seed";   // seed = test pré-existant du catalogue
  seedTestType?: string;       // test_type d'origine si seed (pour réf)
}

interface EditCustomTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  sportType?: string;
  test: EditableTest | null;
}

export function EditCustomTestDialog({ open, onOpenChange, categoryId, sportType, test }: EditCustomTestDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [testCategory, setTestCategory] = useState("");
  const [unitKind, setUnitKind] = useState<string>("");
  const [customUnit, setCustomUnit] = useState("");
  const [description, setDescription] = useState("");
  const [objectives, setObjectives] = useState("");
  const [enableScoring, setEnableScoring] = useState(false);
  const [scoringScale, setScoringScale] = useState<ScoringScale | null>(null);
  const [formulaConfig, setFormulaConfig] = useState<FormulaConfig | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Initialise le formulaire quand un test est sélectionné
  useEffect(() => {
    if (!open || !test) return;
    setName(test.name || "");
    setTestCategory(test.test_category || "");
    const knownKind = test.unit_kind || (test.unit ? guessUnitKind(test.unit) : "");
    if (knownKind && knownKind !== "custom") {
      setUnitKind(knownKind);
      setCustomUnit("");
    } else if (test.unit) {
      setUnitKind("custom");
      setCustomUnit(test.unit);
    } else {
      setUnitKind("");
      setCustomUnit("");
    }
    setDescription(test.description || "");
    setObjectives(test.objectives || "");
    setEnableScoring(!!test.scoring_scale);
    setScoringScale(test.scoring_scale || null);
    setFormulaConfig(test.formula_config?.enabled ? test.formula_config : null);
    setImageUrl(test.image_url || null);
  }, [open, test]);

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 5 Mo)");
      return;
    }
    setIsUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${categoryId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("test-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("test-images").getPublicUrl(path);
      setImageUrl(pub.publicUrl);
      toast.success("Image ajoutée");
    } catch (e: any) {
      toast.error("Erreur upload: " + (e?.message || "inconnue"));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const baseTestCategories = useMemo(() => {
    return getTestCategoriesForSport(sportType || "").filter(c => !c.value.startsWith("rehab_"));
  }, [sportType]);

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
    enabled: open,
  });

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
    const categoryMap = new Map(baseTestCategories.map((c) => [c.value, c.label]));
    (themeCategories || []).forEach((tc) => {
      if (!categoryMap.has(tc.value)) categoryMap.set(tc.value, tc.label);
    });
    (existingCustomCategories || []).forEach((value) => {
      if (!categoryMap.has(value)) categoryMap.set(value, formatCategoryLabel(value));
    });
    return Array.from(categoryMap.entries()).map(([value, label]) => ({ value, label }));
  }, [baseTestCategories, themeCategories, existingCustomCategories]);

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

  const saveTest = useMutation({
    mutationFn: async () => {
      if (!test) throw new Error("Aucun test sélectionné");
      if (!categoryData?.club_id) throw new Error("Club introuvable");
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Le nom du test est requis");
      if (!testCategory) throw new Error("Choisissez une catégorie");
      if (!unitKind) throw new Error("Choisissez une unité de mesure");
      if (unitKind === "custom" && !customUnit.trim()) throw new Error("Saisissez l'unité personnalisée");

      const maxPoints = enableScoring && scoringScale
        ? scoringScale.ranges.reduce((m, r) => Math.max(m, r.points), 0)
        : null;

      const payload: any = {
        name: trimmedName,
        test_category: testCategory,
        unit: effectiveUnit || null,
        unit_kind: unitKind,
        is_time: isTime,
        description: description.trim() || null,
        objectives: objectives.trim() || null,
        scoring_scale: enableScoring ? (scoringScale as any) : null,
        max_points: maxPoints,
        image_url: imageUrl,
        formula_config: formulaConfig?.enabled ? (formulaConfig as any) : null,
      };

      if (test.source === "custom" && test.id) {
        // UPDATE direct du custom_test
        const { error } = await supabase
          .from("custom_tests")
          .update(payload)
          .eq("id", test.id);
        if (error) throw error;
      } else {
        // SEED: crée un nouveau custom_test (override) lié à la catégorie courante
        const { data: user } = await supabase.auth.getUser();
        const { data: created, error: insErr } = await supabase
          .from("custom_tests")
          .insert({
            ...payload,
            club_id: categoryData.club_id,
            created_by: user?.user?.id || null,
          } as any)
          .select("id")
          .single();
        if (insErr) throw insErr;
        const { error: linkErr } = await supabase
          .from("custom_test_categories")
          .insert({ custom_test_id: created.id, category_id: categoryId });
        if (linkErr) throw linkErr;
      }
    },
    onSuccess: () => {
      toast.success("Test mis à jour");
      queryClient.invalidateQueries({ queryKey: ["custom_tests_list", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["custom-test-categories", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["custom-tests", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["generic_tests_discovery", categoryId] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const deleteTest = useMutation({
    mutationFn: async () => {
      if (!test?.id || test.source !== "custom") throw new Error("Suppression non autorisée");
      const { error } = await supabase.from("custom_tests").delete().eq("id", test.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Test supprimé");
      queryClient.invalidateQueries({ queryKey: ["custom_tests_list", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["custom-test-categories", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["custom-tests", categoryId] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la suppression: " + error.message);
    },
  });

  const handleSubmit = () => {
    if (saveTest.isPending) return;
    if (!testCategory) return toast.error("Choisissez une catégorie");
    if (!name.trim()) return toast.error("Le nom du test est requis");
    if (!unitKind) return toast.error("Choisissez une unité de mesure");
    if (unitKind === "custom" && !customUnit.trim()) return toast.error("Saisissez l'unité personnalisée");
    saveTest.mutate();
  };

  const isSeed = test?.source === "seed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isSeed ? "Personnaliser le test" : "Modifier le test"}</DialogTitle>
          <DialogDescription>
            {isSeed
              ? "Ce test fait partie du catalogue. Vos modifications créeront une version personnalisée pour cette catégorie."
              : "Modifiez le nom, la catégorie, l'unité, la description, les objectifs et le barème de notation."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Catégorie <span className="text-destructive">*</span></Label>
            <Select value={testCategory} onValueChange={setTestCategory}>
              <SelectTrigger><SelectValue placeholder="Choisir une catégorie..." /></SelectTrigger>
              <SelectContent>
                {testCategories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nom du test <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Unité de mesure <span className="text-destructive">*</span></Label>
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

          {/* Image du test */}
          <div className="space-y-1.5">
            <Label>Image du test (optionnel)</Label>
            {imageUrl ? (
              <div className="relative inline-block rounded-2xl overflow-hidden border bg-muted/40">
                <img src={imageUrl} alt="Aperçu du test" className="max-h-48 object-contain" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 rounded-full"
                  onClick={() => setImageUrl(null)}
                  aria-label="Retirer l'image"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 h-28 rounded-2xl border-2 border-dashed bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors">
                {isUploadingImage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Téléversement...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Cliquer pour ajouter une image (PNG, JPG, max 5 Mo)
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploadingImage}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Description (optionnel)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Comment se déroule le test, protocole..." rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label>Objectifs (optionnel)</Label>
            <Textarea value={objectives} onChange={e => setObjectives(e.target.value)}
              placeholder="Ce que ce test cherche à évaluer ou améliorer..." rows={2} />
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

          <FormulaConfigEditor
            value={formulaConfig}
            onChange={setFormulaConfig}
            resultUnit={effectiveUnit}
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {!isSeed && test?.id && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm("Supprimer définitivement ce test ?")) deleteTest.mutate();
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Supprimer
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSubmit}>
              {saveTest.isPending ? "Enregistrement..." : (isSeed ? "Créer la version personnalisée" : "Enregistrer")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function guessUnitKind(unit: string): string {
  const opt = TEST_UNIT_OPTIONS.find(o => o.unit === unit);
  return opt?.value || "custom";
}
