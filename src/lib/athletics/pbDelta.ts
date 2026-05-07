/**
 * Helpers d'affichage du delta vs PB (record perso) pour l'athlétisme.
 * - Sprint/course : delta exprimé en m/s (vitesse). Mieux = négatif (plus rapide), pire = positif.
 * - Lancers / sauts : delta exprimé dans l'unité (m, pts). Mieux = positif, pire = négatif.
 *
 * Convention couleur : vert quand le record est battu, rouge quand la perf est inférieure au PB.
 */

export interface AthleticsRecordLite {
  player_id: string;
  discipline: string;
  specialty: string | null;
  personal_best: number | null;
  lower_is_better: boolean;
  unit: string;
}

/** Trouve le PB le plus pertinent pour un (athlète, discipline, spécialité). */
export function findPb(
  records: AthleticsRecordLite[],
  playerId: string,
  discipline: string,
  specialty: string | null,
): AthleticsRecordLite | null {
  // Match exact d'abord, sinon discipline seule
  let best: AthleticsRecordLite | null = null;
  for (const r of records) {
    if (r.player_id !== playerId) continue;
    if (r.discipline !== discipline) continue;
    if ((r.specialty || "") !== (specialty || "")) continue;
    if (r.personal_best == null) continue;
    if (
      !best ||
      best.personal_best == null ||
      (r.lower_is_better
        ? r.personal_best < best.personal_best
        : r.personal_best > best.personal_best)
    ) {
      best = r;
    }
  }
  return best;
}

/** Mapping distance + exercise_type → (discipline, specialty) athlétisme. */
export function mapSprintToPair(
  distance_m: number,
  exercise_type: string | null,
): { discipline: string; specialty: string } | null {
  if (exercise_type === "haies") {
    if (distance_m === 60) return { discipline: "athletisme_haies", specialty: "60mH" };
    if (distance_m === 100) return { discipline: "athletisme_haies", specialty: "100mH" };
    if (distance_m === 110) return { discipline: "athletisme_haies", specialty: "110mH" };
    if (distance_m === 400) return { discipline: "athletisme_haies", specialty: "400mH" };
    return null;
  }
  if ([60, 100, 200, 400].includes(distance_m)) {
    return { discipline: "athletisme_sprints", specialty: `${distance_m}m` };
  }
  if (distance_m === 800) return { discipline: "athletisme_demi_fond", specialty: "800m" };
  if (distance_m === 1500) return { discipline: "athletisme_demi_fond", specialty: "1500m" };
  if (distance_m === 3000) return { discipline: "athletisme_fond", specialty: "3000m" };
  if (distance_m === 5000) return { discipline: "athletisme_fond", specialty: "5000m" };
  if (distance_m === 10000) return { discipline: "athletisme_fond", specialty: "10000m" };
  return null;
}

export interface PbDeltaResult {
  /** Texte signé à afficher, ex. "-0.32 m/s" ou "+0.45 m". */
  display: string;
  /** true si meilleur que le PB → vert, false si moins bon → rouge, null si pas de PB. */
  isBetter: boolean | null;
  /** PB de référence (valeur brute). */
  pb: number | null;
}

/** Sprint/course : compare la vitesse moyenne (d/t) à la vitesse PB. */
export function computeSprintPbDelta(
  distance_m: number,
  time_seconds: number | null,
  pb: number | null,
): PbDeltaResult {
  if (time_seconds == null || time_seconds <= 0 || distance_m <= 0) {
    return { display: "—", isBetter: null, pb };
  }
  if (pb == null || pb <= 0) {
    return { display: "—", isBetter: null, pb };
  }
  const currentSpeed = distance_m / time_seconds;
  const pbSpeed = distance_m / pb;
  // Δ = pbSpeed - currentSpeed → si current plus rapide (current > pbSpeed) → Δ négatif → meilleur
  const delta = pbSpeed - currentSpeed;
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  const abs = Math.abs(delta).toFixed(2);
  const isBetter = delta < 0; // current plus rapide que PB
  return { display: `${sign}${abs} m/s`, isBetter, pb };
}

/** Lancers / sauts : compare la distance (m) au PB. */
export function computeFieldPbDelta(
  distance_m: number | null,
  pb: number | null,
): PbDeltaResult {
  if (distance_m == null || distance_m <= 0) {
    return { display: "—", isBetter: null, pb };
  }
  if (pb == null || pb <= 0) {
    return { display: "—", isBetter: null, pb };
  }
  const delta = distance_m - pb;
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  const abs = Math.abs(delta).toFixed(2);
  const isBetter = delta > 0;
  return { display: `${sign}${abs} m`, isBetter, pb };
}
