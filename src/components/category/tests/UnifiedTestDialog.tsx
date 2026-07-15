import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { PlayerSelection } from "./PlayerSelection";
import { getTestCategoriesForSport, TestOption } from "@/lib/constants/testCategories";
import { HierarchicalTestSelector, resolveTestCategory, resolveGroupAndZone } from "./HierarchicalTestSelector";
import { Gauge, Zap, Timer } from "lucide-react";
import { mergeCustomTestsIntoCategories, normalizeCustomTestType } from "./customTestCatalog";
import { ComposedTestInputs } from "./ComposedTestInputs";
import { isValidFormulaConfig, type FormulaConfig } from "@/lib/tests/formulaEngine";
import { useSeasonGuard } from "@/hooks/use-season-guard";
import { computePoints, findMatchingRange, type ScoringScale, type PlayerForScoring } from "@/lib/constants/testUnits";
import { getPositionGroupsForSport, playerBelongsToGroup } from "@/lib/constants/sportPositionGroups";
import { Badge } from "@/components/ui/badge";

interface UnifiedTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  sportType?: string;
  defaultFilterCategory?: string;
  defaultFilterTestType?: string;
  allowCustomTest?: boolean;
}

// Detect if test is a musculation/strength RM test
const isStrengthRMTest = (testValue: string, categoryValue: string) => {
  return (
    categoryValue === "musculation" ||
    categoryValue === "halterophilie" ||
    categoryValue === "poids_corps" ||
    testValue.includes("_1rm") ||
    testValue.includes("_3rm") ||
    testValue.includes("_5rm")
  );
};

