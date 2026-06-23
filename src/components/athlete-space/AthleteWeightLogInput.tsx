import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dumbbell, Lock, Plus, Trash2, Zap, Check, SkipForward, Wrench } from "lucide-react";
import { resolveSessionExerciseRows } from "@/lib/utils/sessionExercises";
import { cn } from "@/lib/utils";
import { ReadOnlyMethodCard } from "@/components/program-builder-v2/ReadOnlyMethodCard";
import { parseV2MethodConfig } from "@/lib/program-builder-v2/parseV2MethodConfig";
import { getMethodColors } from "@/components/program-builder-v2/shared/MethodGroupWrapper";

// ============= Notes encoding (status + comment in a single `notes` column) =============
const STATUS_TAGS: Record<"skipped" | "adapted", string> = {
  skipped: "[NON FAIT]",
  adapted: "[ADAPTÉ]",
};

export function parseNotesStatus(notes: string | null): {
  status: "done" | "skipped" | "adapted";
  comment: string;
} {
  if (!notes) return { status: "done", comment: "" };
  const trimmed = notes.trim();
  if (trimmed.startsWith(STATUS_TAGS.skipped)) {
    return { status: "skipped", comment: trimmed.slice(STATUS_TAGS.skipped.length).trim() };
  }
  if (trimmed.startsWith(STATUS_TAGS.adapted)) {
    return { status: "adapted", comment: trimmed.slice(STATUS_TAGS.adapted.length).trim() };
  }
  return { status: "done", comment: trimmed };
}

export function encodeNotesStatus(
  status: "done" | "skipped" | "adapted" | undefined,
  comment: string | undefined,
): string | null {
  const c = (comment || "").trim();
  if (status === "skipped") return c ? `${STATUS_TAGS.skipped} ${c}` : STATUS_TAGS.skipped;
  if (status === "adapted") return c ? `${STATUS_TAGS.adapted} ${c}` : STATUS_TAGS.adapted;
  return c || null;
}

/**
 * Compute the number of "rounds/series" the athlete should fill for an exercise,
 * based on its method + V2 config (parsed from notes) + prescribed sets.
 * Returns the count and the label prefix to display ("Tour", "Round", "Série").
 */
function getPrescribedRounds(
  method: string,
  ex: any,
): { count: number; label: string } {
  const parsed = parseV2MethodConfig(ex?.notes ?? null);
  const cfg = parsed?.config ?? {};

  if (method === "circuit") {
    const n = Number(cfg.repsPerRound) || 0;
    if (n > 0) return { count: n, label: "Tour" };
  }
  if (method === "emom") {
    const e = cfg.emomConfig;
    if (e?.totalMinutes && e?.intervalMinutes) {
      const n = Math.max(1, Math.floor(Number(e.totalMinutes) / Number(e.intervalMinutes)));
      return { count: n, label: "Round" };
    }
  }
  if (method === "tabata") {
    const n = Number(cfg.tabataConfig?.rounds) || 0;
    if (n > 0) return { count: n, label: "Round" };
  }
  if (method === "five_by_five") {
    return { count: 5, label: "Série" };
  }

  const prescribed = Number(ex?.sets) || 0;
  if (prescribed > 1) return { count: prescribed, label: "Série" };
  return { count: 1, label: "Série" };
}

export type ExerciseStatus = "done" | "skipped" | "adapted";

type CommonExerciseFields = {
  status?: ExerciseStatus;
  comment?: string;
};

export type WeightLogQuickEntry = CommonExerciseFields & {
  mode: "quick";
  weight: string;
  sets: string;
  reps: string;
};

export type WeightLogDetailedEntry = CommonExerciseFields & {
  mode: "detailed";
  seriesLabel?: string; // "Série" | "Tour" | "Round"
  series: Array<{ weight: string; reps: string }>;
};

