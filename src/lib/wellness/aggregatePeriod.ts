import { format, startOfWeek, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

export type WellnessPeriod = "day" | "week" | "month";

interface WellnessRow {
  tracking_date: string;
  sleep_quality?: number | null;
  general_fatigue?: number | null;
  soreness_upper_body?: number | null;
  soreness_lower_body?: number | null;
  stress_level?: number | null;
  sleep_duration?: number | null;
}

interface AggregatedPoint {
  date: string;
  fullDate: string;
  sleep_quality: number | null;
  general_fatigue: number | null;
  soreness_upper_body: number | null;
  soreness_lower_body: number | null;
  stress_level: number | null;
  sleep_duration: number | null;
  recovery_score: number;
  count: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function average(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (valid.length === 0) return null;
  return round1(valid.reduce((s, v) => s + v, 0) / valid.length);
}

/** Clamp any answer to the valid 1..5 scale (0 / null / out-of-range = not filled → 3). */
const scale = (v: number | null | undefined): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return 3;
  return Math.max(1, Math.min(5, v));
};

function computeRecovery(p: Omit<AggregatedPoint, "date" | "fullDate" | "recovery_score" | "count">): number {
  const raw =
    (scale(p.sleep_quality) +
      (6 - scale(p.general_fatigue)) +
      (6 - scale(p.soreness_lower_body)) +
      (6 - scale(p.soreness_upper_body)) +
      (6 - scale(p.stress_level))) /
    5 *
    20;
  return Math.max(0, Math.min(100, Math.round(raw)));
}


export function aggregateWellnessByPeriod(
  rows: WellnessRow[],
  period: WellnessPeriod
): AggregatedPoint[] {
  if (period === "day") {
    return rows.map((w) => {
      const d = new Date(w.tracking_date);
      const point = {
        sleep_quality: w.sleep_quality ?? null,
        general_fatigue: w.general_fatigue ?? null,
        soreness_upper_body: w.soreness_upper_body ?? null,
        soreness_lower_body: w.soreness_lower_body ?? null,
        stress_level: w.stress_level ?? null,
        sleep_duration: w.sleep_duration ?? null,
      };
      return {
        date: format(d, "dd/MM", { locale: fr }),
        fullDate: format(d, "dd MMM yyyy", { locale: fr }),
        ...point,
        recovery_score: computeRecovery(point),
        count: 1,
      };
    });
  }

  // Bucket
  const buckets = new Map<string, WellnessRow[]>();
  for (const w of rows) {
    const d = new Date(w.tracking_date);
    const bucketDate =
      period === "week" ? startOfWeek(d, { weekStartsOn: 1 }) : startOfMonth(d);
    const key = bucketDate.toISOString();
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(w);
  }

  const sorted = Array.from(buckets.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return sorted.map(([key, group]) => {
    const d = new Date(key);
    const point = {
      sleep_quality: average(group.map((g) => g.sleep_quality)),
      general_fatigue: average(group.map((g) => g.general_fatigue)),
      soreness_upper_body: average(group.map((g) => g.soreness_upper_body)),
      soreness_lower_body: average(group.map((g) => g.soreness_lower_body)),
      stress_level: average(group.map((g) => g.stress_level)),
      sleep_duration: average(group.map((g) => g.sleep_duration)),
    };
    return {
      date:
        period === "week"
          ? `S${format(d, "I", { locale: fr })}`
          : format(d, "MMM yy", { locale: fr }),
      fullDate:
        period === "week"
          ? `Semaine du ${format(d, "dd MMM yyyy", { locale: fr })}`
          : format(d, "MMMM yyyy", { locale: fr }),
      ...point,
      recovery_score: computeRecovery(point),
      count: group.length,
    };
  });
}
