import { useMemo, useState } from "react";
import { Trash2, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

  const supportsVariableSets = exerciseType === "strength" || exerciseType === "bodyweight";
  const [showSets, setShowSets] = useState<boolean>(
    Boolean(exercise.variableSets && exercise.variableSets.length > 0),
  );

  const toggleVariableSets = () => {
    if (!showSets) {
      if (!exercise.variableSets || exercise.variableSets.length === 0) {
        onUpdate(
          "variableSets",
          convertToVariableSets({
            sets: exercise.sets,
            reps: exercise.reps,
            weight_kg: exercise.weight_kg,
            percentage: exercise.percentage,
            rpe: exercise.rpe,
            tempo: exercise.tempo,
          }),
        );
      }
      setShowSets(true);
    } else {
      setShowSets(false);
      onUpdate("variableSets", undefined);
    }
  };

  return (
    <div className="rounded-xl bg-muted/40 border border-border/60 px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium truncate">{exercise.exerciseName}</p>
        <div className="flex items-center gap-1 shrink-0">
          {supportsVariableSets && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-7 px-2 text-xs rounded-2xl border-dashed",
                showSets && "border-solid border-primary text-primary bg-primary/5",
              )}
              onClick={toggleVariableSets}
              title="Définir des valeurs différentes pour chaque série (série 1 : 12 reps, série 2 : 8 reps...)"
            >
              <Rows3 className="h-3.5 w-3.5 mr-1" />
              Séries variables
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-2xl text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <TrainingVariablesManager
        exerciseType={exerciseType}
        values={values}
        onUpdate={handleUpdate}
        visibleVariables={visibleVariables}
        onVisibleVariablesChange={(vars) => onUpdate("visibleVariables", vars)}
        variableSets={exercise.variableSets}
        onVariableSetsChange={(sets) => onUpdate("variableSets", sets)}
        showVariableSets={showSets}
        compact
      />
    </div>
  );

};

export default NormalExerciseEditor;
