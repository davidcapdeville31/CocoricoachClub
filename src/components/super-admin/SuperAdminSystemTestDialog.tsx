import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  TEST_CATEGORIES,
  getTestCategoriesForSport,
} from "@/lib/constants/testCategories";
import {
  TEST_UNIT_OPTIONS,
  getUnitByKind,
  type ScoringScale,
} from "@/lib/constants/testUnits";
import { ScoringScaleEditor } from "@/components/category/tests/ScoringScaleEditor";
import { FormulaConfigEditor } from "@/components/category/tests/FormulaConfigEditor";
import type { FormulaConfig } from "@/lib/tests/formulaEngine";
import { ImagePlus, Loader2, X, Shield } from "lucide-react";

interface SystemTestEditing {
  id?: string;
  name?: string;
  test_category?: string;
  unit?: string | null;
  unit_kind?: string | null;
  is_time?: boolean | null;
  description?: string | null;
  objectives?: string | null;
  scoring_scale?: ScoringScale | null;
  formula_config?: FormulaConfig | null;
  image_url?: string | null;
  icon?: string | null;
  video_url?: string | null;
  bilateral?: boolean | null;
  max_points?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  test: SystemTestEditing | null;
}

export function SuperAdminSystemTestDialog({ open, onOpenChange, test }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!test?.id;

  const [name, setName] = useState("");
  const [testCategory, setTestCategory] = useState("");
  const [unitKind, setUnitKind] = useState("");
  const [customUnit, setCustomUnit] = useState("");
  const [description, setDescription] = useState("");
  const [objectives, setObjectives] = useState("");
  const [enableScoring, setEnableScoring] = useState(false);
  const [scoringScale, setScoringScale] = useState<ScoringScale | null>(null);
  const [formulaConfig, setFormulaConfig] = useState<FormulaConfig | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [icon, setIcon] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [bilateral, setBilateral] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset / hydrate when dialog opens
  useEffect(() => {
    if (!open) return;
    if (test) {
      setName(test.name ?? "");
      setTestCategory(test.test_category ?? "");
      const kindFromTest =
        test.unit_kind ||
        TEST_UNIT_OPTIONS.find((o) => o.unit === test.unit)?.value ||
        (test.unit ? "custom" : "");
      setUnitKind(kindFromTest);
      setCustomUnit(kindFromTest === "custom" ? test.unit ?? "" : "");
      setDescription(test.description ?? "");
      setObjectives(test.objectives ?? "");
      setEnableScoring(!!test.scoring_scale);
      setScoringScale((test.scoring_scale as any) ?? null);
      setFormulaConfig((test.formula_config as any) ?? null);
      setImageUrl(test.image_url ?? null);
      setIcon(test.icon ?? "");
      setVideoUrl(test.video_url ?? "");
      setBilateral(!!test.bilateral);
    } else {
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
      setIcon("");
      setVideoUrl("");
      setBilateral(false);
    }
  }, [open, test?.id]);

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
      const path = `system-tests/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;
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

  // Toutes les catégories disponibles cross-sport
  const allCategories = useMemo(() => {
    // On agrège les catégories de tous les sports pour le super admin
    const sports = [
      "rugby",
      "football",
      "handball",
      "basketball",
      "volleyball",
      "tennis",
      "padel",
      "bowling",
      "athletisme",
      "natation",
      "cyclisme",
      "judo",
      "ski",
      "triathlon",
      "aviron",
    ];
    const map = new Map<string, string>();
    TEST_CATEGORIES.forEach((c) => map.set(c.value, c.label));
    sports.forEach((s) =>
      getTestCategoriesForSport(s).forEach((c) => {
        if (!map.has(c.value)) map.set(c.value, c.label);
      }),
    );
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const groupedUnits = useMemo(() => {
    const groups = new Map<string, typeof TEST_UNIT_OPTIONS>();
    TEST_UNIT_OPTIONS.forEach((opt) => {
      const arr = groups.get(opt.group) ?? [];
      arr.push(opt);
      groups.set(opt.group, arr);
    });
    return Array.from(groups.entries());
  }, []);

  const selectedUnit = getUnitByKind(unitKind);
  const effectiveUnit =
    unitKind === "custom" ? customUnit : selectedUnit?.unit ?? "";
  const isTime = Boolean(selectedUnit?.isTime);

  const scoringBaseMaxPoints = useMemo(() => {
    if (!enableScoring || !scoringScale) return 0;
    return Math.max(
      scoringScale.ranges.reduce((m, r) => Math.max(m, r.points), 0),
      ...(scoringScale.variants ?? []).map((v) =>
        (v.ranges ?? []).reduce((m, r) => Math.max(m, r.points), 0),
      ),
    );
  }, [enableScoring, scoringScale]);

  const save = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Le nom du test est requis");
      if (!testCategory) throw new Error("Choisissez une catégorie");
      if (!unitKind) throw new Error("Choisissez une unité de mesure");
      if (unitKind === "custom" && !customUnit.trim())
        throw new Error("Saisissez l'unité personnalisée");

      const maxPoints = enableScoring
        ? scoringBaseMaxPoints * (bilateral ? 2 : 1)
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
        icon: icon.trim() || null,
        video_url: videoUrl.trim() || null,
        formula_config: formulaConfig?.enabled ? (formulaConfig as any) : null,
        bilateral,
        is_system: true,
        club_id: null,
      };

      if (isEdit && test?.id) {
        const { error } = await supabase
          .from("custom_tests")
          .update(payload)
          .eq("id", test.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("custom_tests")
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Test système mis à jour" : "Test système créé");
      queryClient.invalidateQueries({ queryKey: ["system-tests-bank"] });
      // Invalider aussi côté coach (toutes les vues qui affichent les tests système)
      queryClient.invalidateQueries({ queryKey: ["custom_tests_list"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Erreur : " + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {isEdit ? "Modifier le test système" : "Créer un test système"}
          </DialogTitle>
          <DialogDescription>
            Ce test sera visible et utilisable par <strong>tous les comptes</strong>.
            Toute modification ici impactera la banque de tests de chaque
            utilisateur (sauf ceux qui ont déjà créé une copie locale).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
          <div className="space-y-4">
            {/* Image */}
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
                      <span className="text-xs text-muted-foreground">
                        Upload en cours…
                      </span>
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
              <Label>Icône (emoji, affichée si pas d'image)</Label>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="Ex: 🏋️ ❤️ 🧘 ⚡"
                maxLength={4}
                className="w-32 text-center text-2xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Lien vidéo (YouTube, Vimeo...) (optionnel)</Label>
              <Input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Catégorie <span className="text-destructive">*</span>
              </Label>
              <Select value={testCategory} onValueChange={setTestCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une catégorie..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {allCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                Nom du test <span className="text-destructive">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Équilibre unipodal yeux fermés"
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Unité de mesure <span className="text-destructive">*</span>
              </Label>
              <Select value={unitKind} onValueChange={setUnitKind}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une unité..." />
                </SelectTrigger>
                <SelectContent>
                  {groupedUnits.map(([group, opts]) => (
                    <SelectGroup key={group}>
                      <SelectLabel>{group}</SelectLabel>
                      {opts.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {unitKind === "custom" && (
                <Input
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="Ex: niveau, étoiles..."
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Description (optionnel)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Comment se déroule le test, protocole..."
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Objectifs (optionnel)</Label>
              <Textarea
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                placeholder="Ce que ce test cherche à évaluer ou améliorer..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border bg-muted/40 p-4">
              <div>
                <Label className="text-sm font-semibold cursor-pointer">
                  Activer un barème de notation
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Convertit automatiquement les résultats en points selon vos
                  plages.
                </p>
              </div>
              <Switch checked={enableScoring} onCheckedChange={setEnableScoring} />
            </div>

            <div className="flex items-center justify-between rounded-2xl border bg-muted/40 p-4">
              <div>
                <Label className="text-sm font-semibold cursor-pointer">
                  Test bilatéral (côté droit + côté gauche)
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Saisissez deux résultats par athlète (D et G). Le score total
                  est l'addition des deux côtés.
                </p>
              </div>
              <Switch checked={bilateral} onCheckedChange={setBilateral} />
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
              scoringScale={enableScoring ? scoringScale : null}
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-card px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Enregistrement..." : isEdit ? "Enregistrer" : "Créer le test système"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
