/**
 * Compute the planned duration (in minutes) of a training session
 * from its start / end times.
 *
 * Handles edge cases so the RPE "Min" field is always pre-filled:
 * - end after start  -> straightforward difference
 * - end before start -> overnight session (e.g. 22:00 → 00:30) when plausible
 * - anything invalid -> sensible fallback
 */
export const DEFAULT_SESSION_DURATION = 60;

export function computeSessionDurationMinutes(
  startTime?: string | null,
  endTime?: string | null,
  fallback: number = DEFAULT_SESSION_DURATION
): number {
  if (!startTime || !endTime) return fallback;

  const parse = (t: string) => {
    const parts = t.split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1] ?? "0", 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const start = parse(startTime);
  const end = parse(endTime);
  if (start === null || end === null) return fallback;

  const diff = end - start;
  if (diff > 0) return diff;

  // End before start: treat as an overnight session only if plausible (<= 4h)
  const overnight = diff + 24 * 60;
  if (overnight > 0 && overnight <= 240) return overnight;

  return fallback;
}
