export interface ExerciseLibraryDisplayRow {
  id: string;
  exercise_name: string;
  image_url: string | null;
  video_url: string | null;
  general_description: string | null;
  positioning_criteria: any;
  execution_criteria: any;
  safety_prevention: any;
}

export interface ExerciseFallbackMaps {
  byId: Record<string, ExerciseLibraryDisplayRow>;
  byName: Record<string, ExerciseLibraryDisplayRow>;
}

const normalizeName = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const pickFirstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
};

const pickFirstValue = (...values: unknown[]): any => {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return null;
};

export const EMPTY_EXERCISE_FALLBACK_MAPS: ExerciseFallbackMaps = {
  byId: {},
  byName: {},
};

export const buildExerciseFallbackMaps = (rows: ExerciseLibraryDisplayRow[] = []): ExerciseFallbackMaps => {
  const byId: Record<string, ExerciseLibraryDisplayRow> = {};
  const byName: Record<string, ExerciseLibraryDisplayRow> = {};

  rows.forEach((row) => {
    if (row?.id) byId[row.id] = row;
    const key = normalizeName(row?.exercise_name);
    if (key) byName[key] = row;
  });

  return { byId, byName };
};

export const resolveExerciseDisplayData = (exercise: any, fallbackMaps: ExerciseFallbackMaps = EMPTY_EXERCISE_FALLBACK_MAPS) => {
  const resolvedName =
    pickFirstString(exercise?.exerciseName, exercise?.exercise_name, exercise?.name) || "Exercice";

  const resolvedExerciseId = pickFirstString(
    exercise?.exerciseId,
    exercise?.exercise_id,
    exercise?.libraryExerciseId,
    exercise?.library_exercise_id,
  );

  const fallback =
    (resolvedExerciseId ? fallbackMaps.byId[resolvedExerciseId] : undefined) ||
    fallbackMaps.byName[normalizeName(resolvedName)];

  const coachPrecision = pickFirstString(
    exercise?.coachPrecision,
    exercise?.coach_precision,
    exercise?.coachNotes,
    exercise?.coach_notes,
    exercise?.precisionsCoach,
    exercise?.precisions_coach,
  );

  const coachNote = pickFirstString(
    exercise?.notes,
    exercise?.note,
    exercise?.coachNote,
    exercise?.coach_note,
    exercise?.coachNoteText,
    exercise?.coach_note_text,
  );

  // Also enrich methodExercises sub-exercises if present
  const enrichedMethodExercises = Array.isArray(exercise?.methodExercises)
    ? exercise.methodExercises.map((subEx: any) => {
        const subName = pickFirstString(subEx?.exerciseName, subEx?.exercise_name, subEx?.name) || "Exercice";
        const subId = pickFirstString(subEx?.exerciseId, subEx?.exercise_id, subEx?.libraryExerciseId);
        const subFallback =
          (subId ? fallbackMaps.byId[subId] : undefined) ||
          fallbackMaps.byName[normalizeName(subName)];

        return {
          ...subEx,
          exerciseName: subName,
          name: subName,
          exerciseId: subId || subFallback?.id || null,
          imageUrl: pickFirstString(subEx?.imageUrl, subEx?.image_url, subFallback?.image_url),
          videoUrl: pickFirstString(subEx?.videoUrl, subEx?.video_url, subFallback?.video_url),
          general_description: pickFirstValue(subEx?.general_description, subFallback?.general_description),
          positioning_criteria: pickFirstValue(subEx?.positioning_criteria, subFallback?.positioning_criteria),
          execution_criteria: pickFirstValue(subEx?.execution_criteria, subFallback?.execution_criteria),
          safety_prevention: pickFirstValue(subEx?.safety_prevention, subFallback?.safety_prevention),
        };
      })
    : exercise?.methodExercises;

  return {
    ...exercise,
    exerciseName: resolvedName,
    name: resolvedName,
    exerciseId: resolvedExerciseId || fallback?.id || exercise?.exerciseId || null,
    imageUrl: pickFirstString(exercise?.imageUrl, exercise?.image_url, fallback?.image_url),
    videoUrl: pickFirstString(exercise?.videoUrl, exercise?.video_url, fallback?.video_url),
    general_description: pickFirstValue(
      exercise?.general_description,
      exercise?.generalDescription,
      fallback?.general_description,
    ),
    positioning_criteria: pickFirstValue(
      exercise?.positioning_criteria,
      exercise?.positioningCriteria,
      fallback?.positioning_criteria,
    ),
    execution_criteria: pickFirstValue(
      exercise?.execution_criteria,
      exercise?.executionCriteria,
      fallback?.execution_criteria,
    ),
    safety_prevention: pickFirstValue(
      exercise?.safety_prevention,
      exercise?.safetyPrevention,
      fallback?.safety_prevention,
    ),
    coachPrecision,
    notes: coachNote || exercise?.notes || null,
    methodExercises: enrichedMethodExercises,
  };
};