export function UnifiedTestDialog({
  open, onOpenChange, categoryId, sportType, defaultFilterCategory, defaultFilterTestType, allowCustomTest = true,
}: UnifiedTestDialogProps) {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<"all" | "specific">("all");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedTest, setSelectedTest] = useState("");
  const [playerResults, setPlayerResults] = useState<Record<string, string>>({});
  const [playerSecondaryResults, setPlayerSecondaryResults] = useState<Record<string, string>>({});
  const [playerComposedInputs, setPlayerComposedInputs] = useState<Record<string, Record<string, string>>>({});
  const [notes, setNotes] = useState("");
  const [customTestName, setCustomTestName] = useState("");
  const [customTestUnit, setCustomTestUnit] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [saveAsGpsVmax, setSaveAsGpsVmax] = useState(false);
  const [ratioInputMode, setRatioInputMode] = useState<"kg" | "ratio">("kg");
  const queryClient = useQueryClient();
  const guard = useSeasonGuard(categoryId);

  // Map sprint test types to their distances in meters
  const SPRINT_DISTANCE_MAP: Record<string, number> = {
    sprint_10m: 10, sprint_20m: 20, sprint_30m: 30, sprint_40m: 40,
    sprint_50m: 50, sprint_100m: 100,
    rugby_prone_30m: 30,
    basketball_sprint_3_4: 21,
    basketball_sprint_full: 28,
    football_sprint_30m: 30, football_sprint_40m: 40,
  };

  const isSprintTest = !isCustom && selectedTest && (
    selectedTest in SPRINT_DISTANCE_MAP ||
    selectedTest.startsWith("sprint_")
  );

  const sprintDistance = isSprintTest ? (SPRINT_DISTANCE_MAP[selectedTest] || null) : null;

  const resolvedCategory = resolveTestCategory(selectedGroup, selectedZone, sportType || "");
  const isStrengthTest = !isCustom && selectedTest && isStrengthRMTest(selectedTest, resolvedCategory);

  // Pre-select group/zone/test when dialog opens with a default filter
  useEffect(() => {
    if (open && defaultFilterCategory) {
      const { group, zone } = resolveGroupAndZone(defaultFilterCategory, sportType || "");
      setSelectedGroup(group);
      setSelectedZone(zone);
      if (defaultFilterTestType) {
        setSelectedTest(defaultFilterTestType);
      } else {
        setSelectedTest("");
      }
      setPlayerResults({});
      setPlayerSecondaryResults({});
    }
  }, [open, defaultFilterCategory, defaultFilterTestType, sportType]);

  const AVAILABLE_UNITS = [
    { value: "kg", label: "Kilogrammes (kg)" },
    { value: "× PDC", label: "Ratio poids du corps (× PDC)" },
    { value: "N", label: "Newton (N)" },
    { value: "cm", label: "Centimètres (cm)" },
    { value: "m", label: "Mètres (m)" },
    { value: "m/s", label: "Mètres/seconde (m/s)" },
    { value: "km/h", label: "Kilomètres/heure (km/h)" },
    { value: "W", label: "Watts (W)" },
    { value: "W/kg", label: "Watts/kg (W/kg)" },
    { value: "cal", label: "Calories (cal)" },
    { value: "s", label: "Secondes (s)" },
    { value: "min.s", label: "Minutes.secondes (min.s)" },
    { value: "reps", label: "Répétitions (reps)" },
    { value: "%", label: "Pourcentage (%)" },
    { value: "palier", label: "Palier" },
    { value: "ml/kg/min", label: "VO2max (ml/kg/min)" },
    { value: "mmol/L", label: "Lactate (mmol/L)" },
    { value: "bpm", label: "Battements/min (bpm)" },
    { value: "score", label: "Score" },
    { value: "°", label: "Degrés (°)" },
  ];

  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players").select("*").eq("category_id", categoryId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const effectivePlayers = selectionMode === "all" 
    ? (players || []) 
    : (players || []).filter(p => selectedPlayers.includes(p.id));

  const { data: customTests } = useQuery({
    queryKey: ["custom-tests-catalog", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_test_categories")
        .select("custom_tests(name, test_category, unit, is_time, formula_config, scoring_scale, max_points)")
        .eq("category_id", categoryId);

      if (error) throw error;

      return (data || [])
        .map((row: any) => row.custom_tests)
        .filter(Boolean);
    },
    enabled: open,
  });

  // Fetch user-created theme categories (empty tabs like "Test David")
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

  const filteredTestCategories = useMemo(() => {
    const merged = mergeCustomTestsIntoCategories(getTestCategoriesForSport(sportType || ""), customTests || []);
    const existing = new Set(merged.map((c: any) => c.value));
    if (themeCategories?.length) {
      themeCategories.forEach((tc) => {
        if (tc.value.startsWith("rehab_")) return;
        if (!existing.has(tc.value)) {
          merged.push({ value: tc.value, label: tc.label, tests: [] } as any);
        }
      });
    }
    return merged;
  }, [sportType, customTests, themeCategories]);
  
  const currentCategoryObj = filteredTestCategories.find(c => c.value === resolvedCategory);
  
  const currentTest: TestOption | null = isCustom 
    ? (customTestName && customTestUnit ? { value: `custom_${normalizeCustomTestType(customTestName)}`, label: customTestName, unit: customTestUnit, isTime: ["s", "min.s"].includes(customTestUnit) } as TestOption : null)
    : currentCategoryObj?.tests.find(t => t.value === selectedTest) || null;

  const matchedCustomTest = useMemo(() => {
    if (!currentTest) return null;
    return (customTests || []).find((ct: any) =>
      `custom_${normalizeCustomTestType(ct.name)}` === currentTest.value
    ) as any | undefined;
  }, [currentTest, customTests]);

  const activeFormulaConfig: FormulaConfig | null = useMemo(() => {
    const cfg = matchedCustomTest?.formula_config;
    return isValidFormulaConfig(cfg) ? cfg : null;
  }, [matchedCustomTest]);

  const activeScoringScale: ScoringScale | null = useMemo(() => {
    const s = matchedCustomTest?.scoring_scale;
    return s && (s.ranges?.length || s.variants?.length) ? (s as ScoringScale) : null;
  }, [matchedCustomTest]);

  // Category (for gender fallback used by variants)
  const { data: categoryInfo } = useQuery({
    queryKey: ["category-info-for-scoring", categoryId],
    enabled: open && !!activeScoringScale,
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("gender, sport_type").eq("id", categoryId).maybeSingle();
      return data as { gender?: string | null; sport_type?: string | null } | null;
    },
  });

  // Resolve each player's PlayerForScoring profile (gender + positionGroup)
  const playerScoringProfiles = useMemo(() => {
    const map: Record<string, PlayerForScoring> = {};
    const groups = getPositionGroupsForSport(sportType);
    const catGender = (categoryInfo as any)?.gender;
    (players || []).forEach((p: any) => {
      const grp = groups.find(g => playerBelongsToGroup(p.position, g));
      const raw = (p.gender || catGender || "").toString().toLowerCase();
      let gender: string | null = null;
      if (raw === "male" || raw === "masculine" || raw === "men") gender = "male";
      else if (raw === "female" || raw === "feminine" || raw === "women") gender = "female";
      map[p.id] = { gender, position: p.position || null, positionGroup: grp?.id || null };
    });
    return map;
  }, [players, sportType, categoryInfo]);

  // Detect ratio-based tests (unit "× PDC" or legacy "x PDC")
  const currentUnit = (currentTest?.unit || customTestUnit || "").trim();
  const isRatioTest = currentUnit === "× PDC" || currentUnit === "x PDC" || currentUnit === "×PDC";

  // Fetch latest bodyweight for each effective player (used for ratio auto-compute)
  const effectivePlayerIds = useMemo(() => effectivePlayers.map(p => p.id), [effectivePlayers]);
  const { data: latestWeights } = useQuery({
    queryKey: ["latest-weights", categoryId, effectivePlayerIds.sort().join(",")],
    enabled: isRatioTest && effectivePlayerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_composition")
        .select("player_id, weight_kg, measurement_date")
        .in("player_id", effectivePlayerIds)
        .not("weight_kg", "is", null)
        .order("measurement_date", { ascending: false });
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data || []) as any[]) {
        if (row.weight_kg != null && map[row.player_id] === undefined) {
          map[row.player_id] = Number(row.weight_kg);
        }
      }
      return map;
    },
  });

  // Compute GPS values for sprint tests
  const computeSprintGpsValues = (timeStr: string) => {
    const time = parseFloat(timeStr);
    if (!time || !sprintDistance || time <= 0) return null;
    const vmaxMs = sprintDistance / time;
    const vmaxKmh = vmaxMs * 3.6;
    // Simplified accel max estimation: v²/(2*d) for uniform acceleration
    const accelMax = (vmaxMs * vmaxMs) / (2 * (sprintDistance / 2));
    return {
      vmaxKmh: Math.round(vmaxKmh * 100) / 100,
      vmaxMs: Math.round(vmaxMs * 100) / 100,
      accelMax: Math.round(accelMax * 100) / 100,
    };
  };

  const addTests = useMutation({
    mutationFn: async () => {
      if (!guard.assertDate(date)) throw new Error("guard:date");
      const testLabel = isCustom ? customTestName : currentTest?.label || "";
      const categoryLabel = isCustom ? "Personnalisé" : currentCategoryObj?.label || "";
      const testCategory = isCustom ? "custom" : resolvedCategory;
      const testType = isCustom ? `custom_${normalizeCustomTestType(customTestName)}` : selectedTest;

      const { data: sessionData, error: sessionError } = await supabase
        .from("training_sessions")
        .insert({ category_id: categoryId, session_date: date, training_type: "test", notes: `Test: ${categoryLabel} - ${testLabel}` })
        .select("id").single();
      if (sessionError) throw sessionError;

      const inserts = effectivePlayers
        .filter(player => playerResults[player.id])
        .map(player => {
          const rawInput = parseFloat(playerResults[player.id]);
          let finalValue = rawInput;
          let ratioNote = "";
          if (isRatioTest && ratioInputMode === "kg") {
            const w = latestWeights?.[player.id];
            if (!w || w <= 0) {
              throw new Error(`Poids manquant pour ${player.first_name || ""} ${player.name} — saisis un poids anthropo ou passe en mode "Ratio direct".`);
            }
            finalValue = Math.round((rawInput / w) * 1000) / 1000;
            ratioNote = ` [Ratio auto: ${rawInput}kg / ${w}kg = ${finalValue}× PDC]`;
          }
          return {
            player_id: player.id, category_id: categoryId, test_date: date,
            test_category: testCategory, test_type: testType,
            result_value: finalValue,
            result_unit: isRatioTest ? "× PDC" : (currentTest?.unit || customTestUnit || ""),
            secondary_value: playerSecondaryResults[player.id] ? parseFloat(playerSecondaryResults[player.id]) : null,
            secondary_unit: (isStrengthTest && playerSecondaryResults[player.id]) ? "m/s" : null,
            notes: `Session ID: ${sessionData.id}` + (notes ? `\n${notes}` : "") + ratioNote,
          };
        });

      if (inserts.length === 0) throw new Error("Aucun résultat saisi");
      if (!guard.assertPlayers(inserts.map((i) => i.player_id))) throw new Error("guard:players");
      const { error } = await supabase.from("generic_tests").insert(inserts);
      if (error) throw error;

      // Save Vmax references for GPS if checkbox is checked
      if (saveAsGpsVmax && sprintDistance) {
        const vmaxInserts = inserts
          .filter(i => i.result_value > 0)
          .map(i => {
            const timeSeconds = i.result_value;
            const vmaxMs = sprintDistance / timeSeconds;
            const vmaxKmh = vmaxMs * 3.6;
            return {
              player_id: i.player_id,
              category_id: categoryId,
              test_date: date,
              source_type: "speed_test" as const,
              ref_vmax_ms: Math.round(vmaxMs * 100) / 100,
              ref_vmax_kmh: Math.round(vmaxKmh * 100) / 100,
              ref_sprint_distance_m: sprintDistance,
              ref_time_40m_seconds: sprintDistance === 40 ? timeSeconds : null,
              is_active: true,
              notes: `Auto from ${testLabel} (${timeSeconds}s sur ${sprintDistance}m)`,
            };
          });

        if (vmaxInserts.length > 0) {
          const playerIds = vmaxInserts.map(v => v.player_id);
          await supabase
            .from("player_performance_references")
            .update({ is_active: false })
            .eq("category_id", categoryId)
            .in("player_id", playerIds)
            .eq("is_active", true);

          const { error: refError } = await supabase
            .from("player_performance_references")
            .insert(vmaxInserts);
          if (refError) console.error("Erreur sauvegarde Vmax GPS:", refError);
          else toast.success(`Vmax GPS mis à jour pour ${vmaxInserts.length} joueur(s)`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generic_tests", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["custom-tests-catalog", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["training_sessions", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["generic-tests-evolution", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["generic-tests-multi-comparison", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["speed-tests-evolution", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["speed-tests-multi-comparison", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["strength-tests-evolution", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["strength-tests-multi-comparison", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["jump-tests-evolution", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["jump-tests-multi-comparison", categoryId] });
      if (saveAsGpsVmax) {
        queryClient.invalidateQueries({ queryKey: ["player_performance_references", categoryId] });
        queryClient.invalidateQueries({ queryKey: ["player_active_reference"] });
      }
      toast.success("Tests ajoutés avec succès");
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (typeof error?.message === "string" && error.message.startsWith("guard:")) return;
      toast.error(error.message || "Erreur lors de l'ajout des tests");
    },
  });

  const resetForm = () => {
    setSelectedPlayers([]); setSelectionMode("all"); setSelectedGroup(""); setSelectedZone("");
    setSelectedTest(""); setPlayerResults({}); setPlayerSecondaryResults({}); setNotes(""); setCustomTestName(""); setCustomTestUnit("");
    setIsCustom(false); setSaveAsGpsVmax(false);
  };

  const updatePlayerResult = (playerId: string, value: string) => {
    setPlayerResults(prev => ({ ...prev, [playerId]: value }));
  };

  const updatePlayerSecondaryResult = (playerId: string, value: string) => {
    setPlayerSecondaryResults(prev => ({ ...prev, [playerId]: value }));
  };

  const filledResultsCount = effectivePlayers.filter(p => playerResults[p.id]).length;

  const showSecondaryField = isStrengthTest;
  const showGpsPreview = isSprintTest && sprintDistance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ajouter un test de performance</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            <PlayerSelection
              categoryId={categoryId} selectedPlayers={selectedPlayers}
              onSelectionChange={setSelectedPlayers} selectionMode={selectionMode}
              onSelectionModeChange={setSelectionMode} players={players || []}
            />

            {allowCustomTest && (
              <div className="flex items-center gap-2">
                <Button
                  type="button" size="sm" variant={isCustom ? "default" : "outline"}
                  onClick={() => { setIsCustom(!isCustom); setSelectedGroup(""); setSelectedZone(""); setSelectedTest(""); setPlayerResults({}); setPlayerSecondaryResults({}); }}
                >
                  ✨ Test personnalisé
                </Button>
              </div>
            )}

            {!isCustom && (
              <HierarchicalTestSelector
                sportType={sportType || ""}
                selectedGroup={selectedGroup}
                selectedZone={selectedZone}
                selectedTest={selectedTest}
                onGroupChange={(g) => { setSelectedGroup(g); setSelectedZone(""); setSelectedTest(""); setPlayerResults({}); setPlayerSecondaryResults({}); }}
                onZoneChange={(z) => { setSelectedZone(z); setSelectedTest(""); setPlayerResults({}); setPlayerSecondaryResults({}); }}
                onTestChange={setSelectedTest}
              />
            )}

            {isCustom && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom du test *</Label>
                  <Input value={customTestName} onChange={(e) => setCustomTestName(e.target.value)} placeholder="Ex: Test de Cooper modifié" />
                </div>
                <div className="space-y-2">
                  <Label>Unité de mesure *</Label>
                  <Select value={customTestUnit} onValueChange={setCustomTestUnit}>
                    <SelectTrigger><SelectValue placeholder="Choisir l'unité" /></SelectTrigger>
                    <SelectContent className="z-[9999] max-h-[300px]">
                      {AVAILABLE_UNITS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Date du test *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            {effectivePlayers.length > 0 && ((isCustom && customTestName && customTestUnit) || selectedTest) && currentTest && (
              <div className="space-y-2">
                <Label>
                  Résultats {currentTest.unit && `(${isRatioTest && ratioInputMode === "kg" ? "kg soulevés → auto × PDC" : currentTest.unit})`}
                  {showSecondaryField && " + Vitesse barre (m/s, optionnel)"}
                  {" "}- {filledResultsCount}/{effectivePlayers.length} saisis
                </Label>

                {isRatioTest && (
                  <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="text-xs font-semibold">⚖️ Test en ratio du poids de corps</div>
                    <div className="flex gap-2">
                      <Button
                        type="button" size="sm"
                        variant={ratioInputMode === "kg" ? "default" : "outline"}
                        onClick={() => setRatioInputMode("kg")}
                      >
                        Saisir la charge (kg) → ratio auto
                      </Button>
                      <Button
                        type="button" size="sm"
                        variant={ratioInputMode === "ratio" ? "default" : "outline"}
                        onClick={() => setRatioInputMode("ratio")}
                      >
                        Saisir le ratio directement
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {ratioInputMode === "kg"
                        ? "La charge est divisée par le dernier poids anthropo enregistré. Le barème s'applique sur le ratio (× PDC)."
                        : "Saisis directement le ratio (ex: 1.5 = 1.5× le poids de corps)."}
                    </p>
                  </div>
                )}

                <ScrollArea className="max-h-[300px] border rounded-md">
                  <div className="p-3 space-y-2 bg-muted/30">
                    {effectivePlayers.map((player) => {
                      const gpsValues = showGpsPreview && playerResults[player.id]
                        ? computeSprintGpsValues(playerResults[player.id])
                        : null;
                      const pWeight = isRatioTest ? latestWeights?.[player.id] : undefined;
                      const rawKg = parseFloat(playerResults[player.id] || "");
                      const ratioPreview = (isRatioTest && ratioInputMode === "kg" && pWeight && !isNaN(rawKg))
                        ? Math.round((rawKg / pWeight) * 100) / 100
                        : null;

                      // Live barème note preview (based on athlete's positionGroup + gender)
                      const rawResult = parseFloat(playerResults[player.id] || "");
                      const scoredValue = (isRatioTest && ratioInputMode === "kg") ? (ratioPreview ?? NaN) : rawResult;
                      const noteInfo = (activeScoringScale && !isNaN(scoredValue))
                        ? {
                            range: findMatchingRange(scoredValue, activeScoringScale, playerScoringProfiles[player.id]),
                            pts: computePoints(scoredValue, activeScoringScale, playerScoringProfiles[player.id]),
                          }
                        : null;

                      return (
                        <div key={player.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm flex-1 truncate min-w-0">
                              {player.name}
                              {isRatioTest && (
                                <span className="ml-2 text-[11px] text-muted-foreground">
                                  {pWeight ? `(${pWeight} kg)` : <span className="text-destructive">⚠ poids manquant</span>}
                                </span>
                              )}
                            </span>
                            <Input
                              type="number" step="0.01"
                              value={playerResults[player.id] || ""}
                              onChange={(e) => updatePlayerResult(player.id, e.target.value)}
                              placeholder={isRatioTest ? (ratioInputMode === "kg" ? "kg" : "× PDC") : (currentTest.unit || "valeur")}
                              className="w-24 h-8 text-sm"
                            />
                            {ratioPreview !== null && (
                              <span className="text-[11px] font-semibold text-primary whitespace-nowrap">
                                = {ratioPreview}× PDC
                              </span>
                            )}
                            {showSecondaryField && (
                              <Input
                                type="number" step="0.01"
                                value={playerSecondaryResults[player.id] || ""}
                                onChange={(e) => updatePlayerSecondaryResult(player.id, e.target.value)}
                                placeholder="m/s"
                                className="w-20 h-8 text-sm" 
                              />
                            )}
                          </div>
                          {noteInfo && noteInfo.range && (
                            <div className="flex items-center gap-2 ml-4 text-[11px]">
                              <Badge variant="secondary" className="font-semibold">
                                {noteInfo.range.label || `${noteInfo.pts} pt${noteInfo.pts > 1 ? "s" : ""}`}
                                {noteInfo.range.label && <span className="ml-1 opacity-70">· {noteInfo.pts} pt{noteInfo.pts > 1 ? "s" : ""}</span>}
                              </Badge>
                              <span className="text-muted-foreground italic">
                                {playerScoringProfiles[player.id]?.positionGroup
                                  ? `barème ${getPositionGroupsForSport(sportType).find(g => g.id === playerScoringProfiles[player.id]?.positionGroup)?.label || "poste"}`
                                  : "barème par défaut"}
                              </span>
                            </div>
                          )}
                          {/* GPS preview for sprint tests */}
                          {gpsValues && (
                            <div className="flex items-center gap-3 ml-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Gauge className="h-3 w-3 text-primary" />
                                Vmax: <strong className="text-foreground">{gpsValues.vmaxKmh} km/h</strong>
                              </span>
                              <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3 text-accent-foreground" />
                                Accel: <strong className="text-foreground">{gpsValues.accelMax} m/s²</strong>
                              </span>
                              <span className="flex items-center gap-1">
                                <Timer className="h-3 w-3 text-primary" />
                                {playerResults[player.id]}s
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {isSprintTest && sprintDistance && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                <Checkbox
                  id="save-gps-vmax"
                  checked={saveAsGpsVmax}
                  onCheckedChange={(checked) => setSaveAsGpsVmax(!!checked)}
                />
                <label htmlFor="save-gps-vmax" className="flex items-center gap-2 text-sm cursor-pointer">
                  <Gauge className="h-4 w-4 text-primary" />
                  <span>
                    <strong>Sauvegarder comme Vmax GPS</strong>
                    <span className="text-muted-foreground ml-1">
                      — Calcul automatique de la vitesse max ({sprintDistance}m) pour la Data GPS
                    </span>
                  </span>
                </label>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditions du test, remarques..." rows={2} />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={() => addTests.mutate()}
            disabled={(!selectedTest && !(isCustom && customTestName && customTestUnit)) || !date || filledResultsCount === 0 || addTests.isPending}
          >
            {addTests.isPending ? "Ajout..." : `Ajouter ${filledResultsCount} test${filledResultsCount > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
