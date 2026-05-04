// Read-only renderer for a V2 method-config exercise (Drop Set, Pyramide,
// Rest-Pause, 5x5, AMRAP, EMOM, Tabata, Cluster, Fartlek, Stato, Intermittent
// cardio, etc.) — reuses the same ValidatedMethodCard visual as the session
// builder so coach and athlete see the EXACT same colored block, badges and
// per-série details.

import { ValidatedMethodCard } from "@/components/program-builder-v2/ValidatedMethodCard";
import {
  parseV2MethodConfig,
  v2KindToMethod,
} from "@/lib/program-builder-v2/parseV2MethodConfig";
import type { V2BlockExercise } from "@/components/program-builder-v2/hooks/useSaveProgramV2";

interface Props {
  exercise: {
    id?: string;
    exercise_name: string;
    sets?: number | null;
    reps?: number | string | null;
    notes?: string | null;
    method?: string | null;
    set_type?: string | null;
  };
}

/**
 * Returns the rich ValidatedMethodCard if the exercise notes contain a v2
 * method-config payload, otherwise `null` (caller falls back to its default
 * rendering).
 */
export function ReadOnlyMethodCard({ exercise }: Props) {
  const parsed = parseV2MethodConfig(exercise.notes);
  if (!parsed) return null;

  const method = v2KindToMethod(parsed.kind);
  const cfg = parsed.config as any;
  const v2Exercise: V2BlockExercise = {
    id: exercise.id ?? `ro-${Math.random()}`,
    exerciseName: exercise.exercise_name,
    sets: Number(exercise.sets) || 1,
    reps: String(exercise.reps ?? ""),
    restSeconds: typeof cfg?.restSeconds === "number" ? cfg.restSeconds : undefined,
    method,
    config: parsed.config,
    notes: exercise.notes ?? undefined,
  };

  return (
    <ValidatedMethodCard
      exercise={v2Exercise}
      onRemove={() => undefined}
      readOnly
    />
  );
}
