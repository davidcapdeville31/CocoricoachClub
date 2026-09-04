/**
 * Formatage générique des variables cardio / course (rameur, skierg, assault
 * bike, vélo, run, natation...) pour l'affichage en badges dans les méthodes
 * (AMRAP, For Time, EMOM, Tabata, Circuit, Death By...).
 * Générique : valable pour toutes les disciplines.
 */

const formatDuration = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export interface CardioBadge {
  key: string;
  label: string;
}

/** Retourne la liste des badges cardio à afficher pour une série / un exercice. */
export const getCardioBadges = (source: Record<string, any> | null | undefined): CardioBadge[] => {
  if (!source) return [];
  const badges: CardioBadge[] = [];
  const push = (key: string, label: string) => badges.push({ key, label });

  const duration = num(source.durationSeconds);
  if (duration) push("durationSeconds", `Durée ${formatDuration(duration)}`);

  const distance = num(source.distanceMeters);
  if (distance) push("distanceMeters", `${distance} m`);

  const calories = num(source.calories);
  if (calories) push("calories", `${calories} cal`);

  const watts = num(source.watts);
  if (watts) push("watts", `${watts} W`);

  const cadence = num(source.cadence);
  if (cadence) push("cadence", `${cadence} rpm`);

  const runDistance = num(source.runDistanceMeters);
  if (runDistance) push("runDistanceMeters", `${runDistance} m`);

  const runDuration = num(source.runDurationSeconds);
  if (runDuration) push("runDurationSeconds", `Durée ${formatDuration(runDuration)}`);

  const pace = num(source.paceSecondsPerKm);
  if (pace) push("paceSecondsPerKm", `Allure ${formatDuration(pace)}/km`);

  const elevation = num(source.elevationMeters);
  if (elevation) push("elevationMeters", `D+ ${elevation} m`);

  return badges;
};
