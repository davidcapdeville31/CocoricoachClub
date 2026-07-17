/**
 * Calcule le niveau atteint par un athlète pour un benchmark donné.
 * Extrait de `BenchmarkComparison` pour être réutilisable (espace athlète, etc.).
 */

export interface BenchmarkLevelLite {
  label: string;
  threshold: number | null;
  color: string;
}

export interface BenchmarkLite {
  lower_is_better: boolean;
  levels: BenchmarkLevelLite[];
  use_body_weight_ratio: boolean;
  body_weight_multiplier: number | null;
}

export interface LevelResult {
  label: string;
  color: string;
  /** Seuil du prochain palier à atteindre (si existant). */
  nextThreshold: number | null;
  nextLabel: string | null;
  /** Seuils ajustés au poids de corps le cas échéant. */
  adjustedLevels: BenchmarkLevelLite[];
}

/**
 * Renvoie le niveau atteint pour `value`, avec les seuils déjà ajustés
 * (par le poids de corps si `use_body_weight_ratio`).
 *
 * Note : si `use_body_weight_ratio` est vrai et qu'un poids est fourni, on
 * multiplie systématiquement `threshold * playerWeight`. Le champ
 * `body_weight_multiplier` est ignoré : les seuils sont déjà des ratios.
 */
export function computeBenchmarkLevel(
  value: number,
  benchmark: BenchmarkLite,
  playerWeight?: number | null,
): LevelResult {
  const empty: LevelResult = {
    label: "N/A",
    color: "#94a3b8",
    nextThreshold: null,
    nextLabel: null,
    adjustedLevels: [],
  };
  const levels = benchmark.levels || [];
  if (!levels.length) return empty;

  const adjustedLevels = levels.map((l) => {
    if (
      benchmark.use_body_weight_ratio &&
      playerWeight &&
      l.threshold != null
    ) {
      return { ...l, threshold: l.threshold * playerWeight };
    }
    return l;
  });

  // Levels ordonnés du pire au meilleur ; on scan du meilleur au pire
  let currentIdx = -1;
  for (let i = adjustedLevels.length - 1; i >= 0; i--) {
    const level = adjustedLevels[i];
    if (level.threshold == null) continue;
    if (benchmark.lower_is_better) {
      if (value <= level.threshold) {
        currentIdx = i;
        break;
      }
    } else {
      if (value >= level.threshold) {
        currentIdx = i;
        break;
      }
    }
  }

  if (currentIdx === -1) {
    const worst = adjustedLevels[0];
    const next = adjustedLevels[1] || null;
    return {
      label: worst?.label || "N/A",
      color: worst?.color || "#ef4444",
      nextThreshold: next?.threshold ?? null,
      nextLabel: next?.label ?? null,
      adjustedLevels,
    };
  }

  const cur = adjustedLevels[currentIdx];
  const next = adjustedLevels[currentIdx + 1] || null;
  return {
    label: cur.label,
    color: cur.color,
    nextThreshold: next?.threshold ?? null,
    nextLabel: next?.label ?? null,
    adjustedLevels,
  };
}
