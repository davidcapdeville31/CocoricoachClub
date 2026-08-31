/**
 * Persistence helpers for "séries variables" (per-set values) on exercises.
 *
 * Program / session exercises are stored in tables that don't have a dedicated
 * column for per-set data, so we reuse the project-wide hidden HTML-comment
 * pattern inside `notes`: `<!--v2-sets:[{...}]-->`.
 *
 * Generic: works for every discipline and every category.
 */
import type { SetData } from "./variableSetsTypes";

export const VARIABLE_SETS_TAG_REGEX = /<!--\s*v2-sets:(.*?)-->/s;

/** Serialize per-set data into a hidden notes tag. Returns "" when not relevant. */
export const encodeVariableSetsTag = (sets?: SetData[] | null): string => {
  if (!sets || sets.length === 0) return "";
  // Only persist when at least one set carries a value
  const hasValue = sets.some(
    (s) =>
      s.reps !== undefined ||
      s.weight_kg !== undefined ||
      s.percentage !== undefined ||
      s.rpe !== undefined ||
      s.rir !== undefined ||
      s.tempo !== undefined ||
      s.rest_seconds !== undefined,
  );
  if (!hasValue) return "";
  try {
    return `<!--v2-sets:${JSON.stringify(sets)}-->`;
  } catch {
    return "";
  }
};

/** Extract per-set data from an exercise `notes` string. */
export const parseVariableSetsTag = (notes?: string | null): SetData[] | undefined => {
  if (!notes) return undefined;
  const match = notes.match(VARIABLE_SETS_TAG_REGEX);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed) || parsed.length === 0) return undefined;
    return parsed as SetData[];
  } catch {
    return undefined;
  }
};

/** Remove the hidden per-set tag from user-visible notes. */
export const stripVariableSetsTag = (notes?: string | null): string =>
  (notes ?? "").replace(/<!--\s*v2-sets:.*?-->/gs, "");
