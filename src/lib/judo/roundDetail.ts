// Per-round (per-combat) helpers: friendly labels + filter to only filled stats.

export type StatFormat = "int" | "duration" | "percent";

export interface RoundStatEntry {
  key: string;
  label: string;
  value: number;
  format: StatFormat;
  /** Positive = "for the athlete" (green), Negative = "against" (red), Neutral = gray */
  polarity: "for" | "against" | "neutral";
}

interface StatMeta {
  label: string;
  format: StatFormat;
  polarity: "for" | "against" | "neutral";
}

// Raw stat_data keys → friendly meta. Anything not listed will be displayed
// with the raw key as label (still hidden if 0).
const STAT_META: Record<string, StatMeta> = {
  // Scores
  ijf_ippon_me: { label: "Ippon pour", format: "int", polarity: "for" },
  ijf_ippon_opp: { label: "Ippon contre", format: "int", polarity: "against" },
  ijf_wazari_me: { label: "Waza-ari pour", format: "int", polarity: "for" },
  ijf_wazari_opp: { label: "Waza-ari contre", format: "int", polarity: "against" },
  // Discipline
  ijf_shido_me: { label: "Shido reçus", format: "int", polarity: "against" },
  ijf_shido_opp: { label: "Shido adverses", format: "int", polarity: "for" },
  ijf_hansoku_direct_me: { label: "Hansoku-make subis", format: "int", polarity: "against" },
  ijf_hansoku_direct_opp: { label: "Hansoku-make provoqués", format: "int", polarity: "for" },
  // Ne-waza
  ijf_osaekomi_me_sec: { label: "Osaekomi (pour)", format: "duration", polarity: "for" },
  ijf_osaekomi_opp_sec: { label: "Osaekomi (contre)", format: "duration", polarity: "against" },
  immobilizationAttempts: { label: "Immobilisations tentées", format: "int", polarity: "neutral" },
  ijf_immo_success: { label: "Immobilisations réussies", format: "int", polarity: "for" },
  chokeAttempts: { label: "Étranglements tentés", format: "int", polarity: "neutral" },
  ijf_choke_success: { label: "Étranglements réussis", format: "int", polarity: "for" },
  armLockAttempts: { label: "Clés tentées", format: "int", polarity: "neutral" },
  ijf_armlock_success: { label: "Clés réussies", format: "int", polarity: "for" },
  ijf_submission_me: { label: "Abandons provoqués", format: "int", polarity: "for" },
  ijf_submission_opp: { label: "Abandons subis", format: "int", polarity: "against" },
  groundTimeSeconds: { label: "Temps au sol", format: "duration", polarity: "neutral" },
  // Défense
  ijf_def_attacks_received: { label: "Attaques reçues", format: "int", polarity: "against" },
  ijf_def_attacks_neutralized: { label: "Attaques neutralisées", format: "int", polarity: "for" },
  ijf_def_scores_conceded: { label: "Scores concédés", format: "int", polarity: "against" },
  // Tactique
  goldenScore: { label: "Golden Score", format: "int", polarity: "neutral" },
  combatDuration: { label: "Durée du combat", format: "duration", polarity: "neutral" },
  ijf_dominance_standing: { label: "Dominance debout", format: "percent", polarity: "for" },
};

// Keys that are internal/auto-computed and already reflected by the result badge
// or other visible stats. Hide them from the "Détails par combat" chips.
const HIDDEN_KEYS = new Set<string>([
  "ijf_end_method",
  "endMethod",
  "victoryModeIppon",
  "victoryModeWazaari",
  "victoryModeWazaAri",
  "victoryModeDecision",
  "victoryModeHansoku",
  "victoryModeYuko",
  "hansokuMake",
  "result",
  "winner",
]);

export function formatStatValue(value: number, format: StatFormat): string {
  if (format === "percent") return `${Math.round(value)}%`;
  if (format === "duration") {
    const sec = Math.round(value);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m${s.toString().padStart(2, "0")}` : `${s}s`;
  }
  return Math.round(value).toString();
}

/** Returns only the filled entries (value > 0), preserving a stable display order. */
export function extractFilledRoundStats(
  stats: Record<string, number> | null | undefined,
): RoundStatEntry[] {
  if (!stats) return [];
  const order = Object.keys(STAT_META);
  const out: RoundStatEntry[] = [];
  const seen = new Set<string>();
  for (const key of order) {
    const raw = stats[key];
    const value = typeof raw === "number" ? raw : Number(raw) || 0;
    if (value > 0) {
      const meta = STAT_META[key];
      out.push({ key, label: meta.label, value, format: meta.format, polarity: meta.polarity });
      seen.add(key);
    }
  }
  // Any extra unknown keys with value > 0 (future-proof)
  for (const [key, raw] of Object.entries(stats)) {
    if (seen.has(key)) continue;
    if (HIDDEN_KEYS.has(key)) continue;
    const value = typeof raw === "number" ? raw : Number(raw) || 0;
    if (value > 0) {
      out.push({
        key,
        label: key.replace(/_/g, " "),
        value,
        format: "int",
        polarity: "neutral",
      });
    }
  }
  return out;
}

export function resultLabel(result?: string | null): { label: string; kind: "win" | "loss" | "draw" | "unknown" } {
  if (!result) return { label: "—", kind: "unknown" };
  const v = result.toLowerCase();
  if (v === "win" || v.startsWith("v") || v.startsWith("w") || v.startsWith("ippon") || v.startsWith("wazari") || v.startsWith("yuko")) {
    return { label: "Victoire", kind: "win" };
  }
  if (v === "loss" || v.startsWith("d") || v.startsWith("l") || v.startsWith("perdu")) {
    return { label: "Défaite", kind: "loss" };
  }
  return { label: result, kind: "draw" };
}
