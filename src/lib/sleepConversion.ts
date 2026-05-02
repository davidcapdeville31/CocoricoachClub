/**
 * Sleep duration is stored in `wellness_tracking.sleep_duration` as a 1-5 score
 * (consistent with all other wellness components):
 *   1 = >8h (optimal)   2 = 7-8h   3 = 6-7h   4 = 5-6h   5 = <5h (very bad)
 *
 * Athletes input hours (more natural). These helpers keep the conversion in one place.
 */

export const sleepHoursToScore = (hours: number): number => {
  if (!hours || hours <= 0) return 0;
  if (hours >= 8) return 1;
  if (hours >= 7) return 2;
  if (hours >= 6) return 3;
  if (hours >= 5) return 4;
  return 5;
};

/** Approximate hours from a 1-5 score (midpoint of range). */
export const sleepScoreToHours = (score: number): number => {
  switch (score) {
    case 1: return 8.5;
    case 2: return 7.5;
    case 3: return 6.5;
    case 4: return 5.5;
    case 5: return 4.5;
    default: return 0;
  }
};

/** Human-readable label for a 1-5 sleep duration score. */
export const sleepScoreLabel = (score: number): string => {
  switch (score) {
    case 1: return ">8h";
    case 2: return "7-8h";
    case 3: return "6-7h";
    case 4: return "5-6h";
    case 5: return "<5h";
    default: return "—";
  }
};
