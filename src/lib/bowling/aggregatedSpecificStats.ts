// Aggregation utilities for "Stats Spécifiques" bowling sub-tabs.
// Works on raw bowling_throw_results joined with block metadata.

import { getParamLabel, TECHNICAL_PARAMETERS } from "@/lib/constants/bowlingTechnicalParameters";
import { outcomeLabel, TARGET_OUTCOMES } from "@/lib/constants/bowlingTargetOutcomes";
import { TACTICAL_ZONES, zoneShort, type TacticalZone } from "@/lib/constants/bowlingTacticalZones";

export interface ThrowRecord {
  id: string;
  block_id: string;
  athlete_id: string;
  throw_number: number;
  created_at: string;
  ball_arsenal_id: string | null;
  target_zone: string | null;
  actual_zone: string | null;
  target_arrow: string | null;
  foot_board: number | null;
  breakpoint_board: number | null;
  foot_delta: number | null;
  breakpoint_delta: number | null;
  speed_kmh: number | null;
  axis_success: boolean | null;
  speed_success: boolean | null;
  release_success: boolean | null;
  breakpoint_success: boolean | null;
  pocket_success: boolean | null;
  strike_success: boolean | null;
  spare_success: boolean | null;
  success_global: boolean | null;
  parameter_results: Record<string, boolean> | null;
  outcome_results: Record<string, boolean> | null;
  // joined block metadata
  block: {
    id: string;
    block_type: string;
    pattern_id: string | null;
    config: Record<string, unknown> | null;
    objectives: string[] | null;
    session_date: string;
  };
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

// ───────────────────────────── Technical aggregation ─────────────────────────────

export interface AggregatedCriterion {
  id: string;
  label: string;
  category: "technical" | "result";
  ok: number;
  total: number;
  pct: number;
}

export interface AggregatedCombo {
  ids: string[];
  labels: string[];
  ok: number;
  pct: number;
  occurrences: number; // throws where all criteria were answered
}

export interface AggregatedTechnicalStats {
  totalThrows: number;
  perCriterion: AggregatedCriterion[];
  fullTechnicalPct: number;
  fullResultPct: number;
  perfectPct: number;
  averageQuality: number;
  qualityBuckets: { perfect: number; high: number; mid: number; low: number };
  combinations: AggregatedCombo[];
  timeline: Array<{ date: string; quality: number; perfectPct: number; throws: number }>;
  insight: string;
}

function uniqueKeysOf(rows: ThrowRecord[], field: "parameter_results" | "outcome_results"): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const obj = r[field];
    if (obj) Object.keys(obj).forEach((k) => set.add(k));
  }
  return Array.from(set);
}

function combos2<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) out.push([arr[i], arr[j]]);
  return out;
}

