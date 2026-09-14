/**
 * Affichage des journées sans charge ("jours de repos").
 *
 * Une ligne de charge à RPE 0 / durée 0 n'est pas une note donnée par l'athlète :
 * c'est une journée sans séance, insérée automatiquement le soir pour que la
 * charge chronique reflète bien le repos. On l'affiche donc "Repos" et non "0/10".
 *
 * Générique : valable pour toutes les disciplines.
 */

export interface RestDayLike {
  rpe?: number | null;
  duration_minutes?: number | null;
  training_session_id?: string | null;
}

/** true si la ligne correspond à une journée de repos (aucune charge enregistrée). */
export function isRestDayEntry(entry: RestDayLike | null | undefined): boolean {
  if (!entry) return false;
  const rpe = Number(entry.rpe ?? 0);
  const duration = Number(entry.duration_minutes ?? 0);
  return rpe === 0 && duration === 0;
}

/** Libellé RPE : "Repos" pour une journée sans charge, sinon "6/10". */
export function formatRpeDisplay(
  entry: RestDayLike | null | undefined,
  restLabel = "Repos",
): string {
  if (!entry || entry.rpe == null) return "—";
  if (isRestDayEntry(entry)) return restLabel;
  return `${entry.rpe}/10`;
}

/** Libellé durée : "—" pour une journée de repos. */
export function formatRestAwareDuration(entry: RestDayLike | null | undefined): string {
  if (!entry) return "—";
  if (isRestDayEntry(entry)) return "—";
  return String(entry.duration_minutes ?? "—");
}
