// Judo final ranking: a property of the athlete's participation in a
// competition (public.competition_results), never derived from combats.
export type FinalRanking = "1" | "2" | "3" | "5" | "7" | "NC";

export const FINAL_RANKING_OPTIONS: { value: FinalRanking; label: string }[] = [
  { value: "NC", label: "NC" },
  { value: "7", label: "7e" },
  { value: "5", label: "5e" },
  { value: "3", label: "🥉 3e" },
  { value: "2", label: "🥈 2e" },
  { value: "1", label: "🥇 1er" },
];

export const NOT_SET_LABEL = "Classement non renseigné";

export function isFinalRanking(v: unknown): v is FinalRanking {
  return v === "1" || v === "2" || v === "3" || v === "5" || v === "7" || v === "NC";
}

/** null/undefined = non renseigné (never "NC"). */
export function finalRankingLabel(v: string | null | undefined): string | null {
  if (!isFinalRanking(v)) return null;
  return FINAL_RANKING_OPTIONS.find((o) => o.value === v)!.label;
}

/** Numeric rank for analytics; NC and null return null. */
export function finalRankingNumber(v: string | null | undefined): number | null {
  if (!isFinalRanking(v) || v === "NC") return null;
  return Number(v);
}

export function isPodium(v: string | null | undefined): boolean {
  const n = finalRankingNumber(v);
  return n !== null && n <= 3;
}
