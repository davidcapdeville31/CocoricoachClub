// Saisie lancer-par-lancer mobile-first, avec validation par paramètre / objectif et stats croisées.
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowRight, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TACTICAL_ZONES, zoneShort } from "@/lib/constants/bowlingTacticalZones";
import { summariseDeltas } from "@/lib/bowling/throwDeltas";
import {
  TECHNICAL_PARAMETERS,
  getParamLabel,
} from "@/lib/constants/bowlingTechnicalParameters";
import { TARGET_OUTCOMES, outcomeLabel } from "@/lib/constants/bowlingTargetOutcomes";
import { BowlingTechnicalBlockStats } from "@/components/bowling/stats/BowlingTechnicalBlockStats";

interface BlockRow {
  id: string;
  block_type: string;
  title: string;
  planned_throws: number | null;
  objectives: string[];
  config: any;
  pattern_id: string | null;
  coach_instruction: string | null;
  athlete_id: string | null;
  category_id: string;
}

interface Props {
  block: BlockRow;
  playerId: string;
  categoryId: string;
  sessionDate: string;
  onClose: () => void;
}

interface ThrowDraft {
  ball_arsenal_id?: string | null;
  axis_success?: boolean | null;
  speed_success?: boolean | null;
  breakpoint_success?: boolean | null;
  pocket_success?: boolean | null;
  strike_success?: boolean | null;
  spare_success?: boolean | null;
  target_zone?: string | null;
  actual_zone?: string | null;
  foot_board?: number | null;
  breakpoint_board?: number | null;
  speed_kmh?: number | null;
  comment?: string | null;
  parameter_results?: Record<string, boolean>;
  outcome_results?: Record<string, boolean>;
}

const YesNoBtn = ({
  label,
  value,
  onChange,
  dense,
}: {
  label: string;
  value: boolean | null | undefined;
  onChange: (v: boolean) => void;
  dense?: boolean;
}) => (
  <div className="flex flex-col gap-1">
    <Label className={cn("text-[11px] text-muted-foreground truncate", dense && "text-[10px]")}>{label}</Label>
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          "flex-1 h-9 rounded-md text-xs font-semibold border transition-all flex items-center justify-center gap-1",
          value === true
            ? "bg-emerald-500 text-white border-emerald-600 shadow-md"
            : "bg-background hover:bg-muted border-border",
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          "flex-1 h-9 rounded-md text-xs font-semibold border transition-all flex items-center justify-center gap-1",
          value === false
            ? "bg-rose-500 text-white border-rose-600 shadow-md"
            : "bg-background hover:bg-muted border-border",
        )}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);

// Mapping paramètre technique → champ booléen historique (pour rétro-compatibilité stats)
function legacyParamField(paramValue: string): keyof ThrowDraft | null {
  const group = TECHNICAL_PARAMETERS.find((p) => p.value === paramValue)?.group;
  switch (group) {
    case "axis":
      return "axis_success";
    case "speed":
      return "speed_success";
    default:
      return null;
  }
}

function legacyOutcomeField(outcomeValue: string): keyof ThrowDraft | null {
  const o = TARGET_OUTCOMES.find((x) => x.value === outcomeValue);
  return (o?.field as keyof ThrowDraft) || null;
}