export function aggregateTechnicalStats(rows: ThrowRecord[]): AggregatedTechnicalStats {
  const paramKeys = uniqueKeysOf(rows, "parameter_results");
  const outcomeKeys = uniqueKeysOf(rows, "outcome_results");

  const criteria: Array<{ id: string; label: string; category: "technical" | "result"; key: string; src: "parameter_results" | "outcome_results" }> = [
    ...paramKeys.map((k) => ({ id: `param:${k}`, label: getParamLabel(k), category: "technical" as const, key: k, src: "parameter_results" as const })),
    ...outcomeKeys.map((k) => ({ id: `outcome:${k}`, label: outcomeLabel(k), category: "result" as const, key: k, src: "outcome_results" as const })),
  ];

  // Per-criterion aggregate
  const perCriterion: AggregatedCriterion[] = criteria.map((c) => {
    let ok = 0, total = 0;
    for (const r of rows) {
      const v = r[c.src]?.[c.key];
      if (v === true || v === false) { total += 1; if (v) ok += 1; }
    }
    return { id: c.id, label: c.label, category: c.category, ok, total, pct: pct(ok, total) };
  }).sort((a, b) => b.pct - a.pct);

  // Per-throw quality
  const perThrow = rows.map((r) => {
    let techOk = 0, techTotal = 0, resOk = 0, resTotal = 0;
    for (const c of criteria) {
      const v = r[c.src]?.[c.key];
      if (v === true || v === false) {
        if (c.category === "technical") { techTotal += 1; if (v) techOk += 1; }
        else { resTotal += 1; if (v) resOk += 1; }
      }
    }
    const totalExp = techTotal + resTotal;
    const totalOk = techOk + resOk;
    const fullTech = techTotal > 0 && techOk === techTotal;
    const fullRes = resTotal > 0 && resOk === resTotal;
    const perfect = (techTotal > 0 || resTotal > 0) && (techTotal === 0 || fullTech) && (resTotal === 0 || fullRes);
    const quality = totalExp > 0 ? Math.round((totalOk / totalExp) * 100) : 0;
    return { date: r.block.session_date.slice(0, 10), fullTech, fullRes, perfect, quality, techTotal, resTotal };
  });

  const totalThrows = rows.length;
  const fullTechCount = perThrow.filter((t) => t.techTotal > 0 && t.fullTech).length;
  const fullResCount = perThrow.filter((t) => t.resTotal > 0 && t.fullRes).length;
  const fullTechDen = perThrow.filter((t) => t.techTotal > 0).length;
  const fullResDen = perThrow.filter((t) => t.resTotal > 0).length;
  const perfectDen = perThrow.filter((t) => t.techTotal > 0 || t.resTotal > 0).length;
  const perfectCount = perThrow.filter((t) => t.perfect).length;

  const qs = perThrow.map((t) => t.quality);
  const averageQuality = qs.length ? Math.round(qs.reduce((a, b) => a + b, 0) / qs.length) : 0;
  const qualityBuckets = {
    perfect: qs.filter((q) => q === 100).length,
    high: qs.filter((q) => q >= 75 && q < 100).length,
    mid: qs.filter((q) => q >= 50 && q < 75).length,
    low: qs.filter((q) => q < 50).length,
  };

  // Combinations (pairs only, top performing)
  const ids = perCriterion.filter((c) => c.total >= 3).map((c) => c.id);
  const combinations: AggregatedCombo[] = combos2(ids)
    .map((pair) => {
      const refs = pair.map((id) => criteria.find((c) => c.id === id)!);
      let ok = 0, occ = 0;
      for (const r of rows) {
        const vals = refs.map((c) => r[c.src]?.[c.key]);
        if (vals.every((v) => v === true || v === false)) {
          occ += 1;
          if (vals.every((v) => v === true)) ok += 1;
        }
      }
      return { ids: pair, labels: refs.map((r) => r.label), ok, occurrences: occ, pct: pct(ok, occ) };
    })
    .filter((c) => c.occurrences >= 3)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 12);

  // Timeline grouped by day
  const byDay = new Map<string, { q: number[]; perfect: number; total: number }>();
  for (const t of perThrow) {
    const ent = byDay.get(t.date) ?? { q: [], perfect: 0, total: 0 };
    ent.q.push(t.quality);
    if (t.perfect) ent.perfect += 1;
    ent.total += 1;
    byDay.set(t.date, ent);
  }
  const timeline = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      quality: v.q.length ? Math.round(v.q.reduce((a, b) => a + b, 0) / v.q.length) : 0,
      perfectPct: pct(v.perfect, v.total),
      throws: v.total,
    }));

  const fullTechnicalPct = pct(fullTechCount, fullTechDen);
  const fullResultPct = pct(fullResCount, fullResDen);
  const perfectPct = pct(perfectCount, perfectDen);

  // Insight
  const answered = perCriterion.filter((c) => c.total > 0);
  const best = answered[0];
  const worst = answered[answered.length - 1];
  const parts: string[] = [];
  if (best && best.pct >= 70) parts.push(`Le critère « ${best.label} » est bien maîtrisé (${best.pct}%)`);
  if (worst && worst.id !== best?.id && worst.pct <= 50) parts.push(`« ${worst.label} » limite la réussite globale (${worst.pct}%)`);
  if (fullTechnicalPct > 0 && fullResultPct > 0) {
    if (perfectPct >= Math.round(fullResultPct * 0.8)) parts.push("les objectifs résultat sont surtout atteints quand l'ensemble des critères techniques est validé");
    else parts.push("certains objectifs résultat sont atteints sans valider l'intégralité des critères techniques");
  }
  if (combinations[0]) parts.push(`La meilleure combinaison observée est « ${combinations[0].labels.join(" + ")} » (${combinations[0].pct}% sur ${combinations[0].occurrences} lancers)`);
  if (parts.length === 0 && totalThrows > 0) parts.push(`Score qualité moyen : ${averageQuality}% — réussite parfaite ${perfectPct}%`);

  return {
    totalThrows,
    perCriterion,
    fullTechnicalPct,
    fullResultPct,
    perfectPct,
    averageQuality,
    qualityBuckets,
    combinations,
    timeline,
    insight: parts.join(". ") + (parts.length ? "." : ""),
  };
}

