// Stats avancées pour un bloc d'entraînement bowling (technique + objectifs résultat).
// Données source : tableau de lancers (bowling_throw_results) avec parameter_results / outcome_results JSON.

import { getParamLabel } from "@/lib/constants/bowlingTechnicalParameters";
import { outcomeLabel } from "@/lib/constants/bowlingTargetOutcomes";

export type CriterionCategory = "technical" | "result";

export interface CriterionDef {
  id: string;
  label: string;
  category: CriterionCategory;
}

export interface ThrowResultRow {
  id?: string;
  throw_number: number;
  parameter_results?: Record<string, boolean> | null;
  outcome_results?: Record<string, boolean> | null;
}

export interface PerThrowResult {
  throw_number: number;
  results: Record<string, boolean | null>;
  technical_ok: number;
  technical_total: number;
  result_ok: number;
  result_total: number;
  full_technical_success: boolean;
  full_result_success: boolean;
  perfect_success: boolean;
  quality_score: number; // 0..100
}

export interface CriterionStat {
  id: string;
  label: string;
  category: CriterionCategory;
  ok: number;
  total: number;
  pct: number;
}

export interface QualityBuckets {
  perfect: number;     // 100
  high: number;        // 75-99
  mid: number;         // 50-74
  low: number;         // <50
}

export interface CombinationStat {
  ids: string[];
  labels: string[];
  ok: number;
  pct: number;
}

export interface TechnicalBlockStats {
  totalThrows: number;
  criteria: CriterionDef[];
  perThrow: PerThrowResult[];
  perCriterion: CriterionStat[];
  fullTechnicalPct: number;     // % de lancers où TOUS les critères techniques sont OK
  fullResultPct: number;        // % de lancers où TOUS les objectifs résultat sont OK
  perfectPct: number;           // % de lancers où TOUT est OK
  averageQuality: number;
  bestQuality: number;
  worstQuality: number;
  qualityBuckets: QualityBuckets;
  combinations: CombinationStat[];
  insight: string;
}

export function buildCriteriaFromBlock(
  selectedParams: string[],
  selectedOutcomes: string[],
): CriterionDef[] {
  return [
    ...selectedParams.map<CriterionDef>((p) => ({
      id: `param:${p}`,
      label: getParamLabel(p),
      category: "technical",
    })),
    ...selectedOutcomes.map<CriterionDef>((o) => ({
      id: `outcome:${o}`,
      label: outcomeLabel(o),
      category: "result",
    })),
  ];
}

function readCriterion(row: ThrowResultRow, c: CriterionDef): boolean | null {
  const [kind, key] = c.id.split(":");
  const src = kind === "param" ? row.parameter_results : row.outcome_results;
  const v = src?.[key];
  return v === true || v === false ? v : null;
}

function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 100) : 0;
}

// k-combinations of an array
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const out: T[][] = [];
  const rec = (start: number, chosen: T[]) => {
    if (chosen.length === k) {
      out.push(chosen);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      rec(i + 1, [...chosen, arr[i]]);
    }
  };
  rec(0, []);
  return out;
}

