/**
 * Calculate a global fitness score (0-100) combining multiple metrics
 */

import { ACWR_SAFE_MAX, ACWR_SAFE_MIN } from "@/lib/acwr";

/** Pondération wellness-first : Wellness 40 % > Performance 30 % > ACWR 30 % */
export const FITNESS_WEIGHTS = { wellness: 40, performance: 30, acwr: 30 } as const;

interface FitnessScoreInput {
  /** ACWR réel : charge aiguë 7j / charge chronique 28j */
  acwr: number | null;
  wellnessAvg: number | null; // 1-5 scale, lower is better
  recentTestPerformance: number | null; // 0-100 percentile
  injuryStatus: "none" | "recovering" | "active";
  trainingLoadTrend: "stable" | "increasing" | "decreasing" | "unknown";
}

interface FitnessScoreResult {
  score: number;
  breakdown: {
    acwrScore: number;
    wellnessScore: number;
    performanceScore: number;
    injuryScore: number;
  };
  status: "optimal" | "attention" | "critical";
  recommendations: string[];
}

export function calculateFitnessScore(input: FitnessScoreInput): FitnessScoreResult {
  const breakdown = {
    acwrScore: 0,
    wellnessScore: 0,
    performanceScore: 0,
    injuryScore: 0,
  };
  const recommendations: string[] = [];

  // Hiérarchie wellness-first : le wellness (indicateur le mieux étayé) pèse plus que
  // l'ACWR (valeur prédictive débattue). Les composantes sans donnée sont ignorées
  // et le total est renormalisé sur les composantes disponibles.
  let acwrRatio: number | null = null;
  let wellnessRatio: number | null = null;
  let performanceRatio: number | null = null;

  // ACWR réel (aigu 7j / chronique 28j) — poids 30 %
  if (input.acwr !== null) {
    if (input.acwr >= ACWR_SAFE_MIN && input.acwr <= ACWR_SAFE_MAX) {
      acwrRatio = 1;
    } else if (input.acwr > 1.3 && input.acwr <= 1.5) {
      acwrRatio = 0.65;
      recommendations.push("Réduire légèrement la charge d'entraînement");
    } else if (input.acwr < 0.8 && input.acwr >= 0.6) {
      acwrRatio = 0.5;
      recommendations.push("Augmenter progressivement la charge d'entraînement");
    } else if (input.acwr > 1.5) {
      acwrRatio = 0.18;
      recommendations.push("URGENT: Réduire significativement la charge");
    } else {
      acwrRatio = 0.18;
      recommendations.push("URGENT: Reprendre l'entraînement progressivement");
    }
  }

  // Wellness — poids 40 % (inclut déjà la fatigue, pas de sous-score dédié)
  if (input.wellnessAvg !== null) {
    if (input.wellnessAvg <= 1.5) {
      wellnessRatio = 1;
    } else if (input.wellnessAvg <= 2.5) {
      wellnessRatio = 0.8;
    } else if (input.wellnessAvg <= 3.5) {
      wellnessRatio = 0.47;
      recommendations.push("Surveiller la récupération et le sommeil");
    } else {
      wellnessRatio = 0.2;
      recommendations.push("Prioriser la récupération");
    }
  }

  // Performance — poids 30 %
  if (input.recentTestPerformance !== null) {
    performanceRatio = Math.max(0, Math.min(1, input.recentTestPerformance / 100));
  }

  breakdown.acwrScore = Math.round((acwrRatio ?? 0) * FITNESS_WEIGHTS.acwr);
  breakdown.wellnessScore = Math.round((wellnessRatio ?? 0) * FITNESS_WEIGHTS.wellness);
  breakdown.performanceScore = Math.round((performanceRatio ?? 0) * FITNESS_WEIGHTS.performance);

  // Blessure : plafond de statut, pas de composante pondérée (évite le double comptage)
  if (input.injuryStatus === "recovering") {
    recommendations.push("Respecter le protocole de retour au jeu");
  } else if (input.injuryStatus === "active") {
    recommendations.push("Priorité à la guérison de la blessure");
  }

  // Renormalisation sur les seules composantes disponibles
  let weightedSum = 0;
  let totalWeight = 0;
  if (acwrRatio !== null) { weightedSum += acwrRatio * FITNESS_WEIGHTS.acwr; totalWeight += FITNESS_WEIGHTS.acwr; }
  if (wellnessRatio !== null) { weightedSum += wellnessRatio * FITNESS_WEIGHTS.wellness; totalWeight += FITNESS_WEIGHTS.wellness; }
  if (performanceRatio !== null) { weightedSum += performanceRatio * FITNESS_WEIGHTS.performance; totalWeight += FITNESS_WEIGHTS.performance; }

  const totalScore = totalWeight > 0
    ? Math.max(0, Math.min(100, Math.round((weightedSum / totalWeight) * 100)))
    : 0;

  let status: "optimal" | "attention" | "critical";
  if (totalScore >= 70) {
    status = "optimal";
  } else if (totalScore >= 50) {
    status = "attention";
  } else {
    status = "critical";
  }

  // Plafond blessure
  if (input.injuryStatus === "active") {
    status = "critical";
  } else if (input.injuryStatus === "recovering" && status === "optimal") {
    status = "attention";
  }

  return {
    score: totalScore,
    breakdown,
    status,
    recommendations,
  };
}

/**
 * Get color class based on score
 */
export function getScoreColorClass(score: number): string {
  if (score >= 70) return "text-status-optimal";
  if (score >= 50) return "text-status-attention";
  return "text-status-critical";
}

/**
 * Get background color class based on score
 */
export function getScoreBgClass(score: number): string {
  if (score >= 70) return "bg-status-optimal/10";
  if (score >= 50) return "bg-status-attention/10";
  return "bg-status-critical/10";
}
