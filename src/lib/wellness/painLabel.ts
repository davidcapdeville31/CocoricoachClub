/** Libellé complet des douleurs d'un wellness : toutes les zones saisies, pas seulement la première. */
export function painLabel(entry: { pain_entries?: unknown; pain_location?: string | null } | null | undefined): string | null {
  if (!entry) return null;
  const list = Array.isArray(entry.pain_entries) ? (entry.pain_entries as Array<{ region?: string }>) : [];
  const regions = list.map((e) => e?.region).filter((r): r is string => !!r && r.trim().length > 0);
  if (regions.length > 0) return Array.from(new Set(regions)).join(", ");
  return entry.pain_location || null;
}
