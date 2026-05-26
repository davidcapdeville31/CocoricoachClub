// Weighted Wellness Score Calculation
// Fatigue and pain indicators are weighted more heavily as they are stronger predictors of injury risk
//
// IMPORTANT: All internal computations use a normalised "concern" scale where
// 1 = best / no concern  →  5 = worst / high concern.
// Standard wellness questions can be positive (sleep) or negative (fatigue, stress, soreness);
// we automatically invert positive ones so the final score is always comparable.

import type { WellnessQuestion } from "@/lib/wellness/questionConfig";

export interface WellnessEntry {
  sleep_quality: number;
  sleep_duration: number;
  general_fatigue: number;
  stress_level: number;
  soreness_upper_body: number;
  soreness_lower_body: number;
  has_specific_pain?: boolean;
  pain_location?: string | null;
  // Optional custom questions stored as { custom_xxx: 1..5 }
  custom_answers?: Record<string, number>;
}

// Weights for wellness components (total = 1.0)
const WELLNESS_WEIGHTS = {
  sleep_quality: 0.12,
  sleep_duration: 0.12,
  general_fatigue: 0.22,
  stress_level: 0.14,
  soreness_upper_body: 0.18,
  soreness_lower_body: 0.22,
};

// Default inversion semantics for STANDARD keys when no custom config is provided.
// true  = stored value already means "higher = worse" (no transform needed)
// false = stored value means "higher = better" → we invert via (6 - v)
const STANDARD_INVERTED: Record<keyof typeof WELLNESS_WEIGHTS, boolean> = {
  sleep_quality: false,
  sleep_duration: false,
  general_fatigue: true,
  stress_level: true,
  soreness_upper_body: true,
  soreness_lower_body: true,
};

/** Convert any 1..5 answer to a 1..5 "concern" value (5 = worst). */
function toConcern(value: number, inverted: boolean): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.max(1, Math.min(5, value));
  return inverted ? clamped : 6 - clamped;
}

/**
 * Build a per-key inversion map. If a customised questions config is provided,
 * it overrides the defaults (so admins customising a scale automatically
 * propagates to workload/health risk calculations).
 */
function buildInversionMap(questions?: WellnessQuestion[] | null) {
  const map: Record<string, boolean> = { ...STANDARD_INVERTED };
  if (questions && questions.length > 0) {
    for (const q of questions) {
      map[q.key] = !!q.inverted;
    }
  }
  return map;
}

/**
 * Calculate weighted wellness score (1-5 scale).
 * Always returns "higher = more concerning", regardless of how the underlying
 * questions are oriented in the category's customised configuration.
 *
 * @param entry  raw wellness entry as stored in DB
 * @param questions optional category-specific question config (from useWellnessQuestions)
 */
export function calculateWeightedWellnessScore(
  entry: WellnessEntry,
  questions?: WellnessQuestion[] | null,
): number {
  const inv = buildInversionMap(questions);

  // Standard, weighted components
  const weightedSum =
    toConcern(entry.sleep_quality, inv.sleep_quality) * WELLNESS_WEIGHTS.sleep_quality +
    toConcern(entry.sleep_duration, inv.sleep_duration) * WELLNESS_WEIGHTS.sleep_duration +
    toConcern(entry.general_fatigue, inv.general_fatigue) * WELLNESS_WEIGHTS.general_fatigue +
    toConcern(entry.stress_level, inv.stress_level) * WELLNESS_WEIGHTS.stress_level +
    toConcern(entry.soreness_upper_body, inv.soreness_upper_body) * WELLNESS_WEIGHTS.soreness_upper_body +
    toConcern(entry.soreness_lower_body, inv.soreness_lower_body) * WELLNESS_WEIGHTS.soreness_lower_body;

  // Custom enabled questions: distributed equally, capped at +0.20 total impact
  // so they refine the score without overwhelming the standard injury predictors.
  let customAdjustment = 0;
  if (questions && entry.custom_answers) {
    const customQs = questions.filter((q) => q.is_custom && q.enabled);
    if (customQs.length > 0) {
      const perQ = 0.2 / customQs.length;
      for (const q of customQs) {
        const raw = entry.custom_answers[q.key];
        if (typeof raw === "number") {
          customAdjustment += (toConcern(raw, !!q.inverted) - 3) * perQ * 0.5;
        }
      }
    }
  }

  return Math.round((weightedSum + customAdjustment) * 100) / 100;
}

/**
 * Get risk level from weighted wellness score
 */