// Auto mode for special methods (drop set, cluster, rest-pause, pyramid).
// Each sub-entry has its own weight + reps. Read-only structure (count fixed by prescription).
export type WeightLogSpecialEntry = CommonExerciseFields & {
  mode: "special";
  method: string; // drop_set, cluster, rest_pause, pyramid_up, pyramid_down, pyramid_full
  series: Array<{ weight: string; reps: string; label?: string }>;
};

export type WeightLogEntry = WeightLogQuickEntry | WeightLogDetailedEntry | WeightLogSpecialEntry;

export type WeightLogState = Record<string, WeightLogEntry>;


interface Props {
  sessionId: string;
  playerId: string;
  value: WeightLogState;
  onChange: (next: WeightLogState) => void;
}

const SPECIAL_AUTO_METHODS = new Set([
  "drop_set",
  "cluster",
  "rest_pause",
  "pyramid_up",
  "pyramid_down",
  "pyramid_full",
]);

const METHOD_LABELS: Record<string, string> = {
  drop_set: "Drop Set",
  cluster: "Cluster",
  rest_pause: "Rest-Pause",
  pyramid_up: "Pyramide ↑",
  pyramid_down: "Pyramide ↓",
  pyramid_full: "Pyramide complète",
};

/**
 * Build the initial special series from the prescribed drop_sets / cluster_sets
 * stored on the gym_session_exercises row.
 */
function buildSpecialSeries(
  method: string,
  baseWeight: number | null,
  dropSets: Array<{ reps: string | number; percentage: number }> | null,
  clusterSets: Array<{ reps: number; rest_seconds: number }> | null,
): WeightLogSpecialEntry["series"] {
  if (method === "cluster" && clusterSets && clusterSets.length > 0) {
    return clusterSets.map((s, i) => ({
      weight: baseWeight ? String(baseWeight) : "",
      reps: String(s.reps ?? ""),
      label: `Cluster ${i + 1}`,
    }));
  }

  if (method === "rest_pause") {
    // Default 3 mini-sets at the same weight; user adjusts reps.
    return Array.from({ length: 3 }, (_, i) => ({
      weight: baseWeight ? String(baseWeight) : "",
      reps: "",
      label: i === 0 ? "Set" : `Reprise ${i}`,
    }));
  }

  // Drop set / pyramid: use prescribed drop_sets; weight = baseWeight * percentage / 100
  if (dropSets && dropSets.length > 0) {
    return dropSets.map((s, i) => {
      const w = baseWeight ? Math.round((baseWeight * (s.percentage / 100)) * 10) / 10 : null;
      return {
        weight: w ? String(w) : "",
        reps: String(s.reps ?? ""),
        label:
          method === "drop_set"
            ? i === 0 ? "Charge max" : `Drop ${i}`
            : `Niveau ${i + 1}`,
      };
    });
  }

  // Fallback for drop_set without prescription: 3 drops of -20% each
  if (method === "drop_set") {
    return Array.from({ length: 3 }, (_, i) => {
      const w = baseWeight ? Math.round((baseWeight * (1 - i * 0.2)) * 10) / 10 : null;
      return {
        weight: w ? String(w) : "",
        reps: "",
        label: i === 0 ? "Charge max" : `Drop ${i} (−${i * 20}%)`,
      };
    });
  }

  return [{ weight: baseWeight ? String(baseWeight) : "", reps: "", label: "Série" }];
}

