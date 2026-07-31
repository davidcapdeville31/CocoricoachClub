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
import { Trash2, Pencil, Info, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMethodColors } from "./shared/MethodGroupWrapper";
import { ExerciseMediaViewer } from "@/components/library/ExerciseMediaViewer";
import { useExerciseMedia } from "@/lib/hooks/useExerciseMedia";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function ExerciseNameWithMedia({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const { getMedia } = useExerciseMedia();
  const media = getMedia(name);
  const hasMedia = !!(media?.youtube_url || media?.image_url);

  return (
    <span className={cn("inline-flex items-center gap-1.5 min-w-0 flex-1", className)}>
      <span className="truncate">{name}</span>
      {hasMedia && (
        <ExerciseMediaViewer
          exerciseName={name}
          imageUrl={media?.image_url}
          youtubeUrl={media?.youtube_url}
        >
          <button
            type="button"
            className="inline-flex items-center justify-center h-5 w-5 rounded-full text-primary hover:bg-primary/10 shrink-0 transition-colors"
            aria-label={`Voir la vidéo de ${name}`}
            title="Voir la vidéo / image"
          >
            <Video className="h-3.5 w-3.5" />
          </button>
        </ExerciseMediaViewer>
      )}
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border h-4 w-4 shrink-0 transition-colors border-muted-foreground/40 text-muted-foreground hover:text-primary hover:border-primary"
              aria-label={`Consignes pour ${name}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="start"
            className="max-w-sm whitespace-pre-line text-xs leading-relaxed space-y-1"
          >
            <p className="font-semibold">{name}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Consignes d'exécution
            </p>
            {media?.description ? (
              <p>{media.description}</p>
            ) : (
              <p className="italic text-muted-foreground">
                Aucune consigne renseignée pour cet exercice.
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}
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

// Consigne par défaut (identique à l'écran de création) — affichée dans
// le résumé read-only pour rappeler le principe de la méthode.
const METHOD_DESCRIPTIONS: Record<string, string> = {
  drop_set: "Séries dégressives sans repos entre les drops",
  rest_pause: "Courtes pauses entre les mini-séries pour prolonger l'effort",
  pyramid_up: "Augmentation progressive de la charge à chaque série",
  pyramid_down: "Diminution progressive de la charge à chaque série",
  pyramid_full: "Montée puis descente de la charge",
  five_by_five: "5 séries de 5 répétitions pour développer la force",
  isometric_overcoming: "Contraction maximale contre une résistance fixe",
  isometric_yielding: "Maintien d'une charge à un angle spécifique",
  amrap: "Réalisez un maximum de tours/reps dans le temps imparti",
  for_time: "Complétez le circuit le plus vite possible",
  death_by: "Ajoutez des reps chaque minute jusqu'à l'échec",
  circuit: "Enchaînez les exercices avec peu de repos",
  tabata: "Intervalles travail/repos courts et intenses",
  emom: "Démarrez un nouvel exercice à chaque intervalle",
  cluster: "Mini-pauses intra-série pour maintenir la qualité",
  fartlek: "Alternance libre d'intensités sur la durée",
  stato_dynamique: "Phase isométrique suivie d'une phase dynamique",
  intermittent_cardio: "Alternance effort/récupération pour le cardio",
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
  const rawSeries: any[] = Array.isArray(config.series) ? config.series : [];
  const methodExercises: any[] = Array.isArray(config.methodExercises) ? config.methodExercises : [];
  // For EMOM/Circuit/Tabata/Death By → use methodExercises (1 row per exercise) like For Time
  // instead of `series` (which can contain N rows for N intervals/rounds).
  const useMethodExercises = ["emom", "circuit", "tabata", "death_by"].includes(method) && methodExercises.length > 0;
  const series: any[] = useMethodExercises
    ? methodExercises.map((ex: any) => ({
        reps: ex.reps,
        percentage: ex.percentage,
        load: ex.load,
        tempo: ex.tempo,
        rpe: ex.rpe,
        notes: ex.notes ?? rawSeries[0]?.notes,
        exerciseName: ex.exerciseName,
      }))
    : rawSeries;
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
  if (method === "stato_dynamique" && (config.staticPhases || config.dynamicAmplitude || config.phases || config.amplitudeType)) {
    return (
      <StatoDynamiqueCard
        config={config as any}
        exerciseName={config.exerciseName ?? dropName}
        onEdit={onEdit}
        onRemove={onRemove}
      />
    );
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
          <ExerciseNameWithMedia
            name={headerName}
            className={cn("text-sm font-medium", colors.text)}
          />
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

      {/* Protocol summary (consigne + timing/repos) for all methods */}
      {(() => {
        const lines: string[] = [];
        const consigne = METHOD_DESCRIPTIONS[method];

        if (method === "tabata") {
          const t = config.tabataConfig ?? { workSeconds: 20, restSeconds: 10, rounds: 8 };
          lines.push(`${t.workSeconds}'' effort / ${t.restSeconds}'' repos × ${t.rounds} rounds`);
        }
        if (method === "emom") {
          const e = config.emomConfig;
          if (e) {
            const label = e.intervalMinutes === 1 ? "EMOM" : `E${e.intervalMinutes}MOM`;
            lines.push(`${label} — ${e.totalMinutes} min total (1 exercice toutes les ${e.intervalMinutes} min)`);
          }
        }
        if (method === "death_by") {
          const d = config.deathByConfig ?? { startReps: 1, incrementReps: 1 };
          lines.push(
            `${d.startReps} rep${d.startReps > 1 ? "s" : ""} à la 1re minute, +${d.incrementReps} rep${d.incrementReps > 1 ? "s" : ""} chaque minute jusqu'à l'échec`
          );
        }
        if (method === "amrap" && config.timeCap != null) {
          lines.push(`AMRAP — ${config.timeCap} min (un max de tours)`);
        }
        if (method === "for_time" && config.timeCap != null) {
          lines.push(`For Time — Time cap ${config.timeCap} min`);
        }
        if (method === "circuit") {
          if (config.repsPerRound != null) lines.push(`${config.repsPerRound} tour${config.repsPerRound > 1 ? "s" : ""}`);
          const r = config.circuitRecovery;
          if (r) {
            if (r.strategy === "after_circuit" && r.globalRestSeconds != null) {
              lines.push(`Repos ${r.globalRestSeconds}s entre les tours`);
            } else if (r.strategy === "between_exercises") {
              lines.push("Repos entre chaque exercice (voir détails)");
            } else if ((r.strategy as string) === "no_rest") {
              lines.push("Sans repos");
            }
          }
        }

        // Generic: number of series and rest between series for non-phase methods
        if (!isPhaseMethod && !isRestPause) {
          const seriesCount = series.length;
          if (seriesCount > 0) {
            lines.push(`${seriesCount} série${seriesCount > 1 ? "s" : ""}`);
          }
          const restSec = (exercise as any).restSeconds;
          if (restSec != null && restSec > 0) {
            const m = Math.floor(restSec / 60);
            const s = restSec % 60;
            const formatted = m > 0 ? (s > 0 ? `${m}min ${s}s` : `${m}min`) : `${s}s`;
            lines.push(`Repos ${formatted} entre les séries`);
          }
        }

        if (!consigne && lines.length === 0) return null;
        return (
          <div className={cn("px-3 py-2 text-[11px] border-b space-y-0.5", colors.bg, colors.border)}>
            {consigne && (
              <div className={cn("italic", colors.text)}>{consigne}</div>
            )}
            {lines.map((l, i) => (
              <div key={i} className={cn("font-medium", colors.text)}>{l}</div>
            ))}
          </div>
        );
      })()}

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
            // Resolve exercise name with multiple fallbacks (series, methodExercises, droppedPhaseExercises)
            const phaseList: any[] = Array.isArray(config.methodExercises) ? config.methodExercises : [];
            const droppedPhase = config.droppedPhaseExercises ?? {};
            const fallbackPhase =
              phaseList[idx]?.exerciseName ??
              droppedPhase?.[idx]?.exerciseName ??
              (phaseList.length > 0 ? phaseList[idx % phaseList.length]?.exerciseName : undefined) ??
              (Object.keys(droppedPhase).length > 0
                ? droppedPhase[idx % Object.keys(droppedPhase).length]?.exerciseName
                : undefined);
            const exName: string | undefined =
              s.exerciseName || s.phaseExerciseName || fallbackPhase;
            const seriesNote: string | undefined =
              (s.notes && String(s.notes).trim()) || undefined;
            return (
              <div
                key={idx}
                className="flex flex-col gap-1 px-2 py-1 rounded-md bg-background/70 border border-border/40"
              >
                <div className="flex flex-wrap items-center gap-1.5">
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
                  <ExerciseNameWithMedia
                    name={exName}
                    className={cn("text-xs font-medium max-w-[180px]", colors.text)}
                  />
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
                {s.angle != null && s.angle !== "" && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                    Angle {s.angle}°
                  </Badge>
                )}
                {s.timeUnderTension != null && s.timeUnderTension !== "" && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                    TST {s.timeUnderTension}s
                  </Badge>
                )}
                {s.rir != null && s.rir !== "" && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                    RIR {s.rir}
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
                {seriesNote && (
                  <p className="text-[10px] italic text-muted-foreground whitespace-pre-line pl-1">
                    💬 {seriesNote}
                  </p>
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

      {/* Coach notes / consignes complémentaires (rendu en bas) */}
      {(() => {
        // 1) coachNotes stocké dans config (Fartlek, Cluster, et tout payload custom)
        const configNote: string | undefined =
          (config.coachNotes as string | undefined) ||
          (config.notes as string | undefined);

        // 2) Notes libres saisies dans exercise.notes — on retire les balises
        // <!--...--> et la ligne de résumé auto (ex. "Tabata 20/10 × 8") qui
        // est déjà visible dans l'en-tête.
        let freeNote = "";
        if (exercise.notes) {
          const stripped = exercise.notes.replace(/<!--[\s\S]*?-->/g, "").trim();
          if (stripped) {
            const lines = stripped.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            // Skip first line if it looks like the auto summary (commence par le label méthode)
            if (lines[0]?.toLowerCase().startsWith(label.toLowerCase())) {
              lines.shift();
            }
            freeNote = lines.join("\n").trim();
          }
        }

        // 3) Per-exercise coach notes (méthodes circuit/EMOM/Tabata/Death By)
        const perExNotes: Array<{ name?: string; note: string }> = [];
        const phaseList: any[] = Array.isArray(config.methodExercises) ? config.methodExercises : [];
        for (const ex of phaseList) {
          if (ex?.coachNotes && String(ex.coachNotes).trim()) {
            perExNotes.push({ name: ex.exerciseName, note: String(ex.coachNotes).trim() });
          }
        }

        if (!configNote && !freeNote && perExNotes.length === 0) return null;

        return (
          <div className={cn("px-3 py-2 border-t space-y-1.5", colors.bg, colors.border)}>
            <div className={cn("text-[10px] font-semibold uppercase tracking-wide", colors.text)}>
              💡 Consignes du coach
            </div>
            {configNote && (
              <p className="text-xs text-foreground/80 whitespace-pre-wrap">{configNote}</p>
            )}
            {freeNote && (
              <p className="text-xs text-foreground/80 whitespace-pre-wrap">{freeNote}</p>
            )}
            {perExNotes.map((p, i) => (
              <p key={i} className="text-xs text-foreground/80 whitespace-pre-wrap">
                {p.name && <span className="font-medium">{p.name} : </span>}
                {p.note}
              </p>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

export default ValidatedMethodCard;