export function BowlingBlockRunner({ block, playerId, categoryId, sessionDate, onClose }: Props) {
  const qc = useQueryClient();
  const isTactical = block.block_type === "tactical";
  const isTechnical = block.block_type === "technical";

  const selectedParams: string[] = useMemo(
    () => (Array.isArray(block.config?.parameters) ? block.config.parameters : []),
    [block.config],
  );
  const selectedOutcomes: string[] = useMemo(
    () => (Array.isArray(block.objectives) ? block.objectives : []),
    [block.objectives],
  );

  const { data: throws = [] } = useQuery({
    queryKey: ["bowling_throw_results", block.id, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bowling_throw_results")
        .select("*")
        .eq("block_id", block.id)
        .eq("athlete_id", playerId)
        .order("throw_number", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: balls = [] } = useQuery({
    queryKey: ["player_bowling_arsenal", playerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("player_bowling_arsenal")
        .select("id, custom_ball_name")
        .eq("player_id", playerId);
      return data || [];
    },
  });

  const [draft, setDraft] = useState<ThrowDraft>({ parameter_results: {}, outcome_results: {} });
  const nextThrowNumber = (throws[throws.length - 1]?.throw_number || 0) + 1;
  const target = block.planned_throws || 0;
  const progress = target > 0 ? Math.min(100, Math.round((throws.length / target) * 100)) : 0;

  const setParamResult = (param: string, v: boolean) => {
    const next = { ...(draft.parameter_results || {}), [param]: v };
    // miroir vers champ legacy si applicable (seul le premier param du groupe écrit le champ)
    const legacy = legacyParamField(param);
    setDraft({ ...draft, parameter_results: next, ...(legacy ? { [legacy]: v } : {}) });
  };

  const setOutcomeResult = (outcome: string, v: boolean) => {
    const next = { ...(draft.outcome_results || {}), [outcome]: v };
    const legacy = legacyOutcomeField(outcome);
    setDraft({ ...draft, outcome_results: next, ...(legacy ? { [legacy]: v } : {}) });
  };

  const saveThrow = useMutation({
    mutationFn: async () => {
      const paramResults = draft.parameter_results || {};
      const outcomeResults = draft.outcome_results || {};
      const anyOutcomeOk = Object.values(outcomeResults).some((v) => v === true);
      const allParamOk =
        selectedParams.length > 0 && selectedParams.every((p) => paramResults[p] === true);
      const payload = {
        ...draft,
        parameter_results: paramResults,
        outcome_results: outcomeResults,
        throw_number: nextThrowNumber,
        exercise_index: 0,
        success_global:
          draft.pocket_success === true ||
          draft.strike_success === true ||
          draft.spare_success === true ||
          anyOutcomeOk ||
          (isTechnical && allParamOk),
      };
      const { data, error } = await supabase.functions.invoke("athlete-bowling-training", {
        body: {
          action: "save_throw",
          category_id: categoryId,
          player_id: playerId,
          session_date: sessionDate,
          block_id: block.id,
          throw_payload: payload,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Erreur");
      return data;
    },
    onSuccess: (data) => {
      const deltas = summariseDeltas(data?.throw?.foot_delta, data?.throw?.breakpoint_delta);
      if (deltas) toast.success(`Lancer ${nextThrowNumber} · ${deltas}`);
      else toast.success(`Lancer ${nextThrowNumber} enregistré`);
      // Conserve les paramètres "récurrents" (boule, zone, lattes, vitesse) pour
      // pré-remplir automatiquement le lancer suivant. L'athlète peut les modifier
      // à tout moment et les nouvelles valeurs s'appliqueront aux lancers suivants.
      setDraft({
        ball_arsenal_id: draft.ball_arsenal_id,
        actual_zone: draft.actual_zone,
        foot_board: draft.foot_board,
        breakpoint_board: draft.breakpoint_board,
        speed_kmh: draft.speed_kmh,
        parameter_results: {},
        outcome_results: {},
      });
      qc.invalidateQueries({ queryKey: ["bowling_throw_results", block.id, playerId] });
    },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const removeLast = useMutation({
    mutationFn: async () => {
      const last = throws[throws.length - 1];
      if (!last) return;
      const { error } = await supabase.from("bowling_throw_results").delete().eq("id", last.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bowling_throw_results", block.id, playerId] }),
  });

  const finish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("athlete-bowling-training", {
        body: { action: "complete_block", category_id: categoryId, player_id: playerId, session_date: sessionDate, block_id: block.id },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Bloc terminé");
      onClose();
    },
  });




  return (
    <div className="space-y-3">
      <Card className="p-3 bg-gradient-to-br from-primary/8 to-primary/2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="font-semibold text-sm">{block.title}</p>
          <Badge variant="outline" className="text-[10px]">{throws.length}/{target || "∞"} lancers</Badge>
        </div>
        {block.coach_instruction && <p className="text-xs text-muted-foreground italic">{block.coach_instruction}</p>}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <Card className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Lancer #{nextThrowNumber}</p>
          {throws.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => removeLast.mutate()}>
              <Undo2 className="h-3.5 w-3.5 mr-1" /> Annuler dernier
            </Button>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Boule utilisée</Label>
          <Select
            value={draft.ball_arsenal_id || "__none__"}
            onValueChange={(v) => setDraft({ ...draft, ball_arsenal_id: v === "__none__" ? null : v })}
          >
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choisir une boule" /></SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="__none__" className="italic text-xs">Non renseigné</SelectItem>
              {balls.map((b: any) => (
                <SelectItem key={b.id} value={b.id} className="text-xs">
                  {b.custom_ball_name || "Boule"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isTactical && (() => {
          const blockZones: string[] = Array.isArray(block.config?.zones) ? block.config.zones : [];
          const throwsByZone: Record<string, number> = block.config?.throws_by_zone || {};
          const doneByZone = throws.reduce<Record<string, number>>((acc, t: any) => {
            const z = t.actual_zone || t.target_zone;
            if (z) acc[z] = (acc[z] || 0) + 1;
            return acc;
          }, {});
          const zoneOptions = blockZones.length > 0
            ? blockZones.map((z) => TACTICAL_ZONES.find((tz) => tz.value === z) || { value: z, label: z, short: z })
            : TACTICAL_ZONES;
          return (
            <>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  Zone jouée
                  {blockZones.length > 0 && (
                    <span className="ml-1 italic text-[10px]">(zones prévues dans la séance)</span>
                  )}
                </Label>
                {blockZones.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {zoneOptions.map((z: any) => {
                      const planned = throwsByZone[z.value] || 0;
                      const done = doneByZone[z.value] || 0;
                      const active = draft.actual_zone === z.value;
                      const full = planned > 0 && done >= planned;
                      return (
                        <button
                          key={z.value}
                          type="button"
                          onClick={() => setDraft({ ...draft, actual_zone: z.value })}
                          className={cn(
                            "px-2 py-1.5 rounded-md text-xs border transition-all text-left",
                            active
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : full
                                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                                : "bg-background hover:bg-muted border-border",
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold">{z.short || z.label}</span>
                            {planned > 0 && (
                              <span className={cn("text-[10px] font-mono", active ? "opacity-90" : "text-muted-foreground")}>
                                {done}/{planned}
                              </span>
                            )}
                          </div>
                          {z.label && z.short && z.label !== z.short && (
                            <span className="block text-[10px] opacity-75 truncate">{z.label}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Select value={draft.actual_zone || ""} onValueChange={(v) => setDraft({ ...draft, actual_zone: v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choisir une zone" /></SelectTrigger>
                    <SelectContent className="z-[100]">
                      {TACTICAL_ZONES.map((z) => (
                        <SelectItem key={z.value} value={z.value} className="text-xs">{z.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Latte au pied</Label>
                  <Input
                    type="number"
                    value={draft.foot_board ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, foot_board: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Point de sortie (latte)</Label>
                  <Input
                    type="number"
                    value={draft.breakpoint_board ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        breakpoint_board: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </>
          );
        })()}

        {/* === Validation par paramètre technique sélectionné === */}
        {isTechnical && selectedParams.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-surface-sunken p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Critères techniques
              </Label>
              <Badge variant="outline" className="text-[10px]">
                {Object.values(draft.parameter_results || {}).filter((v) => v === true).length}/
                {selectedParams.length} OK
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {selectedParams.map((p) => (
                <YesNoBtn
                  key={p}
                  label={getParamLabel(p)}
                  value={(draft.parameter_results || {})[p]}
                  onChange={(v) => setParamResult(p, v)}
                  dense
                />
              ))}
            </div>
          </div>
        )}

        {/* === Validation par objectif de résultat sélectionné === */}
        {selectedOutcomes.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-surface-sunken p-3 space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Objectifs de résultat
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {selectedOutcomes.map((o) => (
                <YesNoBtn
                  key={o}
                  label={outcomeLabel(o)}
                  value={(draft.outcome_results || {})[o]}
                  onChange={(v) => setOutcomeResult(o, v)}
                  dense
                />
              ))}
            </div>
          </div>
        )}

        {/* Fallback : aucun critère/objectif défini → grille générique */}
        {isTechnical && selectedParams.length === 0 && selectedOutcomes.length === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <YesNoBtn label="Axe respecté" value={draft.axis_success} onChange={(v) => setDraft({ ...draft, axis_success: v })} />
            <YesNoBtn label="Poche" value={draft.pocket_success} onChange={(v) => setDraft({ ...draft, pocket_success: v })} />
            <YesNoBtn label="Strike" value={draft.strike_success} onChange={(v) => setDraft({ ...draft, strike_success: v })} />
            <YesNoBtn label="Spare" value={draft.spare_success} onChange={(v) => setDraft({ ...draft, spare_success: v })} />
            <YesNoBtn label="Point de sortie" value={draft.breakpoint_success} onChange={(v) => setDraft({ ...draft, breakpoint_success: v })} />
            <YesNoBtn label="Vitesse cible" value={draft.speed_success} onChange={(v) => setDraft({ ...draft, speed_success: v })} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Vitesse (km/h, optionnel)</Label>
            <Input
              type="number"
              step="0.1"
              value={draft.speed_kmh ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, speed_kmh: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Commentaire</Label>
            <Input
              value={draft.comment ?? ""}
              onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
              className="h-9 text-xs"
            />
          </div>
        </div>

        <Button onClick={() => saveThrow.mutate()} disabled={saveThrow.isPending} className="w-full h-11 text-base">
          Lancer suivant <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </Card>

      {/* === Stats avancées du bloc en temps réel === */}
      {isTechnical && throws.length > 0 && (selectedParams.length > 0 || selectedOutcomes.length > 0) && (
        <BowlingTechnicalBlockStats
          throws={throws as any}
          selectedParams={selectedParams}
          selectedOutcomes={selectedOutcomes}
        />
      )}

      {throws.length > 0 && (
        <Card className="p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Historique ({throws.length})</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {throws.map((t: any) => {
              const paramsOk = selectedParams.filter((p) => t.parameter_results?.[p] === true).length;
              const outcomesOk = selectedOutcomes.filter((o) => t.outcome_results?.[o] === true).length;
              return (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px] w-8 justify-center">{t.throw_number}</Badge>
                  <div className="flex flex-wrap gap-1 flex-1">
                    {t.actual_zone && <Badge variant="secondary" className="text-[10px]">{zoneShort(t.actual_zone)}</Badge>}
                    {selectedParams.length > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        Critères {paramsOk}/{selectedParams.length}
                      </Badge>
                    )}
                    {selectedOutcomes.length > 0 && (
                      <Badge
                        className={cn(
                          "text-[10px]",
                          outcomesOk === selectedOutcomes.length
                            ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                            : "bg-muted text-muted-foreground border-border",
                        )}
                      >
                        Objectifs {outcomesOk}/{selectedOutcomes.length}
                      </Badge>
                    )}
                    {t.pocket_success && selectedOutcomes.length === 0 && (
                      <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Poche</Badge>
                    )}
                    {t.strike_success && selectedOutcomes.length === 0 && (
                      <Badge className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30">Strike</Badge>
                    )}
                    {t.spare_success && selectedOutcomes.length === 0 && (
                      <Badge className="text-[10px] bg-blue-500/15 text-blue-700 border-blue-500/30">Spare</Badge>
                    )}
                  </div>
                  {summariseDeltas(t.foot_delta, t.breakpoint_delta) && (
                    <span className="text-[10px] text-muted-foreground italic">
                      {summariseDeltas(t.foot_delta, t.breakpoint_delta)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex gap-2 sticky bottom-0">
        <Button variant="outline" className="flex-1" onClick={onClose}>Fermer</Button>
        <Button className="flex-1" onClick={() => finish.mutate()} disabled={finish.isPending}>
          <Save className="h-4 w-4 mr-1" /> Terminer le bloc
        </Button>
      </div>
    </div>
  );
}
