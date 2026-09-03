/**
 * Persistence helpers for exercise variables that have no dedicated DB column
 * (cardio / ergo / course metrics, RPE, RIR, charge, dénivelé, calories, ...).
 *
 * Like the per-set data, they are stored in a hidden HTML comment inside
 * `notes`: `<!--v2-xvars:{"values":{...},"visibleVariables":[...]}-->`
 *
 * Generic: works for every discipline, every category, staff and athlete side.
 */

/** Variable keys without a dedicated column in program_exercises / gym_session_exercises. */
export const EXTRA_VARIABLE_KEYS = [
  "weight_kg",
  "rpe",
  "rir",
  "assistance_kg",
  // Cardio machines (rameur, skierg, vélo, ...)
  "durationSeconds",
  "distanceMeters",
  "calories",
  "watts",
  "cadence",
  // Locomotion (course, natation, vélo route)
  "runDistanceMeters",
  "runDurationSeconds",
  "paceSecondsPerKm",
  "elevationMeters",
  // Skill
  "attempts",
  "successRate",
] as const;

export type ExtraVariableKey = (typeof EXTRA_VARIABLE_KEYS)[number];

export const EXTRA_VARIABLES_TAG_REGEX = /<!--\s*v2-xvars:(.*?)-->/s;

export interface ExtraVariablesPayload {
  values: Record<string, unknown>;
  visibleVariables?: string[];
}

/** Serialize extra variable values (+ visible variables) into a hidden notes tag. */
export const encodeExtraVariablesTag = (
  exercise: Record<string, any> | null | undefined,
): string => {
  if (!exercise) return "";
  const values: Record<string, unknown> = {};
  for (const key of EXTRA_VARIABLE_KEYS) {
    const v = exercise[key];
    if (v !== undefined && v !== null && v !== "") values[key] = v;
  }
  const visibleVariables: string[] | undefined =
    Array.isArray(exercise.visibleVariables) && exercise.visibleVariables.length > 0
      ? exercise.visibleVariables
      : undefined;

  if (Object.keys(values).length === 0 && !visibleVariables) return "";
  try {
    return `<!--v2-xvars:${JSON.stringify({ values, visibleVariables })}-->`;
  } catch {
    return "";
  }
};

/** Extract extra variable values from an exercise `notes` string. */
export const parseExtraVariablesTag = (
  notes?: string | null,
): ExtraVariablesPayload | undefined => {
  if (!notes) return undefined;
  const match = notes.match(EXTRA_VARIABLES_TAG_REGEX);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed || typeof parsed !== "object") return undefined;
    return {
      values: (parsed.values ?? {}) as Record<string, unknown>,
      visibleVariables: Array.isArray(parsed.visibleVariables)
        ? parsed.visibleVariables
        : undefined,
    };
  } catch {
    return undefined;
  }
};

/** Remove the hidden extra-variables tag from user-visible notes. */
export const stripExtraVariablesTag = (notes?: string | null): string =>
  (notes ?? "").replace(/<!--\s*v2-xvars:.*?-->/gs, "");
