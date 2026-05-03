import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  computePoints, findMatchingRange, getLevelForPercent, type ScoringScale, type BatteryLevel,
  type PlayerForScoring,
} from "@/lib/constants/testUnits";
import { getPositionGroupsForSport, playerBelongsToGroup } from "@/lib/constants/sportPositionGroups";
import { toast } from "sonner";

interface RunBatteryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batteryId: string;
  categoryId: string;
}

export function RunBatteryDialog({ open, onOpenChange, batteryId, categoryId }: RunBatteryDialogProps) {
  const queryClient = useQueryClient();
  const [playerId, setPlayerIdState] = useState<string>("");
  const [resultsByPlayer, setResultsByPlayer] = useState<Record<string, Record<string, string>>>({});
  const [savedPlayerIds, setSavedPlayerIds] = useState<Set<string>>(new Set());
  const setResults = (updater: (prev: Record<string, string>) => Record<string, string>) => {
    if (!playerId) return;
    setResultsByPlayer(prev => ({ ...prev, [playerId]: updater(prev[playerId] || {}) }));
  };
  const setPlayerId = (id: string) => setPlayerIdState(id);
  const [savedDate] = useState(() => new Date().toISOString().split("T")[0]);

  const buildBaseTestType = (testName: string) => `custom_${testName?.toLowerCase().replace(/\s+/g, "_")}`;

  const { data: battery } = useQuery({
    queryKey: ["test-battery-full", batteryId],
    queryFn: async () => {
      const { data: b } = await supabase.from("test_batteries").select("*").eq("id", batteryId).single();
      const { data: items } = await supabase
        .from("test_battery_items")
        .select("*, custom_tests(bilateral)")
        .eq("battery_id", batteryId)
        .order("position");
      const normalized = (items || []).map((it: any) => ({
        ...it,
        bilateral: it.custom_tests?.bilateral ?? false,
      }));
      return { battery: b, items: normalized };
    },
    enabled: open && !!batteryId,
  });

  const { data: players } = useQuery({
    queryKey: ["players-min-scoring", categoryId],
    queryFn: async () => {
      const { data } = await supabase
        .from("players_safe")
        .select("id, name, first_name, position, gender")
        .eq("category_id", categoryId)
        .order("name");
      return data || [];
    },
    enabled: open,
  });

  const { data: categoryInfo } = useQuery({
    queryKey: ["category-sport-gender", categoryId],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("sport_type, gender")
        .eq("id", categoryId)
        .maybeSingle();
      return data;
    },
    enabled: open,
  });

  const { data: savedRows = [] } = useQuery({
    queryKey: ["battery-saved-results", batteryId, categoryId, playerId, savedDate],
    queryFn: async () => {
      if (!playerId || !battery?.battery?.name) return [];
      const { data, error } = await supabase
        .from("generic_tests")
        .select("player_id, test_type, result_value, notes")
        .eq("player_id", playerId)
        .eq("category_id", categoryId)
        .eq("test_date", savedDate)
        .ilike("notes", `[Batterie: ${battery.battery.name}]%`);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!playerId && !!battery?.battery?.name,
  });

  // Pre-load: which athletes already have results saved for this battery (any date)
  const { data: alreadySavedPlayerIds = [] } = useQuery({
    queryKey: ["battery-saved-players", batteryId, categoryId, battery?.battery?.name],
    queryFn: async () => {
      if (!battery?.battery?.name) return [];
      const { data, error } = await supabase
        .from("generic_tests")
        .select("player_id")
        .eq("category_id", categoryId)
        .ilike("notes", `[Batterie: ${battery.battery.name}]%`);
      if (error) throw error;
      return Array.from(new Set((data || []).map((r: any) => r.player_id))) as string[];
    },
    enabled: open && !!battery?.battery?.name,
  });

  const savedResults = useMemo(() => {
    const mapped: Record<string, string> = {};
    (battery?.items || []).forEach((it: any) => {
      const baseTestType = buildBaseTestType(it.test_name);
      if (it.bilateral) {
        const right = savedRows.find((row: any) => row.test_type === `${baseTestType}__right` || row.notes?.includes(`${it.test_name} (Droit)`));
        const left = savedRows.find((row: any) => row.test_type === `${baseTestType}__left` || row.notes?.includes(`${it.test_name} (Gauche)`));
        if (right?.result_value !== null && right?.result_value !== undefined) mapped[`${it.id}__R`] = String(right.result_value);
        if (left?.result_value !== null && left?.result_value !== undefined) mapped[`${it.id}__L`] = String(left.result_value);
      } else {
        const row = savedRows.find((saved: any) => saved.test_type === baseTestType || saved.notes?.includes(`Test: ${it.test_name} ·`));
        if (row?.result_value !== null && row?.result_value !== undefined) mapped[it.id] = String(row.result_value);
      }
    });
    return mapped;
  }, [battery?.items, savedRows]);

  const results = resultsByPlayer[playerId] ?? savedResults;

  const sportType = (categoryInfo as any)?.sport_type as string | undefined;
  const categoryGender = (categoryInfo as any)?.gender as string | undefined;

  const selectedPlayer: PlayerForScoring | null = useMemo(() => {
    if (!playerId) return null;
    const p = (players || []).find((pl: any) => pl.id === playerId) as any;
    if (!p) return null;
    const groups = getPositionGroupsForSport(sportType);
    const group = groups.find(g => playerBelongsToGroup(p.position, g));
    // Prefer the player's own gender, fall back to the category gender for compatibility
    let gender: string | null = null;
    const raw = (p.gender || categoryGender || "").toString().toLowerCase();
    if (raw === "male" || raw === "masculine" || raw === "men") gender = "male";
    else if (raw === "female" || raw === "feminine" || raw === "women") gender = "female";
    return {
      gender,
      position: p.position || null,
      positionGroup: group?.id || null,
    };
  }, [playerId, players, sportType, categoryGender]);

  const totalMax = useMemo(
    () => (battery?.items || []).reduce((s, it: any) => s + (Number(it.max_points) || 0), 0),
    [battery]
  );

  const { totalPoints, perItem } = useMemo(() => {
    let total = 0;
    const per: Record<string, { points: number; matchedLabel?: string; pointsR?: number; pointsL?: number; matchedLabelR?: string; matchedLabelL?: string }> = {};
    (battery?.items || []).forEach((it: any) => {
      if (it.bilateral) {
        const rawR = results[`${it.id}__R`];
        const rawL = results[`${it.id}__L`];
        const vR = rawR === undefined || rawR === "" ? null : parseFloat(rawR);
        const vL = rawL === undefined || rawL === "" ? null : parseFloat(rawL);
        const ptsR = computePoints(vR, it.scoring_scale as ScoringScale, selectedPlayer);
        const ptsL = computePoints(vL, it.scoring_scale as ScoringScale, selectedPlayer);
        const mR = findMatchingRange(vR, it.scoring_scale as ScoringScale, selectedPlayer);
        const mL = findMatchingRange(vL, it.scoring_scale as ScoringScale, selectedPlayer);
        per[it.id] = {
          points: ptsR + ptsL,
          pointsR: ptsR,
          pointsL: ptsL,
          matchedLabelR: mR?.label,
          matchedLabelL: mL?.label,
        };
        total += ptsR + ptsL;
      } else {
        const raw = results[it.id];
        const v = raw === undefined || raw === "" ? null : parseFloat(raw);
        const pts = computePoints(v, it.scoring_scale as ScoringScale, selectedPlayer);
        const matched = findMatchingRange(v, it.scoring_scale as ScoringScale, selectedPlayer);
        per[it.id] = { points: pts, matchedLabel: matched?.label };
        total += pts;
      }
    });
    return { totalPoints: total, perItem: per };
  }, [battery, results, selectedPlayer]);

  const percent = totalMax > 0 ? Math.round((totalPoints / totalMax) * 100) : 0;
  const level = useMemo(
    () => getLevelForPercent(percent, (battery?.battery?.levels as unknown as BatteryLevel[]) || undefined),
    [percent, battery]
  );

  const handleSave = async () => {
    if (!playerId) return toast.error("Sélectionnez un athlète");
    if (!battery) return;

    const rows: any[] = [];
    (battery.items as any[]).forEach((it) => {
      const baseTestType = buildBaseTestType(it.test_name);
      if (it.bilateral) {
        const rawR = results[`${it.id}__R`];
        const rawL = results[`${it.id}__L`];
        if (rawR !== undefined && rawR !== "") {
          rows.push({
            player_id: playerId,
            category_id: categoryId,
            test_category: it.test_category,
            test_type: `${baseTestType}__right`,
            result_value: parseFloat(rawR),
            result_unit: it.unit || null,
            test_date: savedDate,
            notes: `[Batterie: ${battery.battery.name}] Test: ${it.test_name} (Droit) · Score ${perItem[it.id]?.pointsR ?? 0} pts`,
          });
        }
        if (rawL !== undefined && rawL !== "") {
          rows.push({
            player_id: playerId,
            category_id: categoryId,
            test_category: it.test_category,
            test_type: `${baseTestType}__left`,
            result_value: parseFloat(rawL),
            result_unit: it.unit || null,
            test_date: savedDate,
            notes: `[Batterie: ${battery.battery.name}] Test: ${it.test_name} (Gauche) · Score ${perItem[it.id]?.pointsL ?? 0} pts`,
          });
        }
      } else if (results[it.id] !== undefined && results[it.id] !== "") {
        rows.push({
          player_id: playerId,
          category_id: categoryId,
          test_category: it.test_category,
          test_type: baseTestType,
          result_value: parseFloat(results[it.id]),
          result_unit: it.unit || null,
          test_date: savedDate,
          notes: `[Batterie: ${battery.battery.name}] Test: ${it.test_name} · Score ${perItem[it.id]?.points ?? 0}/${it.max_points} pts`,
        });
      }
    });

    if (rows.length === 0) return toast.error("Saisissez au moins un résultat");

    const { error: deleteError } = await supabase
      .from("generic_tests")
      .delete()
      .eq("player_id", playerId)
      .eq("category_id", categoryId)
      .eq("test_date", savedDate)
      .ilike("notes", `[Batterie: ${battery.battery.name}]%`);

    if (deleteError) return toast.error("Erreur : " + deleteError.message);

    const { error } = await supabase.from("generic_tests").insert(rows);
    if (error) return toast.error("Erreur : " + error.message);

    queryClient.invalidateQueries({ queryKey: ["generic_tests", categoryId] });
    queryClient.invalidateQueries({ queryKey: ["generic_tests_discovery", categoryId] });
    queryClient.invalidateQueries({ queryKey: ["generic-tests-evolution", categoryId] });
    queryClient.invalidateQueries({ queryKey: ["generic-tests-multi-comparison", categoryId] });
    queryClient.invalidateQueries({ queryKey: ["battery-saved-results", batteryId, categoryId, playerId, savedDate] });

    toast.success(`Batterie enregistrée pour cet athlète : ${totalPoints}/${totalMax} pts (${level.label})`);
    setSavedPlayerIds(prev => new Set(prev).add(playerId));
    setResultsByPlayer(prev => ({ ...prev, [playerId]: results }));
  };

  if (!battery) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] grid grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{battery.battery.name}</DialogTitle>
          <DialogDescription>{battery.battery.description || "Saisissez les résultats de l'athlète."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Athlète</Label>
          <Select value={playerId} onValueChange={setPlayerId}>
            <SelectTrigger><SelectValue placeholder="Choisir un athlète..." /></SelectTrigger>
            <SelectContent>
              {(players || []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.first_name ? `${p.first_name} ${p.name}` : p.name}
                  {(savedPlayerIds.has(p.id) || alreadySavedPlayerIds.includes(p.id)) ? " ✓" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Le bouton d’enregistrement sauvegarde uniquement les résultats de l’athlète sélectionné.
          </p>
        </div>

        <ScrollArea className="min-h-0 pr-3">
          <div className="space-y-2 py-2">
            {(battery.items as any[]).map((it, idx) => {
              const r = perItem[it.id];
              return (
                <div key={it.id} className="rounded-2xl border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">
                        {idx + 1}. {it.test_name}
                        {it.bilateral && (
                          <Badge variant="outline" className="ml-2 text-[10px]">Bilatéral</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {it.test_category} • Max {it.max_points} pts
                      </div>
                    </div>
                    <Badge variant={r?.points ? "default" : "secondary"}>
                      {r?.points ?? 0} / {it.max_points} pts
                    </Badge>
                  </div>
                  {it.bilateral ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Côté droit</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={`Droit (${it.unit || "valeur"})`}
                            value={results[`${it.id}__R`] ?? ""}
                            onChange={e => setResults(prev => ({ ...prev, [`${it.id}__R`]: e.target.value }))}
                            className="flex-1"
                          />
                          <Badge variant="secondary" className="shrink-0">{r?.pointsR ?? 0} pts</Badge>
                        </div>
                        {r?.matchedLabelR && (
                          <Badge variant="outline" className="text-[10px]">{r.matchedLabelR}</Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Côté gauche</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={`Gauche (${it.unit || "valeur"})`}
                            value={results[`${it.id}__L`] ?? ""}
                            onChange={e => setResults(prev => ({ ...prev, [`${it.id}__L`]: e.target.value }))}
                            className="flex-1"
                          />
                          <Badge variant="secondary" className="shrink-0">{r?.pointsL ?? 0} pts</Badge>
                        </div>
                        {r?.matchedLabelL && (
                          <Badge variant="outline" className="text-[10px]">{r.matchedLabelL}</Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={`Résultat (${it.unit || "valeur"})`}
                        value={results[it.id] ?? ""}
                        onChange={e => setResults(prev => ({ ...prev, [it.id]: e.target.value }))}
                        className="flex-1"
                      />
                      {r?.matchedLabel && (
                        <Badge variant="outline" className="shrink-0">{r.matchedLabel}</Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between rounded-2xl border-2 p-4 bg-gradient-to-r from-primary/10 to-primary/5"
          style={{ borderColor: level.color }}>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Score total</div>
            <div className="text-2xl font-bold">{totalPoints} / {totalMax} pts</div>
            <div className="text-sm text-muted-foreground">{percent}%</div>
          </div>
          <Badge className="text-lg px-4 py-2" style={{ backgroundColor: level.color, color: "white" }}>
            {level.label}
          </Badge>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave}>
            {playerId ? "Enregistrer cet athlète" : "Sélectionner puis enregistrer l’athlète"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