export function getWellnessRiskLevel(score: number, hasSpecificPain: boolean): "low" | "medium" | "high" | "critical" {
  if (hasSpecificPain && score >= 3.5) return "critical";
  if (hasSpecificPain || score >= 4) return "high";
  if (score >= 3) return "medium";
  return "low";
}

/**
 * Detect wellness trend over multiple days
 */
export function detectWellnessTrend(
  entries: WellnessEntry[],
  questions?: WellnessQuestion[] | null,
): {
  trend: "improving" | "stable" | "declining" | "rapid_decline";
  change: number;
  daysAnalyzed: number;
} {
  if (entries.length < 3) {
    return { trend: "stable", change: 0, daysAnalyzed: entries.length };
  }

  const recentEntries = entries.slice(0, Math.min(7, entries.length));
  const scores = recentEntries.map((e) => calculateWeightedWellnessScore(e, questions)).reverse();

  if (scores.length < 2) {
    return { trend: "stable", change: 0, daysAnalyzed: scores.length };
  }

  let totalChange = 0;
  for (let i = 1; i < scores.length; i++) {
    totalChange += scores[i] - scores[i - 1];
  }
  const avgChange = totalChange / (scores.length - 1);

  let trend: "improving" | "stable" | "declining" | "rapid_decline" = "stable";
  if (avgChange <= -0.3) trend = "improving";
  else if (avgChange >= 0.5) trend = "rapid_decline";
  else if (avgChange >= 0.2) trend = "declining";

  const recentScores = scores.slice(-3);
  const isConsistentlyDeclining = recentScores.every(
    (score, i) => i === 0 || score >= recentScores[i - 1],
  );
  if (isConsistentlyDeclining && avgChange > 0.1) {
    trend = avgChange >= 0.3 ? "rapid_decline" : "declining";
  }

  return {
    trend,
    change: Math.round(avgChange * 100) / 100,
    daysAnalyzed: scores.length,
  };
}

/**
 * Generate smart alert based on wellness data and trends
 */
export function generateWellnessAlert(
  currentScore: number,
  hasSpecificPain: boolean,
  trend: "improving" | "stable" | "declining" | "rapid_decline",
  awcr: number | null,
): {
  type: "info" | "warning" | "critical";
  message: string;
  recommendations: string[];
} | null {
  const recommendations: string[] = [];

  if (hasSpecificPain && (currentScore >= 3.5 || trend === "rapid_decline")) {
    recommendations.push("Consultation médicale recommandée");
    recommendations.push("Repos actif ou repos complet selon douleur");
    recommendations.push("Éviter les impacts et charges lourdes");
    return {
      type: "critical",
      message: "Risque blessure critique - Douleur signalée avec fatigue élevée",
      recommendations,
    };
  }

  if (trend === "rapid_decline") {
    recommendations.push("Réduire l'intensité des séances");
    recommendations.push("Privilégier la récupération (sommeil, nutrition)");
    recommendations.push("Surveiller l'évolution quotidienne");
    return {
      type: "warning",
      message: "Détérioration rapide du wellness détectée sur les derniers jours",
      recommendations,
    };
  }

  if (currentScore >= 3.5 && trend === "declining") {
    recommendations.push("Adapter la charge d'entraînement");
    recommendations.push("Augmenter le temps de récupération");
    return {
      type: "warning",
      message: "Wellness en baisse - Fatigue accumulée",
      recommendations,
    };
  }

  if (awcr !== null && (awcr > 1.4 || awcr < 0.85) && currentScore >= 3) {
    recommendations.push("Charge aiguë élevée combinée à fatigue");
    recommendations.push("Risque de blessure augmenté - Adapter le programme");
    return {
      type: "warning",
      message: "Combinaison AWCR + Wellness à risque",
      recommendations,
    };
  }

  if (trend === "declining" && currentScore >= 2.5) {
    return {
      type: "info",
      message: "Tendance à surveiller - Wellness en légère baisse",
      recommendations: ["Continuer le suivi quotidien"],
    };
  }

  return null;
}

/**
 * Calculate EWMA (Exponential Weighted Moving Average) for AWCR
 */
export function calculateEWMA(values: number[], lambda: number = 0.1): number {
  if (values.length === 0) return 0;
  let ewma = values[0];
  for (let i = 1; i < values.length; i++) {
    ewma = lambda * values[i] + (1 - lambda) * ewma;
  }
  return Math.round(ewma * 100) / 100;
}
