// Agrégation des résultats lancer par lancer en KPI exploitables.
import type { TacticalZone } from "@/lib/constants/bowlingTacticalZones";

export interface ThrowRow {
  id: string;
  block_id: string;
  exercise_index: number;
  throw_number: number;
  ball_arsenal_id: string | null;
  target_zone: string | null;
  actual_zone: string | null;
  foot_board: number | null;
  breakpoint_board: number | null;
  speed_kmh: number | null;
  axis_success: boolean | null;
  speed_success: boolean | null;
  release_success: boolean | null;
  breakpoint_success: boolean | null;
  pocket_success: boolean | null;
  strike_success: boolean | null;
  spare_success: boolean | null;
  success_global: boolean | null;
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);
const countTrue = (rows: ThrowRow[], key: keyof ThrowRow) =>
  rows.filter((r) => r[key] === true).length;
const countAnswered = (rows: ThrowRow[], key: keyof ThrowRow) =>
  rows.filter((r) => r[key] !== null && r[key] !== undefined).length;

export interface BowlingTrainingKPIs {
  total: number;
  axisPct: number;
  speedPct: number;
  releasePct: number;
  breakpointPct: number;
  pocketPct: number;
  strikePct: number;
  pocketStrikePct: number;
  sparePct: number;
  globalPct: number;
  bestStreak: number;
}

export function computeKpis(rows: ThrowRow[]): BowlingTrainingKPIs {
  const pocketStrike = rows.filter((r) => r.pocket_success && r.strike_success).length;

  // best streak (success_global, fallback pocket_success)
  let best = 0;
  let cur = 0;
  for (const r of rows) {
    const ok = r.success_global ?? r.pocket_success ?? false;
    if (ok) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  return {
    total: rows.length,
    axisPct: pct(countTrue(rows, "axis_success"), countAnswered(rows, "axis_success")),
    speedPct: pct(countTrue(rows, "speed_success"), countAnswered(rows, "speed_success")),
    releasePct: pct(countTrue(rows, "release_success"), countAnswered(rows, "release_success")),
    breakpointPct: pct(countTrue(rows, "breakpoint_success"), countAnswered(rows, "breakpoint_success")),
    pocketPct: pct(countTrue(rows, "pocket_success"), countAnswered(rows, "pocket_success")),
    strikePct: pct(countTrue(rows, "strike_success"), countAnswered(rows, "strike_success")),
    pocketStrikePct: pct(pocketStrike, rows.length),
    sparePct: pct(countTrue(rows, "spare_success"), countAnswered(rows, "spare_success")),
    globalPct: pct(countTrue(rows, "success_global"), countAnswered(rows, "success_global")),
    bestStreak: best,
  };
}

export interface ZoneStat {
  zone: string;
  count: number;
  pocketPct: number;
  strikePct: number;
  pocketStrikePct: number;
}

export function statsByZone(rows: ThrowRow[], zones: TacticalZone[]): ZoneStat[] {
  return zones.map((z) => {
    const inZone = rows.filter((r) => (r.actual_zone || r.target_zone) === z.value);
    const ps = inZone.filter((r) => r.pocket_success && r.strike_success).length;
    return {
      zone: z.value,
      count: inZone.length,
      pocketPct: pct(countTrue(inZone, "pocket_success"), countAnswered(inZone, "pocket_success")),
      strikePct: pct(countTrue(inZone, "strike_success"), countAnswered(inZone, "strike_success")),
      pocketStrikePct: pct(ps, inZone.length),
    };
  });
}

export interface BallStat {
  ball_id: string;
  count: number;
  strikePct: number;
  pocketPct: number;
}

export function statsByBall(rows: ThrowRow[]): BallStat[] {
  const map = new Map<string, ThrowRow[]>();
  for (const r of rows) {
    if (!r.ball_arsenal_id) continue;
    const arr = map.get(r.ball_arsenal_id) ?? [];
    arr.push(r);
    map.set(r.ball_arsenal_id, arr);
  }
  return Array.from(map.entries()).map(([ball_id, arr]) => ({
    ball_id,
    count: arr.length,
    strikePct: pct(countTrue(arr, "strike_success"), countAnswered(arr, "strike_success")),
    pocketPct: pct(countTrue(arr, "pocket_success"), countAnswered(arr, "pocket_success")),
  }));
}
