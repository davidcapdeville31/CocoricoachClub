/**
 * ValidatedMethodCard
 * -------------------
 * Affiche un résumé visuel + structurel d'un exercice "méthode config" 
 * (Drop Set, Rest-Pause, Pyramides, 5x5, Iso, AMRAP, EMOM, Tabata, Death By,
 * For Time, Circuit, Cardio Intermittent…) tel qu'il a été validé dans
 * MethodConfigSlots/FartlekConfigSlots/ClusterConfigSlots/StatoConfigSlots.
 *
 * Reprend EXACTEMENT le code couleur de la carte de création (rouge pour drop
 * set, ambre pour rest-pause, etc.) pour conserver une cohérence visuelle
 * entre l'édition et le résumé en bloc.
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMethodColors } from "./shared/MethodGroupWrapper";
import { RestPauseReadOnlyUI } from "./RestPauseReadOnlyUI";
import { FartlekCard } from "./FartlekCard";
import { ClusterCard } from "./ClusterCard";
import { StatoDynamiqueCard } from "./StatoDynamiqueCard";
import { IntermittentCardioCard } from "./IntermittentCardioCard";
import type { RestPauseConfig } from "./RestPauseTypes";
import type { V2BlockExercise } from "./hooks/useSaveProgramV2";

const METHOD_LABELS: Record<string, string> = {
  drop_set: "Drop Set",
  rest_pause: "Rest-Pause",
  pyramid_up: "Pyramide ↑",
  pyramid_down: "Pyramide ↓",
  pyramid_full: "Pyramide ↑↓",
  five_by_five: "5x5",
  isometric_overcoming: "Iso. Overcoming",
  isometric_yielding: "Iso. Yielding",
  amrap: "AMRAP",
  for_time: "For Time",
  death_by: "Death By",
  circuit: "Circuit",
  tabata: "Tabata",
  emom: "EMOM",
  cluster: "Cluster",
  fartlek: "Fartlek",
  stato_dynamique: "Stato-Dynamique",
  intermittent_cardio: "Cardio Intermittent",
};

interface Props {
  exercise: V2BlockExercise;
  onRemove: () => void;
  onEdit?: () => void;
  readOnly?: boolean;
}

export const ValidatedMethodCard = ({ exercise, onRemove, onEdit, readOnly }: Props) => {
  const method = exercise.method ?? "normal";
  const colors = getMethodColors(method);
  const label = METHOD_LABELS[method] ?? method;
  const config = (exercise.config ?? {}) as any;
  const series: any[] = Array.isArray(config.series) ? config.series : [];
  const restPauseConfig: RestPauseConfig | undefined = config.restPauseConfig;
  const isRestPause = method === "rest_pause" && restPauseConfig?.series?.length;
  const dropName: string =
    config.droppedExercise?.exerciseName ?? exercise.exerciseName ?? "—";

  // Specialized cards keep their full creation UI after validation
  if (method === "fartlek" && config.effortPhases) {
    return <FartlekCard config={config as any} onEdit={onEdit} onRemove={onRemove} />;
  }
  if (method === "cluster" && config.sets != null) {
    return (
      <div className="relative group">
        <ClusterCard config={config as any} exerciseName={dropName} onRemove={onRemove} />
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-10 h-7 w-7 rounded-2xl bg-background/80 hover:text-primary z-10"
            onClick={onEdit}
            title="Modifier"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }
  if (method === "stato_dynamique" && (config.phases || config.amplitudeType)) {
    return <StatoDynamiqueCard config={config as any} exerciseName={dropName} onEdit={onEdit} onRemove={onRemove} />;
  }
  if (method === "intermittent_cardio" && config.workSeconds != null) {
    return <IntermittentCardioCard config={config as any} onEdit={onEdit} onRemove={onRemove} />;
  }

  // For phase methods (EMOM, AMRAP, For Time, Circuit, Tabata, Death By),
  // each series carries its own exercise name → display it inline rather than
  // concatenating everything in the header.
  const isPhaseMethod = ["emom", "amrap", "for_time", "circuit", "tabata", "death_by"].includes(method);
  const headerName = isPhaseMethod ? label : dropName;

  return (
    <div
      className={cn(
        "rounded-xl border-2 overflow-hidden shadow-sm",
        colors.border,
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 border-b",
          colors.bg,
          colors.border,
        )}
      >
        <Badge
          className={cn(
            "font-semibold text-white border-0 text-[11px] h-5 px-2",
            colors.iconBg,
          )}
        >
          {label}
        </Badge>
        {!isPhaseMethod && (
          <span className={cn("text-sm font-medium truncate flex-1", colors.text)}>
            {headerName}
          </span>
        )}
        {isPhaseMethod && <div className="flex-1" />}
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {(() => {
            if (isRestPause) {
              const n = restPauseConfig!.series.length;
              return `${n} série${n > 1 ? "s" : ""}`;
            }
            if (series.length > 0) {
              const repsList = series.map((s: any) => s?.reps).filter((r: any) => r != null && r !== "");
              const allSame = repsList.length > 0 && repsList.every((r: any) => String(r) === String(repsList[0]));
              if (allSame) {
                return `${series.length} × ${repsList[0]}`;
              }
              return `${series.length} série${series.length > 1 ? "s" : ""}`;
            }
            return `${exercise.sets} × ${exercise.reps || 1}`;
          })()}
        </span>
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-2xl text-muted-foreground hover:text-primary"
            onClick={onEdit}
            title="Modifier"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {!readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-2xl text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Rest-Pause structured rendering */}
      {isRestPause && (
        <div className={cn("p-2", colors.bg)}>
          <RestPauseReadOnlyUI config={restPauseConfig!} />
        </div>
      )}

      {/* Series structure (drop set / pyramid / 5x5 / iso / EMOM / AMRAP …) */}
      {!isRestPause && series.length > 0 && (
        <div className={cn("p-2 space-y-1", colors.bg)}>
          {series.map((s, idx) => {
            const isStart = method === "drop_set" && idx === 0;
            const seriesLabel = isStart
              ? "Départ"
              : method === "drop_set"
              ? `Drop ${idx}`
              : `Série ${idx + 1}`;
            const exName: string | undefined =
              s.exerciseName || s.phaseExerciseName;
            return (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-1.5 px-2 py-1 rounded-md bg-background/70 border border-border/40"
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 min-w-[58px] justify-center",
                    colors.text,
                    colors.border,
                  )}
                >
                  {seriesLabel}
                </Badge>
                {isPhaseMethod && exName && (
                  <span className={cn("text-xs font-medium truncate max-w-[180px]", colors.text)}>
                    {exName}
                  </span>
                )}
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 font-bold",
                    s.reps === "MAX" && "bg-red-600 text-white",
                  )}
                >
                  {s.reps === "MAX" ? "MAX" : `${s.reps} reps`}
                </Badge>
                {s.percentage != null && s.percentage !== "" && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                    %1RM {s.percentage}%
                  </Badge>
                )}
                {s.load != null && s.load !== "" && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                    {s.load} kg
                  </Badge>
                )}
                {s.tempo && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                    Tempo {s.tempo}
                  </Badge>
                )}
                {s.rpe != null && s.rpe !== "" && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                    RPE {s.rpe}
                  </Badge>
                )}
                {s.reductionValue != null && idx > 0 && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0.5", colors.text)}
                  >
                    -{s.reductionValue}
                    {s.reductionType === "kg" ? " kg" : "%"}
                  </Badge>
                )}
                {s.pauseSeconds != null && s.pauseSeconds > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                    Pause {s.pauseSeconds}s
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Generic CrossFit-style summary fallback */}
      {series.length === 0 && exercise.notes && (
        <div className="px-3 py-2 text-[11px] text-muted-foreground bg-background/60">
          {exercise.notes.split("<!--")[0].trim() ||
            `${exercise.sets} × ${exercise.reps}`}
        </div>
      )}
    </div>
  );
};

export default ValidatedMethodCard;