export function computeTechnicalBlockStats(
  rows: ThrowResultRow[],
  selectedParams: string[],
  selectedOutcomes: string[],
): TechnicalBlockStats {
  const criteria = buildCriteriaFromBlock(selectedParams, selectedOutcomes);
  const technical = criteria.filter((c) => c.category === "technical");
  const result = criteria.filter((c) => c.category === "result");

  // Per-throw computation
  const perThrow: PerThrowResult[] = rows.map((r) => {
    const results: Record<string, boolean | null> = {};
    let okTech = 0;
    let okRes = 0;
    let totalAnswered = 0;
    let okAnswered = 0;
    for (const c of criteria) {
      const v = readCriterion(r, c);
      results[c.id] = v;
      if (v !== null) {
        totalAnswered += 1;
        if (v) okAnswered += 1;
      }
      if (c.category === "technical" && v === true) okTech += 1;
      if (c.category === "result" && v === true) okRes += 1;
    }
    const technicalTotal = technical.length;
    const resultTotal = result.length;
    const fullTech = technicalTotal > 0 && okTech === technicalTotal;
    const fullRes = resultTotal > 0 && okRes === resultTotal;
    const perfect =
      (technicalTotal > 0 || resultTotal > 0) &&
      (technicalTotal === 0 || fullTech) &&
      (resultTotal === 0 || fullRes);
    // Quality score : % de critères réussis sur l'ensemble des critères attendus (pas seulement ceux répondus)
    const totalExpected = technicalTotal + resultTotal;
    const totalOk = okTech + okRes;
    const quality = totalExpected > 0 ? Math.round((totalOk / totalExpected) * 100) : 0;
    return {
      throw_number: r.throw_number,
      results,
      technical_ok: okTech,
      technical_total: technicalTotal,
      result_ok: okRes,
      result_total: resultTotal,
      full_technical_success: fullTech,
      full_result_success: fullRes,
      perfect_success: perfect,
      quality_score: quality,
    };
  });

  // Per-criterion stats
  const perCriterion: CriterionStat[] = criteria.map((c) => {
    let ok = 0;
    let total = 0;
    for (const r of rows) {
      const v = readCriterion(r, c);
      if (v !== null) {
        total += 1;
        if (v) ok += 1;
      }
    }
    return { id: c.id, label: c.label, category: c.category, ok, total, pct: pct(ok, total) };
  });

  // Aggregates
  const totalThrows = rows.length;
  const fullTechCount = perThrow.filter((t) => t.full_technical_success).length;
  const fullResCount = perThrow.filter((t) => t.full_result_success).length;
  const perfectCount = perThrow.filter((t) => t.perfect_success).length;
  const fullTechnicalPct =
    technical.length > 0 ? pct(fullTechCount, totalThrows) : 0;
  const fullResultPct = result.length > 0 ? pct(fullResCount, totalThrows) : 0;
  const perfectPct = pct(perfectCount, totalThrows);

  const qualities = perThrow.map((t) => t.quality_score);
  const averageQuality =
    qualities.length > 0
      ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length)
      : 0;
  const bestQuality = qualities.length ? Math.max(...qualities) : 0;
  const worstQuality = qualities.length ? Math.min(...qualities) : 0;
  const qualityBuckets: QualityBuckets = {
    perfect: qualities.filter((q) => q === 100).length,
    high: qualities.filter((q) => q >= 75 && q < 100).length,
    mid: qualities.filter((q) => q >= 50 && q < 75).length,
    low: qualities.filter((q) => q < 50).length,
  };

  // Combinations (size >= 2). Cap to keep UI usable.
  const N = criteria.length;
  const combos: CriterionDef[][] = [];
  if (N >= 2 && N <= 6) {
    for (let k = 2; k <= N; k++) combos.push(...combinations(criteria, k));
  } else if (N > 6) {
    combos.push(...combinations(criteria, 2));
    combos.push(...combinations(criteria, 3));
    combos.push(criteria); // full set
  }
  const combinationsStats: CombinationStat[] = combos.map((cset) => {
    const ok = perThrow.filter((t) => cset.every((c) => t.results[c.id] === true)).length;
    return {
      ids: cset.map((c) => c.id),
      labels: cset.map((c) => c.label),
      ok,
      pct: pct(ok, totalThrows),
    };
  });

  // Auto-insight (FR)
  const insight = buildInsight(perCriterion, perfectPct, averageQuality, fullTechnicalPct, fullResultPct);

  return {
    totalThrows,
    criteria,
    perThrow,
    perCriterion,
    fullTechnicalPct,
    fullResultPct,
    perfectPct,
    averageQuality,
    bestQuality,
    worstQuality,
    qualityBuckets,
    combinations: combinationsStats,
    insight,
  };
}

function buildInsight(
  perCriterion: CriterionStat[],
  perfectPct: number,
  avgQuality: number,
  fullTechPct: number,
  fullResPct: number,
): string {
  if (perCriterion.length === 0) return "";
  const answered = perCriterion.filter((c) => c.total > 0);
  if (answered.length === 0) return "Pas encore assez de données pour analyser le bloc.";
  const sorted = [...answered].sort((a, b) => b.pct - a.pct);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const parts: string[] = [];
  if (best && best.pct >= 70) {
    parts.push(`Le critère « ${best.label} » est bien maîtrisé (${best.pct}%)`);
  }
  if (worst && worst.id !== best?.id && worst.pct <= 50) {
    parts.push(`« ${worst.label} » limite la réussite globale (${worst.pct}%)`);
  }
  if (fullTechPct > 0 && fullResPct > 0) {
    if (perfectPct >= fullResPct * 0.8) {
      parts.push("les objectifs résultat sont surtout atteints quand l'ensemble des critères techniques est validé");
    } else {
      parts.push("certains objectifs résultat sont atteints sans valider l'intégralité des critères techniques");
    }
  }
  if (parts.length === 0) {
    parts.push(`Score qualité moyen : ${avgQuality}% — il reste de la marge pour atteindre la réussite parfaite (${perfectPct}%)`);
  }
  return parts.join(". ") + ".";
}
