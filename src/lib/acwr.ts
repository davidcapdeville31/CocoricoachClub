/**
 * ACWR (Acute:Chronic Workload Ratio) — calcul unifié pour toute l'application,
 * toutes disciplines confondues.
 *
 * - Charge aiguë   : 7 derniers jours
 * - Charge chronique : 28 derniers jours
 * - Méthodes : moyenne glissante ("rolling") ou pondération exponentielle ("ewma")
 *
 * ⚠️ Ne pas confondre avec le ratio d'ADHÉRENCE (charge réalisée / charge prévue),
 * stocké dans la colonne `awcr_tracking.awcr`. Celui-ci est purement descriptif
 * et n'est jamais soumis aux seuils 0,8 / 1,3.
 */

export type AcwrMethod = "rolling" | "ewma";

export const ACWR_SAFE_MIN = 0.8;
export const ACWR_SAFE_MAX = 1.3;

export interface LoadRow {
  session_date: string;
  rpe?: number | null;
  duration_minutes?: number | null;
  training_load?: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const toDayKey = (d: Date | string) =>
  (typeof d === "string" ? d : d.toISOString()).slice(0, 10);

/** Construit la série journalière de charge (sRPE = RPE × durée) sur `days` jours. */
export function buildDailyLoads(rows: LoadRow[], days = 28, endDate: Date = new Date()): number[] {
  const endDay = new Date(toDayKey(endDate)).getTime();
  const startDay = endDay - (days - 1) * DAY_MS;
  const daily = new Array(days).fill(0);
  for (const row of rows || []) {
    if (!row?.session_date) continue;
    const idx = Math.round((new Date(toDayKey(row.session_date)).getTime() - startDay) / DAY_MS);
    if (idx < 0 || idx >= days) continue;
    const load =
      row.training_load != null && Number.isFinite(Number(row.training_load))
        ? Number(row.training_load)
        : (Number(row.rpe) || 0) * (Number(row.duration_minutes) || 0);
    daily[idx] += load;
  }
  return daily;
}

/** ACWR à partir d'une série journalière de charge. */
export function acwrFromDailyLoads(daily: number[], method: AcwrMethod = "rolling"): number | null {
  if (!daily.length) return null;
  if (method === "rolling") {
    const acute = daily.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const chronic = daily.reduce((a, b) => a + b, 0) / daily.length;
    return chronic > 0 ? acute / chronic : null;
  }
  const lAcute = 2 / (7 + 1);
  const lChronic = 2 / (28 + 1);
  let ewmaA = 0;
  let ewmaC = 0;
  daily.forEach((v, i) => {
    ewmaA = i === 0 ? v : v * lAcute + ewmaA * (1 - lAcute);
    ewmaC = i === 0 ? v : v * lChronic + ewmaC * (1 - lChronic);
  });
  return ewmaC > 0 ? ewmaA / ewmaC : null;
}

/** ACWR directement depuis des lignes de charge (awcr_tracking, sessions, …). */
export function computeAcwr(
  rows: LoadRow[],
  method: AcwrMethod = "rolling",
  endDate: Date = new Date()
): number | null {
  const usable = (rows || []).filter(
    (r) => !(Number(r?.rpe) === 0 && Number(r?.duration_minutes) === 0)
  );
  if (usable.length === 0) return null;
  return acwrFromDailyLoads(buildDailyLoads(usable, 28, endDate), method);
}

/** Convertit un ACWR en score 0-100 (100 = zone optimale 0,8-1,3). */
export function acwrToScore(acwr: number | null): number | null {
  if (acwr === null || !Number.isFinite(acwr)) return null;
  if (acwr >= ACWR_SAFE_MIN && acwr <= ACWR_SAFE_MAX) return 100;
  const raw =
    acwr < ACWR_SAFE_MIN
      ? 100 - (ACWR_SAFE_MIN - acwr) * 150
      : 100 - (acwr - ACWR_SAFE_MAX) * 80;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

/** Niveau de risque associé à un ACWR. */
export function acwrRiskLevel(acwr: number | null): "low" | "medium" | "high" | "unknown" {
  if (acwr === null || !Number.isFinite(acwr)) return "unknown";
  if (acwr < 0.8 || acwr > 1.5) return "high";
  if (acwr < 0.9 || acwr > 1.3) return "medium";
  return "low";
}

/** Libellé court pour l'UI. */
export function acwrLabel(acwr: number | null): string {
  if (acwr === null || !Number.isFinite(acwr)) return "—";
  return acwr.toFixed(2);
}
