/**
 * Synchronisation PB / SB d'athlétisme à partir des données d'ENTRAÎNEMENT
 * (athletics_sprint_attempts + athletics_throwing_attempts).
 *
 * Politique d'amélioration identique à syncRecordsFromCompetition :
 *  - jamais de dégradation,
 *  - PB historique tout-saisons,
 *  - SB par saison (year),
 *  - lignes verrouillées intactes.
 *
 * Un athlète peut être aligné sur plusieurs disciplines (disciplines[]/specialties[]) ;
 * on ne met à jour que les couples qu'il pratique réellement.
 */
import { supabase } from "@/integrations/supabase/client";
import { getDefaultUnitForDiscipline } from "./recordsHelpers";

interface PlayerInfo {
  id: string;
  category_id: string;
  discipline: string | null;
  specialty: string | null;
  disciplines?: string[] | null;
  specialties?: string[] | null;
}

interface PerfCandidate {
  playerId: string;
  categoryId: string;
  discipline: string;
  specialty: string | null;
  value: number;
  perfDate: string;
  lowerIsBetter: boolean;
  unit: string;
}

/** Discipline / spécialité d'athlétisme déduite d'un essai sprint. */
function mapSprintToPair(distance_m: number, exercise_type: string | null): { discipline: string; specialty: string } | null {
  // Haies (toutes distances détectées par exercise_type)
  if (exercise_type === "haies") {
    if (distance_m === 60) return { discipline: "athletisme_haies", specialty: "60mH" };
    if (distance_m === 100) return { discipline: "athletisme_haies", specialty: "100mH" };
    if (distance_m === 110) return { discipline: "athletisme_haies", specialty: "110mH" };
    if (distance_m === 400) return { discipline: "athletisme_haies", specialty: "400mH" };
    return null;
  }
  // Sprints
  if ([60, 100, 200, 400].includes(distance_m)) {
    return { discipline: "athletisme_sprints", specialty: `${distance_m}m` };
  }
  // Demi-fond
  if (distance_m === 800) return { discipline: "athletisme_demi_fond", specialty: "800m" };
  if (distance_m === 1500) return { discipline: "athletisme_demi_fond", specialty: "1500m" };
  // Fond
  if (distance_m === 3000) return { discipline: "athletisme_fond", specialty: "3000m" };
  if (distance_m === 5000) return { discipline: "athletisme_fond", specialty: "5000m" };
  if (distance_m === 10000) return { discipline: "athletisme_fond", specialty: "10000m" };
  return null;
}

/** Vérifie qu'un athlète pratique bien (discipline, specialty). */
function athleteMatches(player: PlayerInfo, discipline: string, specialty: string | null): boolean {
  if (player.disciplines && player.disciplines.length > 0) {
    return player.disciplines.some((d, i) => {
      if (d !== discipline) return false;
      if (!specialty) return true;
      return (player.specialties?.[i] || "") === specialty;
    });
  }
  if (player.discipline !== discipline) return false;
  if (!specialty) return true;
  return player.specialty === specialty;
}

/** Applique les meilleures perfs sur athletics_records (idempotent). */
async function applyPerfsToRecords(perfs: PerfCandidate[]): Promise<{ updated: number }> {
  if (perfs.length === 0) return { updated: 0 };

  // Récupère tous les records existants pour les catégories concernées.
  const categoryIds = Array.from(new Set(perfs.map((p) => p.categoryId)));
  const { data: existingRecords, error: recErr } = await supabase
    .from("athletics_records" as any)
    .select(
      "id, player_id, category_id, discipline, specialty, personal_best, personal_best_date, season_best, season_year, lower_is_better, unit, is_locked",
    )
    .in("category_id", categoryIds);
  if (recErr) throw recErr;

  type ExistingRecord = {
    id: string;
    player_id: string;
    category_id: string;
    discipline: string;
    specialty: string | null;
    personal_best: number | null;
    personal_best_date: string | null;
    season_best: number | null;
    season_year: number;
    lower_is_better: boolean;
    unit: string;
    is_locked: boolean;
  };
  const records = (existingRecords || []) as unknown as ExistingRecord[];
  const seasonKey = (p: PerfCandidate) =>
    `${p.playerId}|${p.categoryId}|${p.discipline}|${p.specialty || ""}|${new Date(p.perfDate).getFullYear()}`;
  const histKey = (playerId: string, categoryId: string, discipline: string, specialty: string | null) =>
    `${playerId}|${categoryId}|${discipline}|${specialty || ""}`;

  const seasonMap = new Map<string, ExistingRecord>();
  const histPb = new Map<string, { value: number; lowerIsBetter: boolean }>();
  records.forEach((r) => {
    seasonMap.set(
      `${r.player_id}|${r.category_id}|${r.discipline}|${r.specialty || ""}|${r.season_year}`,
      r,
    );
    if (r.personal_best != null) {
      const k = histKey(r.player_id, r.category_id, r.discipline, r.specialty);
      const cur = histPb.get(k);
      if (
        !cur ||
        (r.lower_is_better ? r.personal_best < cur.value : r.personal_best > cur.value)
      ) {
        histPb.set(k, { value: r.personal_best, lowerIsBetter: r.lower_is_better });
      }
    }
  });

  let updated = 0;
  for (const perf of perfs) {
    const year = new Date(perf.perfDate).getFullYear();
    const sKey = seasonKey(perf);
    const seasonRec = seasonMap.get(sKey);
    if (seasonRec?.is_locked) continue;

    const hKey = histKey(perf.playerId, perf.categoryId, perf.discipline, perf.specialty);
    const histPbVal = histPb.get(hKey);

    const beatsHistPb =
      !histPbVal || (perf.lowerIsBetter ? perf.value < histPbVal.value : perf.value > histPbVal.value);
    const currentSb = seasonRec?.season_best ?? null;
    const beatsSb =
      currentSb == null || (perf.lowerIsBetter ? perf.value < currentSb : perf.value > currentSb);
    const seasonPb = seasonRec?.personal_best ?? null;
    const beatsSeasonPb =
      seasonPb == null || (perf.lowerIsBetter ? perf.value < seasonPb : perf.value > seasonPb);

    if (!beatsHistPb && !beatsSb && !beatsSeasonPb) continue;

    if (seasonRec) {
      const update: Record<string, any> = {};
      if (beatsSb) {
        update.season_best = perf.value;
        update.season_best_date = perf.perfDate;
        update.season_best_location = "Entraînement";
      }
      if (beatsHistPb || beatsSeasonPb) {
        update.personal_best = perf.value;
        update.personal_best_date = perf.perfDate;
        update.personal_best_location = "Entraînement";
      }
      if (Object.keys(update).length === 0) continue;
      const { error } = await supabase
        .from("athletics_records" as any)
        .update(update)
        .eq("id", seasonRec.id);
      if (error) throw error;
      updated++;
      // mettre à jour l'index local pour les perfs suivantes
      Object.assign(seasonRec, update);
      if (update.personal_best != null) {
        histPb.set(hKey, { value: update.personal_best, lowerIsBetter: perf.lowerIsBetter });
      }
    } else {
      const newPb = histPbVal
        ? perf.lowerIsBetter
          ? Math.min(histPbVal.value, perf.value)
          : Math.max(histPbVal.value, perf.value)
        : perf.value;
      const payload: Record<string, any> = {
        player_id: perf.playerId,
        category_id: perf.categoryId,
        discipline: perf.discipline,
        specialty: perf.specialty,
        season_year: year,
        unit: perf.unit,
        lower_is_better: perf.lowerIsBetter,
        season_best: perf.value,
        season_best_date: perf.perfDate,
        season_best_location: "Entraînement",
        personal_best: newPb,
        personal_best_date: perf.perfDate,
        personal_best_location: "Entraînement",
      };
      const { error } = await supabase
        .from("athletics_records" as any)
        .upsert(payload, { onConflict: "player_id,discipline,specialty,season_year" });
      if (error) throw error;
      updated++;
      histPb.set(hKey, { value: newPb, lowerIsBetter: perf.lowerIsBetter });
    }
  }

  return { updated };
}

