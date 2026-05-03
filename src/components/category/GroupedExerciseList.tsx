import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Info, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryLabel } from "@/lib/constants/exerciseCategories";
import { getTrainingStyleConfig } from "@/lib/constants/trainingStyles";
import { ExerciseMediaViewer } from "@/components/library/ExerciseMediaViewer";
import { useExerciseMedia } from "@/lib/hooks/useExerciseMedia";
import { LinkedMethodSlots, type LinkedMethodType } from "@/components/program-builder-v2/LinkedMethodSlots";
import { FartlekCard } from "@/components/program-builder-v2/FartlekCard";
import { parseV2MethodConfig, stripV2MethodTags } from "@/lib/program-builder-v2/parseV2MethodConfig";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Exercise {
  id?: string;
  exercise_name: string;
  exercise_category?: string | null;
  sets: number;
  reps?: number | null;
  weight_kg?: number | null;
  rest_seconds?: number | null;
  tempo?: string | null;
  contraction_regime?: string | null;
  notes?: string | null;
  set_type?: string | null;
  method?: string | null;
  group_id?: string | null;
  group_order?: number | null;
  order_index?: number | null;
  library_exercise_id?: string | null;
  percentage_1rm?: number | null;
}

const contractionLabels: Record<string, string> = {
  concentrique: "Concentrique",
  excentrique: "Excentrique",
  isometrique: "Isométrique",
  pliometrique: "Pliométrique",
  stato_dynamique: "Stato-dyn.",
  concentrique_excentrique: "Conc.+Exc.",
  excentrique_surcharge: "Exc. surchargé",
  balistique: "Balistique",
  isokinetique: "Isocinétique",
};

interface ExerciseGroup {
  groupId: string | null;
  exercises: { exercise: Exercise; index: number }[];
  method: string;
}

const setTypeLabels: Record<string, string> = {
  normal: "Normal",
  superset: "Superset",
  biset: "Biset",
  triset: "Triset",
  giant_set: "Giant Set",
  circuit: "Circuit",
  drop_set: "Drop Set",
  pyramid: "Pyramide",
  cluster: "Cluster",
  emom: "EMOM",
  amrap: "AMRAP",
  for_time: "For Time",
  tabata: "Tabata",
  bulgarian: "Méthode Bulgare",
  intermittent_cardio: "Intermittent Cardio",
  fartlek: "Fartlek",
  stato_dynamique: "Stato-dynamique",
  iso_max: "Iso Max",
  isometric_overcoming: "Iso Overcoming",
  isometric_yielding: "Iso Yielding",
  super_pletnev: "Super Pletnev",
  combine_haltero: "Combiné Haltéro",
  vbt: "VBT",
};

interface GroupedExerciseListProps {
  exercises: Exercise[];
  fieldMode?: boolean;
  maxHeight?: string;
  showScroll?: boolean;
  compact?: boolean;
  forPrint?: boolean;
}

