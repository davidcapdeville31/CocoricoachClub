// Calcul d'affichage des décalages "+2 au pied", "-1 au point de sortie".
export function formatDelta(delta: number | null | undefined, label: string): string | null {
  if (delta == null || Number.isNaN(delta) || delta === 0) return null;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} ${label}`;
}

export function summariseDeltas(
  foot_delta: number | null | undefined,
  breakpoint_delta: number | null | undefined,
): string {
  return [formatDelta(foot_delta, "au pied"), formatDelta(breakpoint_delta, "au point de sortie")]
    .filter(Boolean)
    .join(" · ");
}