/** Sync depuis une saisie sprint (un ou plusieurs essais d'un même athlète). */
export async function syncRecordsFromSprintAttempts(opts: {
  categoryId: string;
  playerId: string;
  sessionDate: string;
  attempts: { distance_m: number; time_seconds: number | null; exercise_type: string | null; is_valid: boolean }[];
}): Promise<{ updated: number }> {
  const { categoryId, playerId, sessionDate, attempts } = opts;

  // Charge l'athlète pour vérifier ses disciplines/spécialités
  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id, category_id, discipline, specialty, disciplines, specialties")
    .eq("id", playerId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!player) return { updated: 0 };

  // Meilleur temps (le plus bas) par couple (discipline, specialty)
  const bestByPair = new Map<string, number>();
  attempts.forEach((a) => {
    if (!a.is_valid || a.time_seconds == null || a.time_seconds <= 0) return;
    const pair = mapSprintToPair(a.distance_m, a.exercise_type);
    if (!pair) return;
    if (!athleteMatches(player as PlayerInfo, pair.discipline, pair.specialty)) return;
    const k = `${pair.discipline}|${pair.specialty}`;
    const cur = bestByPair.get(k);
    if (cur == null || a.time_seconds < cur) bestByPair.set(k, a.time_seconds);
  });

  const perfs: PerfCandidate[] = [];
  bestByPair.forEach((value, k) => {
    const [discipline, specialty] = k.split("|");
    const { unit, lowerIsBetter } = getDefaultUnitForDiscipline(discipline, specialty);
    perfs.push({
      playerId,
      categoryId,
      discipline,
      specialty,
      value,
      perfDate: sessionDate,
      lowerIsBetter,
      unit,
    });
  });

  return applyPerfsToRecords(perfs);
}

/** Sync depuis une saisie lancers (un ou plusieurs essais d'un même athlète). */
export async function syncRecordsFromThrowingAttempts(opts: {
  categoryId: string;
  playerId: string;
  sessionDate: string;
  attempts: { implement: string; distance_m: number | null; is_valid: boolean }[];
}): Promise<{ updated: number }> {
  const { categoryId, playerId, sessionDate, attempts } = opts;

  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id, category_id, discipline, specialty, disciplines, specialties")
    .eq("id", playerId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!player) return { updated: 0 };

  // Meilleure distance par engin (la specialty correspond au nom de l'engin)
  const bestByImplement = new Map<string, number>();
  attempts.forEach((a) => {
    if (!a.is_valid || a.distance_m == null || a.distance_m <= 0) return;
    if (!athleteMatches(player as PlayerInfo, "athletisme_lancers", a.implement)) return;
    const cur = bestByImplement.get(a.implement);
    if (cur == null || a.distance_m > cur) bestByImplement.set(a.implement, a.distance_m);
  });

  const perfs: PerfCandidate[] = [];
  bestByImplement.forEach((value, implement) => {
    perfs.push({
      playerId,
      categoryId,
      discipline: "athletisme_lancers",
      specialty: implement,
      value,
      perfDate: sessionDate,
      lowerIsBetter: false,
      unit: "m",
    });
  });

  return applyPerfsToRecords(perfs);
}