// ───────────────────────────── Tactical aggregation ─────────────────────────────

export interface BucketStat {
  key: string;
  label: string;
  count: number;
  pocketPct: number;
  strikePct: number;
  pocketStrikePct: number;
}

export interface AggregatedTacticalStats {
  totalThrows: number;
  byZone: BucketStat[];
  byArrow: BucketStat[];
  byFootBoard: BucketStat[];
  byBreakpoint: BucketStat[];
  byPattern: BucketStat[];
  byBall: BucketStat[];
  movementEfficiency: { footAvgDelta: number; breakpointAvgDelta: number; footOnTargetPct: number; breakpointOnTargetPct: number };
  bestPlayLine: { label: string; pocketStrikePct: number; count: number } | null;
  bestCombination: { label: string; pocketStrikePct: number; count: number } | null;
  heatmap: Array<{ zone: string; short: string; count: number; pocketStrikePct: number }>;
}

function bucketize(
  rows: ThrowRecord[],
  keyOf: (r: ThrowRecord) => string | null | undefined,
  labelOf: (k: string) => string,
): BucketStat[] {
  const map = new Map<string, ThrowRecord[]>();
  for (const r of rows) {
    const k = keyOf(r);
    if (k === null || k === undefined || k === "") continue;
    const arr = map.get(String(k)) ?? [];
    arr.push(r);
    map.set(String(k), arr);
  }
  return Array.from(map.entries())
    .map(([key, arr]) => {
      const ps = arr.filter((r) => r.pocket_success && r.strike_success).length;
      const pocketDen = arr.filter((r) => r.pocket_success !== null).length;
      const strikeDen = arr.filter((r) => r.strike_success !== null).length;
      return {
        key,
        label: labelOf(key),
        count: arr.length,
        pocketPct: pct(arr.filter((r) => r.pocket_success === true).length, pocketDen),
        strikePct: pct(arr.filter((r) => r.strike_success === true).length, strikeDen),
        pocketStrikePct: pct(ps, arr.length),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function aggregateTacticalStats(
  rows: ThrowRecord[],
  ballNameMap: Map<string, string>,
  patternNameMap: Map<string, string>,
): AggregatedTacticalStats {
  const zonesByValue = new Map<string, TacticalZone>(TACTICAL_ZONES.map((z) => [z.value, z]));

  const byZone = bucketize(
    rows,
    (r) => r.actual_zone ?? r.target_zone,
    (k) => zonesByValue.get(k)?.label ?? k,
  );
  const byArrow = bucketize(rows, (r) => r.target_arrow, (k) => `Flèche ${k}`);
  const byFootBoard = bucketize(rows, (r) => (r.foot_board != null ? String(Math.round(r.foot_board)) : null), (k) => `Latte ${k}`);
  const byBreakpoint = bucketize(rows, (r) => (r.breakpoint_board != null ? String(Math.round(r.breakpoint_board)) : null), (k) => `Sortie ${k}`);
  const byPattern = bucketize(rows, (r) => r.block.pattern_id, (k) => patternNameMap.get(k) ?? "Pattern");
  const byBall = bucketize(rows, (r) => r.ball_arsenal_id, (k) => ballNameMap.get(k) ?? "Boule");

  // Movement efficiency: foot_delta/breakpoint_delta (0 = on target)
  const footDeltas = rows.map((r) => r.foot_delta).filter((v): v is number => v != null);
  const bpDeltas = rows.map((r) => r.breakpoint_delta).filter((v): v is number => v != null);
  const footAvgDelta = footDeltas.length ? Math.round((footDeltas.reduce((a, b) => a + Math.abs(b), 0) / footDeltas.length) * 10) / 10 : 0;
  const bpAvgDelta = bpDeltas.length ? Math.round((bpDeltas.reduce((a, b) => a + Math.abs(b), 0) / bpDeltas.length) * 10) / 10 : 0;
  const footOnTargetPct = pct(footDeltas.filter((d) => Math.abs(d) <= 1).length, footDeltas.length);
  const bpOnTargetPct = pct(bpDeltas.filter((d) => Math.abs(d) <= 1).length, bpDeltas.length);

  // Best play line: combination (arrow + foot + breakpoint)
  const lineMap = new Map<string, ThrowRecord[]>();
  for (const r of rows) {
    if (!r.target_arrow || r.foot_board == null || r.breakpoint_board == null) continue;
    const k = `${r.target_arrow}|${Math.round(r.foot_board)}|${Math.round(r.breakpoint_board)}`;
    const arr = lineMap.get(k) ?? [];
    arr.push(r);
    lineMap.set(k, arr);
  }
  const lineCandidates = Array.from(lineMap.entries())
    .filter(([, arr]) => arr.length >= 3)
    .map(([k, arr]) => {
      const [arrow, foot, bp] = k.split("|");
      const ps = arr.filter((r) => r.pocket_success && r.strike_success).length;
      return { label: `Flèche ${arrow} · Latte ${foot} · Sortie ${bp}`, pocketStrikePct: pct(ps, arr.length), count: arr.length };
    })
    .sort((a, b) => b.pocketStrikePct - a.pocketStrikePct);
  const bestPlayLine = lineCandidates[0] ?? null;

  // Best combination: zone + ball
  const comboMap = new Map<string, ThrowRecord[]>();
  for (const r of rows) {
    const z = r.actual_zone ?? r.target_zone;
    if (!z || !r.ball_arsenal_id) continue;
    const k = `${z}|${r.ball_arsenal_id}`;
    const arr = comboMap.get(k) ?? [];
    arr.push(r);
    comboMap.set(k, arr);
  }
  const comboCandidates = Array.from(comboMap.entries())
    .filter(([, arr]) => arr.length >= 3)
    .map(([k, arr]) => {
      const [z, ball] = k.split("|");
      const ps = arr.filter((r) => r.pocket_success && r.strike_success).length;
      const zoneLabel = zonesByValue.get(z)?.label ?? z;
      return { label: `${zoneLabel} · ${ballNameMap.get(ball) ?? "Boule"}`, pocketStrikePct: pct(ps, arr.length), count: arr.length };
    })
    .sort((a, b) => b.pocketStrikePct - a.pocketStrikePct);
  const bestCombination = comboCandidates[0] ?? null;

  // Heatmap by zone
  const heatmap = TACTICAL_ZONES.map((z) => {
    const inZone = rows.filter((r) => (r.actual_zone ?? r.target_zone) === z.value);
    const ps = inZone.filter((r) => r.pocket_success && r.strike_success).length;
    return { zone: z.value, short: zoneShort(z.value), count: inZone.length, pocketStrikePct: pct(ps, inZone.length) };
  }).filter((z) => z.count > 0);

  return {
    totalThrows: rows.length,
    byZone, byArrow, byFootBoard, byBreakpoint, byPattern, byBall,
    movementEfficiency: { footAvgDelta, breakpointAvgDelta: bpAvgDelta, footOnTargetPct, breakpointOnTargetPct: bpOnTargetPct },
    bestPlayLine, bestCombination, heatmap,
  };
}

// Lookups exposed for UI
export { TECHNICAL_PARAMETERS, TARGET_OUTCOMES, TACTICAL_ZONES, zoneShort };
