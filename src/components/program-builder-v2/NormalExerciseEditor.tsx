import { useMemo } from "react";
import { Trash2, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExerciseMediaViewer } from "@/components/library/ExerciseMediaViewer";
import { useExerciseMedia } from "@/lib/hooks/useExerciseMedia";

import { TrainingVariablesManager } from "./TrainingVariablesManager";
import {
  inferExerciseTypeFromName,
  getDefaultVisibleVariables,
  type ExerciseType,
} from "@/lib/program-builder-v2/exerciseTypes";
import { convertToVariableSets } from "@/lib/program-builder-v2/variableSetsTypes";
import type { V2BlockExercise } from "./hooks/useSaveProgramV2";

interface Props {
  exercise: V2BlockExercise;
  onUpdate: (key: string, value: any) => void;
  onRemove: () => void;
}


/**
 * Editable inline view for a "normal" exercise inside a session block.
 * Uses TrainingVariablesManager so users can tweak sets/reps and add
 * any other variable (charge, tempo, RPE, RIR, repos, %1RM, ...).
 */
export const NormalExerciseEditor = ({ exercise, onUpdate, onRemove }: Props) => {
  const { getMedia } = useExerciseMedia();
  const media = getMedia(exercise.exerciseName);
  const exerciseType: ExerciseType = useMemo(
    () => inferExerciseTypeFromName(exercise.exerciseName),
    [exercise.exerciseName],
  );

  const visibleVariables = useMemo(
    () =>
      exercise.visibleVariables && exercise.visibleVariables.length > 0
        ? exercise.visibleVariables
        : getDefaultVisibleVariables(exerciseType),
    [exercise.visibleVariables, exerciseType],
  );

  // Map V2BlockExercise fields to TrainingVariablesManager values shape
  const values: Record<string, any> = {
    sets: exercise.sets,
    reps: exercise.reps,
    percentage: exercise.percentage,
    weight_kg: exercise.weight_kg,
    load: exercise.weight_kg,
    tempo: exercise.tempo,
    rpe: exercise.rpe,
    rir: exercise.rir,
    restSeconds: exercise.restSeconds,
  };

  const handleUpdate = (key: string, value: any) => {
    // Normalize "load" alias → weight_kg
    if (key === "load") {
      onUpdate("weight_kg", value);
      return;
    }
    onUpdate(key, value);
  };

  // Per-set (variable sets) editing: the table exposes its own "Séries variables"
  // collapsible trigger, so we only need to enable it here.
  const variableSets = useMemo(
    () =>
      exercise.variableSets && exercise.variableSets.length > 0
        ? exercise.variableSets
        : convertToVariableSets({
            sets: exercise.sets,
            reps: exercise.reps,
            weight_kg: exercise.weight_kg,
            percentage: exercise.percentage,
            rpe: exercise.rpe,
            tempo: exercise.tempo,
          }),
    [exercise.variableSets, exercise.sets, exercise.reps, exercise.weight_kg, exercise.percentage, exercise.rpe, exercise.tempo],
  );

  return (
    <div className="rounded-xl bg-muted/40 border border-border/60 px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ExerciseMediaViewer
            exerciseName={exercise.exerciseName}
            imageUrl={media?.image_url}
            youtubeUrl={media?.youtube_url}
          >
            <button
              type="button"
              className="h-9 w-9 rounded-lg overflow-hidden shrink-0 border border-border/60 bg-muted flex items-center justify-center"
              aria-label={`Voir le média de ${exercise.exerciseName}`}
            >
              {media?.image_url ? (
                <img
                  src={media.image_url}
                  alt={exercise.exerciseName}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </ExerciseMediaViewer>
          <p className="text-sm font-medium truncate">{exercise.exerciseName}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-2xl text-muted-foreground hover:text-destructive shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <TrainingVariablesManager
        exerciseType={exerciseType}
        values={values}
        onUpdate={handleUpdate}
        visibleVariables={visibleVariables}
        onVisibleVariablesChange={(vars) => onUpdate("visibleVariables", vars)}
        variableSets={variableSets}
        onVariableSetsChange={(sets) => onUpdate("variableSets", sets)}
        showVariableSets
        compact
      />
    </div>
  );


};

export default NormalExerciseEditor;
