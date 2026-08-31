import { isBodyWeightTestRecord, type CustomWeightTestLite, type GenericWeightTestRow } from "@/lib/benchmarks/playerWeights";

export type WeightSource = "body_composition" | "measurement" | "test" | "wellness";

export interface WeightEntry {
  player_id: string;
  date: string; // yyyy-MM-dd
  weight: number;
  source: WeightSource;
  createdAt: string;
}

export function isPlausibleWeight(value: unknown): value is number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 20 && n <= 200;
}

/** Detect a wellness custom question that stores a body weight in kg. */
export function isWeightQuestionKeyLabel(label: string | undefined | null): boolean {
  const l = (label || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return l.includes("poids") || l.includes("weight") || l.includes("masse corporelle");
}

export function collectWeightHistory({
  bodyComps = [],
  playerMeasurements = [],
  genericTests = [],
  customTests = [],
  wellness = [],
  weightQuestionKeys = [],
}: {
  bodyComps?: any[];
  playerMeasurements?: any[];
  genericTests?: GenericWeightTestRow[];
  customTests?: CustomWeightTestLite[];
  wellness?: any[];
  weightQuestionKeys?: string[];
}): WeightEntry[] {
  const entries: WeightEntry[] = [];

  const push = (
    player_id: string,
    weight: unknown,
    date: string | null | undefined,
    source: WeightSource,
    createdAt?: string | null,
  ) => {
    if (!isPlausibleWeight(weight) || !date) return;
    entries.push({
      player_id,
      date: String(date).slice(0, 10),
      weight: Number(weight),
      source,
      createdAt: createdAt || "",
    });
  };

  for (const r of bodyComps) push(r.player_id, r.weight_kg, r.measurement_date, "body_composition", r.created_at);
  for (const r of playerMeasurements) push(r.player_id, r.weight_kg, r.measurement_date, "measurement", r.created_at);
  for (const r of genericTests) {
    if (isBodyWeightTestRecord(r, customTests)) {
      push(r.player_id, r.result_value, r.test_date, "test", r.created_at);
    }
  }
  for (const r of wellness) {
    const answers = (r.custom_answers || {}) as Record<string, unknown>;
    for (const key of weightQuestionKeys) {
      if (answers[key] != null) push(r.player_id, answers[key], r.tracking_date, "wellness", r.created_at);
    }
  }

  // Dedupe: keep the latest entry per player+date
  const byKey = new Map<string, WeightEntry>();
  for (const e of entries) {
    const k = `${e.player_id}|${e.date}`;
    const cur = byKey.get(k);
    if (!cur || e.createdAt.localeCompare(cur.createdAt) >= 0) byKey.set(k, e);
  }

  return Array.from(byKey.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function latestWeightsByPlayer(entries: WeightEntry[]): Map<string, number> {
  const latest = new Map<string, WeightEntry>();
  for (const entry of entries) {
    const current = latest.get(entry.player_id);
    if (
      !current ||
      entry.date > current.date ||
      (entry.date === current.date && entry.createdAt >= current.createdAt)
    ) {
      latest.set(entry.player_id, entry);
    }
  }
  return new Map(Array.from(latest, ([playerId, entry]) => [playerId, entry.weight]));
}

export function weightTrend(entries: WeightEntry[]) {
  if (entries.length === 0) return null;
  const last = entries[entries.length - 1];
  const prev = entries.length > 1 ? entries[entries.length - 2] : null;
  const first = entries[0];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const monthRef = entries.find((e) => e.date >= cutoffStr) || first;
  return {
    current: last.weight,
    currentDate: last.date,
    deltaPrev: prev ? Number((last.weight - prev.weight).toFixed(1)) : null,
    delta30: Number((last.weight - monthRef.weight).toFixed(1)),
    min: Math.min(...entries.map((e) => e.weight)),
    max: Math.max(...entries.map((e) => e.weight)),
    count: entries.length,
  };
}
