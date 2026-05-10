// Wellness scale color helpers (1 → 5)
// Green = best, Red = worst — direction depends on the metric semantics.

export type WellnessTone = "green-strong" | "green" | "yellow" | "orange" | "red";

const TONE_STYLES: Record<
  WellnessTone,
  { selected: string; unselected: string; selectedRing: string }
> = {
  "green-strong": {
    selected: "bg-emerald-500 border-emerald-600 text-white",
    unselected: "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200",
    selectedRing: "ring-emerald-500/40",
  },
  green: {
    selected: "bg-lime-500 border-lime-600 text-white",
    unselected: "bg-lime-50 border-lime-200 text-lime-800 hover:bg-lime-100 dark:bg-lime-950/40 dark:border-lime-800 dark:text-lime-200",
    selectedRing: "ring-lime-500/40",
  },
  yellow: {
    selected: "bg-yellow-400 border-yellow-500 text-yellow-950",
    unselected: "bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-950/40 dark:border-yellow-800 dark:text-yellow-200",
    selectedRing: "ring-yellow-400/40",
  },
  orange: {
    selected: "bg-orange-500 border-orange-600 text-white",
    unselected: "bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-200",
    selectedRing: "ring-orange-500/40",
  },
  red: {
    selected: "bg-red-600 border-red-700 text-white",
    unselected: "bg-red-50 border-red-200 text-red-800 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200",
    selectedRing: "ring-red-600/40",
  },
};

const TONE_ORDER: WellnessTone[] = ["green-strong", "green", "yellow", "orange", "red"];

/**
 * Get the tone for a 1-5 wellness value.
 * @param value 1..5
 * @param inverted true if 1 = best (e.g. fatigue, douleurs, stress, durée sommeil score),
 *                 false if 5 = best (e.g. qualité sommeil)
 */
export function getWellnessTone(value: number, inverted: boolean): WellnessTone {
  const idx = Math.min(5, Math.max(1, Math.round(value))) - 1;
  return inverted ? TONE_ORDER[idx] : TONE_ORDER[4 - idx];
}

export function getWellnessButtonClasses(
  value: number,
  inverted: boolean,
  selected: boolean,
): string {
  const tone = getWellnessTone(value, inverted);
  const styles = TONE_STYLES[tone];
  return selected
    ? `${styles.selected} ring-2 ${styles.selectedRing} shadow-sm`
    : styles.unselected;
}