export function AthleteWeightLogInput({ sessionId, playerId, value, onChange }: Props) {
  // Fetch prescribed exercises (now includes set_type, method, drop_sets, cluster_sets)
  const { data: rawExercises = [] } = useQuery({
    queryKey: ["athlete-weight-log-exercises", sessionId, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gym_session_exercises")
        .select("*")
        .eq("training_session_id", sessionId)
        .or(`player_id.eq.${playerId},player_id.is.null`)
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId && !!playerId,
  });

  const exercises = useMemo(
    () => resolveSessionExerciseRows(rawExercises, playerId),
    [rawExercises, playerId],
  );

  const { data: existingLogs = [] } = useQuery({
    queryKey: ["athlete-weight-log-existing", sessionId, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athlete_exercise_logs")
        .select("exercise_name, actual_weight_kg, actual_sets, actual_reps, notes")
        .eq("training_session_id", sessionId)
        .eq("player_id", playerId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId && !!playerId,
  });

  const existingByName = useMemo(() => {
    const map = new Map<string, { weight: number; sets: number | null; reps: number | null; notes: string | null; status: ExerciseStatus }>();
    existingLogs.forEach((l) => {
      const notes = (l as any).notes ?? null;
      const { status, comment } = parseNotesStatus(notes);
      map.set(l.exercise_name, {
        weight: Number(l.actual_weight_kg),
        sets: l.actual_sets,
        reps: l.actual_reps,
        notes: comment || null,
        status,
      });
    });
    return map;
  }, [existingLogs]);


  const gymExercises = useMemo(() => {
    const seen = new Set<string>();
    return exercises.filter((e: any) => {
      if (!e.exercise_name) return false;
      if (seen.has(e.exercise_name)) return false;
      seen.add(e.exercise_name);
      return true;
    });
  }, [exercises]);

  // Initialize entries — choose mode based on method
  useEffect(() => {
    if (gymExercises.length === 0) return;
    const next: WeightLogState = { ...value };
    let mutated = false;
    gymExercises.forEach((ex: any) => {
      if (existingByName.has(ex.exercise_name)) return;
      if (next[ex.exercise_name]) return;

      const method = (ex.method || ex.set_type || "normal") as string;
      const baseWeight = ex.weight_kg ? Number(ex.weight_kg) : null;

      if (SPECIAL_AUTO_METHODS.has(method)) {
        next[ex.exercise_name] = {
          mode: "special",
          method,
          series: buildSpecialSeries(
            method,
            baseWeight,
            ex.drop_sets as any,
            ex.cluster_sets as any,
          ),
        };
      } else {
        const { count, label } = getPrescribedRounds(method, ex);
        const repsStr = ex.reps ? String(ex.reps) : "";
        const weightStr = ex.weight_kg ? String(ex.weight_kg) : "";
        if (count > 1) {
          // Pre-create one row per prescribed round/série so the athlete can
          // log charge & reps individually for each tour.
          next[ex.exercise_name] = {
            mode: "detailed",
            seriesLabel: label,
            series: Array.from({ length: count }, () => ({
              weight: weightStr,
              reps: repsStr,
            })),
          };
        } else {
          next[ex.exercise_name] = {
            mode: "quick",
            weight: weightStr,
            sets: ex.sets ? String(ex.sets) : "3",
            reps: repsStr || "10",
          };
        }
      }
      mutated = true;
    });
    if (mutated) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymExercises.map((e: any) => e.exercise_name).join("|"), existingByName.size]);

  const updateEntry = (exerciseName: string, entry: WeightLogEntry) => {
    onChange({ ...value, [exerciseName]: entry });
  };

  const toggleMode = (exerciseName: string, ex?: any) => {
    const current = value[exerciseName];
    if (!current || current.mode === "special") return;
    if (current.mode === "quick") {
      const method = (ex?.method || ex?.set_type || "normal") as string;
      const { count, label } = ex
        ? getPrescribedRounds(method, ex)
        : { count: parseInt(current.sets) || 3, label: "Série" };
      const setsNum = count > 1 ? count : (parseInt(current.sets) || 3);
      updateEntry(exerciseName, {
        mode: "detailed",
        seriesLabel: label,
        series: Array.from({ length: setsNum }, () => ({
          weight: current.weight,
          reps: current.reps,
        })),
      });
    } else {
      const firstSerie = current.series[0] || { weight: "", reps: "" };
      updateEntry(exerciseName, {
        mode: "quick",
        weight: firstSerie.weight,
        sets: String(current.series.length),
        reps: firstSerie.reps,
      });
    }
  };


  if (gymExercises.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        <Dumbbell className="h-4 w-4 text-primary" />
        <Label className="text-sm font-semibold">Mes charges soulevées</Label>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {gymExercises.length} exercice{gymExercises.length > 1 ? "s" : ""}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Renseigne ce que tu as réellement soulevé pour alimenter ton tonnage.
      </p>

      {gymExercises.map((ex: any) => {
        const existing = existingByName.get(ex.exercise_name);
        const entry = value[ex.exercise_name];
        const method = (ex.method || ex.set_type || "normal") as string;
        const isSpecial = SPECIAL_AUTO_METHODS.has(method);

        if (existing) {
          const statusBadge =
            existing.status === "skipped"
              ? <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">Non fait</Badge>
              : existing.status === "adapted"
                ? <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">Adapté</Badge>
                : null;
          return (
            <div
              key={ex.exercise_name}
              className="rounded-md border border-muted bg-muted/40 p-2 opacity-80 space-y-1"
            >
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium flex-1 truncate">{ex.exercise_name}</span>
                {statusBadge}
                {existing.status !== "skipped" && (
                  <Badge variant="secondary" className="text-[10px]">
                    ✓ {existing.weight}kg {existing.sets ?? "–"}×{existing.reps ?? "–"}
                  </Badge>
                )}
              </div>
              {existing.notes && (
                <p className="text-[10px] text-muted-foreground italic pl-5 truncate">
                  « {existing.notes} »
                </p>
              )}
            </div>
          );
        }


        if (!entry) return null;

        const colors = getMethodColors(method);
        const hasV2Config = !!parseV2MethodConfig(ex.notes ?? null);

        return (
          <div
            key={ex.exercise_name}
            className={cn(
              "rounded-xl border-2 overflow-hidden shadow-sm",
              colors.border,
            )}
          >
            {/* Aperçu visuel identique au calendrier (couleurs + détails de la méthode) */}
            {hasV2Config && (
              <div className={cn("p-2", colors.bg)}>
                <ReadOnlyMethodCard exercise={ex as any} />
              </div>
            )}

            {/* Bandeau d'identification (si pas de carte v2 au-dessus) */}
            {!hasV2Config && (
              <div className={cn("flex items-center gap-2 px-3 py-2 border-b", colors.bg, colors.border)}>
                <Dumbbell className={cn("h-3.5 w-3.5 shrink-0", colors.text)} />
                <span className={cn("text-sm font-medium truncate flex-1", colors.text)}>
                  {ex.exercise_name}
                </span>
                {isSpecial && (
                  <Badge className={cn("text-white border-0 text-[10px] h-5 px-2 gap-1", colors.iconBg)}>
                    <Zap className="h-2.5 w-2.5" />
                    {METHOD_LABELS[method] || method}
                  </Badge>
                )}
                {ex.sets && ex.reps && !isSpecial && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    Prescrit : {ex.sets}×{ex.reps}
                    {ex.weight_kg ? ` @${ex.weight_kg}kg` : ""}
                  </span>
                )}
              </div>
            )}

            {/* Saisie des charges réelles */}
            <div className="p-2.5 space-y-2 bg-card">
              {/* Status pills (Fait / Adapté / Non fait) */}
              <div className="flex items-center gap-1 flex-wrap">
                <StatusPill
                  active={(entry.status ?? "done") === "done"}
                  onClick={() => updateEntry(ex.exercise_name, { ...entry, status: "done" })}
                  icon={<Check className="h-3 w-3" />}
                  label="Fait"
                  activeClass="bg-status-optimal/15 text-status-optimal border-status-optimal/40"
                />
                <StatusPill
                  active={entry.status === "adapted"}
                  onClick={() => updateEntry(ex.exercise_name, { ...entry, status: "adapted" })}
                  icon={<Wrench className="h-3 w-3" />}
                  label="Adapté"
                  activeClass="bg-warning/15 text-warning border-warning/40"
                />
                <StatusPill
                  active={entry.status === "skipped"}
                  onClick={() => updateEntry(ex.exercise_name, { ...entry, status: "skipped" })}
                  icon={<SkipForward className="h-3 w-3" />}
                  label="Non fait"
                  activeClass="bg-destructive/15 text-destructive border-destructive/40"
                />
                <div className="ml-auto" />
                {!isSpecial && entry.status !== "skipped" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMode(ex.exercise_name, ex)}
                    className="h-6 px-2 text-[10px]"
                  >
                    {entry.mode === "quick" ? "Détaillé" : "Rapide"}
                  </Button>
                )}
              </div>

              {entry.status !== "skipped" && (
                <>
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Mes charges réelles
                  </Label>

                  {entry.mode === "quick" && (
                    <QuickModeRow
                      entry={entry}
                      onChange={(e) => updateEntry(ex.exercise_name, e)}
                    />
                  )}

                  {entry.mode === "detailed" && (
                    <DetailedModeRows
                      entry={entry}
                      onChange={(e) => updateEntry(ex.exercise_name, e)}
                    />
                  )}

                  {entry.mode === "special" && (
                    <SpecialModeRows
                      entry={entry}
                      onChange={(e) => updateEntry(ex.exercise_name, e)}
                    />
                  )}
                </>
              )}

              {/* Per-exercise comment */}
              <Textarea
                value={entry.comment ?? ""}
                onChange={(e) => updateEntry(ex.exercise_name, { ...entry, comment: e.target.value })}
                placeholder={
                  entry.status === "skipped"
                    ? "Raison (douleur, fatigue, matériel manquant...)"
                    : entry.status === "adapted"
                      ? "Adaptation effectuée (charge réduite, variante...)"
                      : "Commentaire (optionnel)"
                }
                rows={2}
                maxLength={300}
                className="text-xs"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusPill({
  active,
  onClick,
  icon,
  label,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition",
        active ? activeClass : "border-border bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}


// ============= Sub-components =============

function QuickModeRow({
  entry,
  onChange,
}: {
  entry: WeightLogQuickEntry;
  onChange: (next: WeightLogQuickEntry) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Input
        type="number"
        step="0.5"
        placeholder="kg"
        className="h-8 w-16 text-xs"
        value={entry.weight}
        onChange={(e) => onChange({ ...entry, weight: e.target.value })}
      />
      <span className="text-xs text-muted-foreground">kg</span>
      <Input
        type="number"
        placeholder="Séries"
        className="h-8 w-16 text-xs ml-2"
        value={entry.sets}
        onChange={(e) => onChange({ ...entry, sets: e.target.value })}
      />
      <span className="text-xs text-muted-foreground">×</span>
      <Input
        type="number"
        placeholder="Reps"
        className="h-8 w-16 text-xs"
        value={entry.reps}
        onChange={(e) => onChange({ ...entry, reps: e.target.value })}
      />
      <span className="text-xs text-muted-foreground">reps</span>
    </div>
  );
}

function DetailedModeRows({
  entry,
  onChange,
}: {
  entry: WeightLogDetailedEntry;
  onChange: (next: WeightLogDetailedEntry) => void;
}) {
  return (
    <div className="space-y-1.5">
      {entry.series.map((serie, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground w-14 shrink-0">
            {(entry.seriesLabel || "Série")} {idx + 1}
          </span>
          <Input
            type="number"
            step="0.5"
            placeholder="kg"
            className="h-7 w-16 text-xs"
            value={serie.weight}
            onChange={(e) => {
              const next = [...entry.series];
              next[idx] = { ...next[idx], weight: e.target.value };
              onChange({ ...entry, series: next });
            }}
          />
          <span className="text-[10px] text-muted-foreground">kg ×</span>
          <Input
            type="number"
            placeholder="reps"
            className="h-7 w-20 text-xs"
            value={serie.reps}
            onChange={(e) => {
              const next = [...entry.series];
              next[idx] = { ...next[idx], reps: e.target.value };
              onChange({ ...entry, series: next });
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto"
            onClick={() => {
              if (entry.series.length <= 1) return;
              onChange({ ...entry, series: entry.series.filter((_, i) => i !== idx) });
            }}
            disabled={entry.series.length <= 1}
          >
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-[11px] w-full"
        onClick={() => {
          const last = entry.series[entry.series.length - 1] || { weight: "", reps: "" };
          onChange({ ...entry, series: [...entry.series, { ...last }] });
        }}
      >
        <Plus className="h-3 w-3 mr-1" />
        Ajouter une série
      </Button>
    </div>
  );
}

function SpecialModeRows({
  entry,
  onChange,
}: {
  entry: WeightLogSpecialEntry;
  onChange: (next: WeightLogSpecialEntry) => void;
}) {
  const helpText: Record<string, string> = {
    drop_set: "Charge max → drops à charge dégressive jusqu'à l'échec.",
    cluster: "Mini-séries entrecoupées de courtes pauses, charge identique.",
    rest_pause: "Set principal jusqu'à l'échec, puis reprises courtes après pause de 15 s.",
    pyramid_up: "Charge croissante × reps décroissantes.",
    pyramid_down: "Charge décroissante × reps croissantes.",
    pyramid_full: "Pyramide ascendante puis descendante.",
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground italic">
        {helpText[entry.method] || "Saisis le poids et les reps de chaque sous-série."}
      </p>
      {entry.series.map((serie, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground w-20 shrink-0 truncate">
            {serie.label || `Set ${idx + 1}`}
          </span>
          <Input
            type="number"
            step="0.5"
            placeholder="kg"
            className="h-7 w-16 text-xs"
            value={serie.weight}
            onChange={(e) => {
              const next = [...entry.series];
              next[idx] = { ...next[idx], weight: e.target.value };
              onChange({ ...entry, series: next });
            }}
          />
          <span className="text-[10px] text-muted-foreground">kg ×</span>
          <Input
            type="number"
            placeholder="reps"
            className="h-7 w-20 text-xs"
            value={serie.reps}
            onChange={(e) => {
              const next = [...entry.series];
              next[idx] = { ...next[idx], reps: e.target.value };
              onChange({ ...entry, series: next });
            }}
          />
          {entry.method !== "cluster" && entry.method.indexOf("pyramid") === -1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-auto"
              onClick={() => {
                if (entry.series.length <= 1) return;
                onChange({ ...entry, series: entry.series.filter((_, i) => i !== idx) });
              }}
              disabled={entry.series.length <= 1}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </Button>
          )}
        </div>
      ))}
      {(entry.method === "drop_set" || entry.method === "rest_pause") && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px] w-full"
          onClick={() => {
            const last = entry.series[entry.series.length - 1] || { weight: "", reps: "" };
            const labelPrefix = entry.method === "drop_set" ? "Drop" : "Reprise";
            onChange({
              ...entry,
              series: [
                ...entry.series,
                { ...last, label: `${labelPrefix} ${entry.series.length}` },
              ],
            });
          }}
        >
          <Plus className="h-3 w-3 mr-1" />
          Ajouter {entry.method === "drop_set" ? "un drop" : "une reprise"}
        </Button>
      )}
    </div>
  );
}

/**
 * Convert a WeightLogState into rows ready for upsert into athlete_exercise_logs.
 * Special modes (drop set, cluster, rest-pause, pyramid) compute exact tonnage from each sub-series.
 */
export function buildWeightLogRecords(
  state: WeightLogState,
  ctx: { playerId: string; categoryId: string; trainingSessionId: string },
): Array<{
  player_id: string;
  category_id: string;
  training_session_id: string;
  exercise_name: string;
  actual_weight_kg: number;
  actual_sets: number;
  actual_reps: number;
  notes: string | null;
}> {
  // NOTE: `tonnage` is a GENERATED column in DB (weight × sets × reps).
  // We must NOT include it in the insert payload — Postgres will reject the row otherwise.
  const out: ReturnType<typeof buildWeightLogRecords> = [];

  Object.entries(state).forEach(([exerciseName, entry]) => {
    const status = entry.status ?? "done";
    const notes = encodeNotesStatus(status, entry.comment);

    // Skipped exercise: still emit a row with 0/0/0 so the coach sees it was deliberately not done.
    if (status === "skipped") {
      out.push({
        player_id: ctx.playerId,
        category_id: ctx.categoryId,
        training_session_id: ctx.trainingSessionId,
        exercise_name: exerciseName,
        actual_weight_kg: 0,
        actual_sets: 0,
        actual_reps: 0,
        notes,
      });
      return;
    }

    if (entry.mode === "quick") {
      const weight = parseFloat(entry.weight);
      const sets = parseInt(entry.sets);
      const reps = parseInt(entry.reps);
      if (!weight || !sets || !reps) {
        // Allow saving comment alone (e.g. "Adapté" without numeric values)
        if (notes) {
          out.push({
            player_id: ctx.playerId,
            category_id: ctx.categoryId,
            training_session_id: ctx.trainingSessionId,
            exercise_name: exerciseName,
            actual_weight_kg: 0,
            actual_sets: 0,
            actual_reps: 0,
            notes,
          });
        }
        return;
      }
      out.push({
        player_id: ctx.playerId,
        category_id: ctx.categoryId,
        training_session_id: ctx.trainingSessionId,
        exercise_name: exerciseName,
        actual_weight_kg: weight,
        actual_sets: sets,
        actual_reps: reps,
        notes,
      });
      return;
    }

    // detailed OR special: aggregate exactly per sub-set
    const series = entry.series;
    let totalTonnage = 0;
    let totalReps = 0;
    let validSeries = 0;
    series.forEach((s) => {
      const w = parseFloat(s.weight);
      const r = parseInt(s.reps);
      if (!w || !r) return;
      totalTonnage += w * r;
      totalReps += r;
      validSeries += 1;
    });
    if (validSeries === 0 || totalReps === 0) {
      if (notes) {
        out.push({
          player_id: ctx.playerId,
          category_id: ctx.categoryId,
          training_session_id: ctx.trainingSessionId,
          exercise_name: exerciseName,
          actual_weight_kg: 0,
          actual_sets: 0,
          actual_reps: 0,
          notes,
        });
      }
      return;
    }
    const equivalentWeight = Math.round((totalTonnage / totalReps) * 100) / 100;
    out.push({
      player_id: ctx.playerId,
      category_id: ctx.categoryId,
      training_session_id: ctx.trainingSessionId,
      exercise_name: exerciseName,
      actual_weight_kg: equivalentWeight,
      actual_sets: 1,
      actual_reps: totalReps,
      notes,
    });
  });

  return out;
}

/**
 * Count how many gym exercises in the state still have no usable weight/reps entered.
 * Skipped exercises count as "complete" (the athlete made an explicit choice).
 * Used to warn the athlete before validating their RPE.
 */
export function countIncompleteWeightLogs(state: WeightLogState): number {
  let incomplete = 0;
  Object.values(state).forEach((entry) => {
    if (entry.status === "skipped") return;
    if (entry.mode === "quick") {
      const w = parseFloat(entry.weight);
      const s = parseInt(entry.sets);
      const r = parseInt(entry.reps);
      if (!w || !s || !r) incomplete += 1;
      return;
    }
    const hasAny = entry.series.some((sr) => parseFloat(sr.weight) > 0 && parseInt(sr.reps) > 0);
    if (!hasAny) incomplete += 1;
  });
  return incomplete;
}

