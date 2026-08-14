/**
 * Calculate a global fitness score (0-100) combining multiple metrics
 */

import { ACWR_SAFE_MAX, ACWR_SAFE_MIN } from "@/lib/acwr";

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

  // ACWR réel (aigu 7j / chronique 28j) — 40 % du total
  if (input.acwr !== null) {
    if (input.acwr >= ACWR_SAFE_MIN && input.acwr <= ACWR_SAFE_MAX) {
      breakdown.acwrScore = 40;
    } else if (input.acwr > 1.3 && input.acwr <= 1.5) {
      breakdown.acwrScore = 26;
      recommendations.push("Réduire légèrement la charge d'entraînement");
    } else if (input.acwr < 0.8 && input.acwr >= 0.6) {
      breakdown.acwrScore = 20;
      recommendations.push("Augmenter progressivement la charge d'entraînement");
    } else if (input.acwr > 1.5) {
      breakdown.acwrScore = 7;
      recommendations.push("URGENT: Réduire significativement la charge");
    } else {
      breakdown.acwrScore = 7;
      recommendations.push("URGENT: Reprendre l'entraînement progressivement");
    }
  } else {
    breakdown.acwrScore = 20; // Valeur neutre si aucune donnée
  }

  // Wellness (30 %) — inclut déjà la fatigue, pas de sous-score fatigue dédié
  if (input.wellnessAvg !== null) {
    if (input.wellnessAvg <= 1.5) {
      breakdown.wellnessScore = 30;
    } else if (input.wellnessAvg <= 2.5) {
      breakdown.wellnessScore = 24;
    } else if (input.wellnessAvg <= 3.5) {
      breakdown.wellnessScore = 14;
      recommendations.push("Surveiller la récupération et le sommeil");
    } else {
      breakdown.wellnessScore = 6;
      recommendations.push("Prioriser la récupération");
    }
  } else {
    breakdown.wellnessScore = 15;
  }

  // Performance (30 %)
  if (input.recentTestPerformance !== null) {
    breakdown.performanceScore = Math.round((input.recentTestPerformance / 100) * 30);
  } else {
    breakdown.performanceScore = 15;
  }

  // Blessure : plafond de statut, pas de composante pondérée (évite le double comptage)
  if (input.injuryStatus === "recovering") {
    recommendations.push("Respecter le protocole de retour au jeu");
  } else if (input.injuryStatus === "active") {
    recommendations.push("Priorité à la guérison de la blessure");
  }

  const totalScore = Math.max(
    0,
    Math.min(
      100,
      breakdown.acwrScore + breakdown.wellnessScore + breakdown.performanceScore
    )
  );

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
