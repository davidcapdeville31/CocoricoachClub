// Basketball precision exercises (mirror of bowling spare exercises)
// Used by the half-court SVG, dialogs, and stats filters.

export type BasketballPrecisionExerciseValue =
  | "free_throw"
  | "paint_shot"
  | "three_point";

export interface BasketballPrecisionExercise {
  value: BasketballPrecisionExerciseValue;
  label: string;
  /** Allowed clickable region of the half-court for this exercise. */
  region: "free_throw_line" | "paint" | "three_point_arc" | "all";
  description?: string;
}

export const BASKETBALL_PRECISION_EXERCISES: BasketballPrecisionExercise[] = [
  {
    value: "free_throw",
    label: "Lancers francs",
    region: "free_throw_line",
    description: "Lancers depuis la ligne des lancers francs",
  },
  {
    value: "paint_shot",
    label: "Tirs dans la raquette",
    region: "paint",
    description: "Tirs courte distance depuis la raquette",
  },
  {
    value: "three_point",
    label: "Tirs à 3 points",
    region: "three_point_arc",
    description: "Tirs depuis derrière la ligne à 3 points",
  },
];

export const BASKETBALL_PRECISION_LABELS = BASKETBALL_PRECISION_EXERCISES.map(
  (e) => e.label,
);

export function isBasketballPrecisionSport(sportType?: string | null): boolean {
  if (!sportType) return false;
  return sportType.toLowerCase().startsWith("basketball");
}

export function getBasketballExerciseByValue(value: string) {
  return BASKETBALL_PRECISION_EXERCISES.find((e) => e.value === value);
}

export function getBasketballExerciseByLabel(label: string) {
  return BASKETBALL_PRECISION_EXERCISES.find((e) => e.label === label);
}
