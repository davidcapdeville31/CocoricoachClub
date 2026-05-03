import { useState, useMemo, useEffect, useRef } from "react";
import { Star, ImagePlus, Loader2, X } from "lucide-react";
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

interface CreateCustomTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  sportType?: string;
}

export function CreateCustomTestDialog({ open, onOpenChange, categoryId, sportType }: CreateCustomTestDialogProps) {
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
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [bilateral, setBilateral] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Le fichier doit être une image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 5 Mo)");
      return;
    }
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `custom-tests/${categoryId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("test-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("test-images").getPublicUrl(path);
      setImageUrl(pub.publicUrl);
      toast.success("Image ajoutée");
    } catch (err: any) {
      toast.error("Erreur upload : " + (err.message ?? "inconnue"));
    } finally {
      setUploadingImage(false);
    }
  };

  const baseTestCategories = useMemo(() => {
    return getTestCategoriesForSport(sportType || "").filter(c => !c.value.startsWith("rehab_"));
  }, [sportType]);

  // Catégories créées via "Créer une catégorie" (thématiques vides ou non)
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

  // Catégories déjà utilisées par un test custom
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

  // Favorites synced with GenericTestsSection (same localStorage key)
  const favStorageKey = `tests-fav-categories:${categoryId}`;
  const [favoriteCategories, setFavoriteCategories] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(favStorageKey);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {}
    return new Set();
  });
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

  const toggleFavorite = (value: string) => {
    setFavoriteCategories(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      try {
        localStorage.setItem(favStorageKey, JSON.stringify(Array.from(next)));
        window.dispatchEvent(new CustomEvent("tests-fav-categories-changed", { detail: { key: favStorageKey } }));
      } catch {}
      return next;
    });
  };

  const testCategories = useMemo(() => {
    const categoryMap = new Map(baseTestCategories.map((c) => [c.value, c.label]));

    (themeCategories || []).forEach((tc) => {
      if (!categoryMap.has(tc.value)) categoryMap.set(tc.value, tc.label);
    });

    (existingCustomCategories || []).forEach((value) => {
      if (!categoryMap.has(value)) categoryMap.set(value, formatCategoryLabel(value));
    });

    const all = Array.from(categoryMap.entries()).map(([value, label]) => ({ value, label }));
    // Sort favorites first, then alphabetical
    return all.sort((a, b) => {
      const af = favoriteCategories.has(a.value) ? 0 : 1;
      const bf = favoriteCategories.has(b.value) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.label.localeCompare(b.label);
    });
  }, [baseTestCategories, themeCategories, existingCustomCategories, favoriteCategories]);

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
      if (!trimmedName) throw new Error("Le nom du test est requis");
      if (!testCategory) throw new Error("Choisissez une catégorie");
      if (!unitKind) throw new Error("Choisissez une unité de mesure");
      if (unitKind === "custom" && !customUnit.trim()) throw new Error("Saisissez l'unité personnalisée");

      const baseMaxPoints = enableScoring && scoringScale
        ? Math.max(
            scoringScale.ranges.reduce((m, r) => Math.max(m, r.points), 0),
            ...(scoringScale.variants ?? []).map(v =>
              (v.ranges ?? []).reduce((m, r) => Math.max(m, r.points), 0)
            )
          )
        : null;
      const maxPoints = baseMaxPoints != null ? baseMaxPoints * (bilateral ? 2 : 1) : null;

      const { data: user } = await supabase.auth.getUser();

      const { data: customTest, error: testError } = await supabase
        .from("custom_tests")
        .insert({
          club_id: categoryData.club_id,
          name: trimmedName,
          test_category: testCategory,
          unit: effectiveUnit || null,
          unit_kind: unitKind,
          is_time: isTime,
          description: description.trim() || null,
          objectives: objectives.trim() || null,
          scoring_scale: enableScoring ? (scoringScale as any) : null,
          max_points: maxPoints,
          formula_config: formulaConfig?.enabled ? (formulaConfig as any) : null,
          image_url: imageUrl,
          video_url: videoUrl.trim() || null,
          bilateral,
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
      toast.success("Test créé avec succès");
      queryClient.invalidateQueries({ queryKey: ["custom-test-categories", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["custom-tests", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["generic_tests_discovery", categoryId] });
      // Invalider la liste utilisée par GenericTestsSection (toutes variantes de defaultCategory)
      queryClient.invalidateQueries({ queryKey: ["custom_tests_list", categoryId] });
      // Invalider aussi les onglets du parent (TestsTab)
      queryClient.invalidateQueries({ queryKey: ["custom-test-categories"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la création: " + error.message);
    },
  });

  const resetForm = () => {
    setName("");
    setTestCategory("");
    setUnitKind("");
    setCustomUnit("");
    setDescription("");
    setObjectives("");
    setEnableScoring(false);
    setScoringScale(null);
    setFormulaConfig(null);
    setImageUrl(null);
    setVideoUrl("");
    setBilateral(false);
  };

  const handleSubmit = () => {
    if (createTest.isPending) return;
    if (!testCategory) return toast.error("Choisissez une catégorie");
    if (!name.trim()) return toast.error("Le nom du test est requis");
    if (!unitKind) return toast.error("Choisissez une unité de mesure");
    if (unitKind === "custom" && !customUnit.trim()) return toast.error("Saisissez l'unité personnalisée");
    createTest.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un test</DialogTitle>
          <DialogDescription>
            Ajoutez un test dans une catégorie existante. Pour créer une nouvelle catégorie, utilisez le bouton "Créer une catégorie".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image illustrative — proposée dès le début */}
          <div className="space-y-1.5">
            <Label>Image illustrative (optionnel)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageUpload(f);
                e.target.value = "";
              }}
            />
            {imageUrl ? (
              <div className="relative rounded-2xl overflow-hidden border bg-muted/40 group">
                <img
                  src={imageUrl}
                  alt="Aperçu du test"
                  className="w-full h-44 object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 px-3 text-xs backdrop-blur-md bg-background/80"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    Remplacer
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 backdrop-blur-md bg-background/80"
                    onClick={() => setImageUrl(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="w-full rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 py-6 flex flex-col items-center justify-center gap-2 hover:bg-muted/60 transition-colors"
              >
                {uploadingImage ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Upload en cours…</span>
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium">Ajouter une image</span>
                    <span className="text-[11px] text-muted-foreground">
                      JPG, PNG ou WebP — 5 Mo max
                    </span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Lien vidéo (YouTube, Vimeo...) (optionnel)</Label>
            <Input
              type="url"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Catégorie <span className="text-destructive">*</span></Label>
            <Select value={testCategory} onValueChange={setTestCategory}>
              <SelectTrigger><SelectValue placeholder="Choisir une catégorie..." /></SelectTrigger>
              <SelectContent>
                {testCategories.map(cat => {
                  const isFav = favoriteCategories.has(cat.value);
                  return (
                    <div key={cat.value} className="relative flex items-center">
                      <SelectItem value={cat.value} className="flex-1 pr-10">
                        <span className="flex items-center gap-2">
                          {isFav && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                          {cat.label}
                        </span>
                      </SelectItem>
                      <button
                        type="button"
                        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(cat.value); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted z-10"
                        title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                      >
                        <Star className={`h-3.5 w-3.5 ${isFav ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                      </button>
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
            {testCategories.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aucune catégorie disponible. Créez d'abord une catégorie.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Nom du test <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Équilibre unipodal yeux fermés" />
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

          <div className="flex items-center justify-between rounded-2xl border bg-muted/40 p-4">
            <div>
              <Label className="text-sm font-semibold cursor-pointer">Test bilatéral (côté droit + côté gauche)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Saisissez deux résultats par athlète (D et G). Le score total est l'addition des deux côtés{enableScoring && scoringScale ? ` (max ${Math.max(scoringScale.ranges.reduce((m, r) => Math.max(m, r.points), 0), ...(scoringScale.variants ?? []).map(v => (v.ranges ?? []).reduce((m, r) => Math.max(m, r.points), 0))) * 2} pts au total).` : "."}
              </p>
            </div>
            <Switch checked={bilateral} onCheckedChange={setBilateral} />
          </div>

          {enableScoring && (
            <ScoringScaleEditor
              value={scoringScale}
              onChange={setScoringScale}
              unit={effectiveUnit}
              sportType={sportType}
            />
          )}

          <FormulaConfigEditor
            value={formulaConfig}
            onChange={setFormulaConfig}
            resultUnit={effectiveUnit}
            scoringScale={enableScoring ? scoringScale : null}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit}>
            {createTest.isPending ? "Création..." : "Créer le test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