export function GroupedExerciseList({
  exercises,
  fieldMode = false,
  maxHeight = "300px",
  showScroll = true,
  compact = false,
  forPrint = false,
}: GroupedExerciseListProps) {
  const { getMedia } = useExerciseMedia();

  // Organize exercises into groups
  const exerciseGroups = useMemo(() => {
    if (!exercises || exercises.length === 0) return [];
    
    const groups: ExerciseGroup[] = [];
    const processedGroupIds = new Set<string>();

    exercises.forEach((exercise, index) => {
      const resolvedMethod =
        (exercise.method && exercise.method !== "normal" ? exercise.method : null) ||
        (exercise.set_type && !["normal", "standard"].includes(exercise.set_type) ? exercise.set_type : null);
      if (exercise.group_id) {
        if (!processedGroupIds.has(exercise.group_id)) {
          processedGroupIds.add(exercise.group_id);
          const groupExercises = exercises
            .map((ex, idx) => ({ exercise: ex, index: idx }))
            .filter(({ exercise: ex }) => ex.group_id === exercise.group_id)
            .sort((a, b) => (a.exercise.group_order || 0) - (b.exercise.group_order || 0));
          
          groups.push({
            groupId: exercise.group_id,
            exercises: groupExercises,
            method: resolvedMethod || "superset",
          });
        }
      } else {
        groups.push({
          groupId: null,
          exercises: [{ exercise, index }],
          method: resolvedMethod || "normal",
        });
      }
    });

    return groups;
  }, [exercises]);

  // Render a single exercise card
  const renderExerciseCard = (ex: Exercise, idx: number, isGrouped: boolean, exerciseNumber?: number) => {
    const styleConfig = getTrainingStyleConfig(ex.set_type || ex.method || "normal");
    const media = getMedia(ex.exercise_name);
    
    return (
      <div 
        key={ex.id || idx} 
        className={cn(
          compact ? "p-2" : "p-3",
          "border rounded-lg",
          isGrouped 
            ? (fieldMode ? "bg-slate-700/50" : "bg-background/50") 
            : (fieldMode ? "bg-slate-700" : "bg-card")
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            {isGrouped && exerciseNumber && (
              <Badge className={cn("text-white text-xs", styleConfig.color || "bg-primary")}>
                {exerciseNumber}
              </Badge>
            )}
            {!isGrouped && (
              <span className={cn(
                "text-sm font-medium w-5",
                fieldMode ? "text-slate-400" : "text-muted-foreground"
              )}>
                {idx + 1}.
              </span>
            )}
            <span className={cn("font-medium", compact && "text-sm", fieldMode && "text-white")}>
              {ex.exercise_name}
            </span>
            {(media?.youtube_url || media?.image_url) && (
              <ExerciseMediaViewer
                exerciseName={ex.exercise_name}
                imageUrl={media?.image_url}
                youtubeUrl={media?.youtube_url}
              >
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center justify-center rounded-full h-5 w-5 shrink-0 transition-colors",
                    "text-primary hover:bg-primary/10",
                    fieldMode && "text-white hover:bg-white/10"
                  )}
                  aria-label={`Voir la vidéo de ${ex.exercise_name}`}
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
                    className={cn(
                      "inline-flex items-center justify-center rounded-full border transition-colors shrink-0",
                      "h-4 w-4 border-muted-foreground/40 text-muted-foreground hover:text-primary hover:border-primary",
                      fieldMode && "border-slate-400/60 text-slate-300 hover:text-white hover:border-white"
                    )}
                    aria-label={`Consignes pour ${ex.exercise_name}`}
                    onClick={(e) => e.preventDefault()}
                  >
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="start"
                  className="max-w-sm whitespace-pre-line text-xs leading-relaxed space-y-1"
                >
                  <p className="font-semibold">{ex.exercise_name}</p>
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
                  {(() => {
                    const cleanCoachNote = ex.notes
                      ? stripV2MethodTags(ex.notes).replace(/<!--[\s\S]*?-->/g, "").trim()
                      : "";
                    if (!cleanCoachNote) return null;
                    return (
                      <p className="pt-1 border-t border-border/40 italic">
                        Note coach : {cleanCoachNote}
                      </p>
                    );
                  })()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {!compact && (
            <div className="flex gap-1 flex-wrap justify-end">
              {!isGrouped && ex.set_type && ex.set_type !== "normal" && (
                <Badge variant="secondary" className="text-xs">
                  {setTypeLabels[ex.set_type] || ex.set_type}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {getCategoryLabel(ex.exercise_category)}
              </Badge>
            </div>
          )}
        </div>
        <div className={cn(
          "flex flex-wrap gap-2",
          compact ? "text-xs" : "text-sm",
          fieldMode ? "text-slate-400" : "text-muted-foreground"
        )}>
          <span>{ex.sets} séries</span>
          {ex.reps && <span>× {ex.reps} reps</span>}
          {ex.weight_kg && <span>@ {ex.weight_kg} kg</span>}
          {ex.rest_seconds && <span>- {ex.rest_seconds}s repos</span>}
          {!compact && ex.tempo && <span>Tempo: {ex.tempo}</span>}
          {!compact && ex.contraction_regime && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {contractionLabels[ex.contraction_regime] || ex.contraction_regime}
            </Badge>
          )}
        </div>
        {!compact && media?.description && (
          <p className={cn(
            "text-xs mt-2",
            fieldMode ? "text-slate-300" : "text-muted-foreground"
          )}>
            <span className="font-semibold uppercase tracking-wide text-[10px] mr-1">Consignes :</span>
            {media.description}
          </p>
        )}
        {(() => {
          const parsed = parseV2MethodConfig(ex.notes);
          if (parsed?.kind === "fartlek") {
            return (
              <div className="mt-2">
                <FartlekCard config={parsed.config} />
              </div>
            );
          }
          return null;
        })()}
        {!compact && ex.notes && (() => {
          const cleanNotes = stripV2MethodTags(ex.notes).replace(/<!--[\s\S]*?-->/g, "").trim();
          if (!cleanNotes) return null;
          return (
            <p className={cn(
              "text-xs mt-2 italic",
              fieldMode ? "text-slate-500" : "text-muted-foreground"
            )}>
              {cleanNotes}
            </p>
          );
        })()}
      </div>
    );
  };

  // Render a grouped block of exercises
  const LINKED_METHODS = ["superset", "biset", "triset", "giant_set", "bulgarian", "combine_haltero"] as const;
  const renderExerciseGroup = (group: ExerciseGroup, groupIdx: number) => {
    if (!group.groupId) {
      // Single exercise, not grouped
      const { exercise, index } = group.exercises[0];
      return renderExerciseCard(exercise, index, false);
    }

    // Linked methods (Superset, Biset, Triset, Giant Set, Bulgarian, Combiné Haltéro)
    // → reuse the same visual as the session builder, in read-only mode.
    if (LINKED_METHODS.includes(group.method as any)) {
      const slotted = group.exercises.map(({ exercise: ex }, idx) => ({
        id: ex.id || `ro-${groupIdx}-${idx}`,
        exerciseId: ex.library_exercise_id || ex.id || `ro-${groupIdx}-${idx}`,
        exerciseName: ex.exercise_name,
        stationName: ex.exercise_name,
        slotIndex: idx,
        params: {
          sets: ex.sets,
          reps: ex.reps,
          percentage: ex.percentage_1rm,
          tempo: ex.tempo,
          rest: ex.rest_seconds,
        },
      }));
      const restSeconds = group.exercises[0]?.exercise?.rest_seconds ?? undefined;
      return (
        <LinkedMethodSlots
          key={group.groupId}
          method={group.method as LinkedMethodType}
          slottedExercises={slotted as any}
          onRemoveFromSlot={() => undefined}
          onUpdateParams={() => undefined}
          dayId={`preview-${group.groupId}`}
          defaultEditing={false}
          readOnly
          methodRestSeconds={restSeconds ?? undefined}
        />
      );
    }

    // Other grouped exercises (circuit, drop_set, etc.) → keep the previous compact card.
    const styleConfig = getTrainingStyleConfig(group.method);

    return (
      <div
        key={group.groupId}
        className={cn(
          "border-2 rounded-lg p-2 space-y-2 print-exercise-group",
          styleConfig.borderColor,
          styleConfig.bgColor,
          fieldMode && "border-opacity-50"
        )}
      >
        {/* Group header */}
        <div className="flex items-center gap-2 mb-1">
          <Badge className={cn("text-white text-xs", styleConfig.color || "bg-primary")}>
            {setTypeLabels[group.method] || styleConfig.label || group.method}
          </Badge>
          <span className={cn(
            "text-xs",
            fieldMode ? "text-slate-400" : "text-muted-foreground"
          )}>
            {group.exercises.length} exercices liés
          </span>
        </div>

        {/* Exercises in the group */}
        <div className="space-y-1.5">
          {group.exercises.map(({ exercise, index }, exIdx) =>
            renderExerciseCard(exercise, index, true, exIdx + 1)
          )}
        </div>
      </div>
    );
  };

  if (!exercises || exercises.length === 0) {
    return (
      <div className={cn(
        "text-center py-6",
        fieldMode ? "text-slate-400" : "text-muted-foreground"
      )}>
        <Dumbbell className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucun exercice détaillé</p>
      </div>
    );
  }

  const content = (
    <div className="space-y-2">
      {exerciseGroups.map((group, idx) => (
        <div key={group.groupId || idx}>
          {renderExerciseGroup(group, idx)}
        </div>
      ))}
    </div>
  );

  if (showScroll && !forPrint) {
    return (
      <div 
        className="overflow-y-auto pr-2" 
        style={{ maxHeight }}
      >
        {content}
      </div>
    );
  }

  return content;
}
