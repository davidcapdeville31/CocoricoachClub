/**
 * ============================================================================
 * AthleteNoteGenerator - Moteur central de génération de notes
 * ============================================================================
 *
 * FORMAT STANDARD (toutes méthodes) :
 * Ligne 1 : Nom de la méthode
 * Ligne 2 : Explication courte du fonctionnement
 * Ligne 3 : Nombre de séries / structure globale
 * Ligne 4 : Temps de récupération
 *
 * RÈGLES :
 * - Ne JAMAIS répéter : reps, charge, tempo, RPE, variables d'exercice
 * - Maximum 3-4 lignes
 * - Phrases courtes, lisibles sur mobile
 * - Expliquer la logique d'enchaînement, pas les détails techniques
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (s: number): string => {
  if (!s || s <= 0) return "0 seconde";
  const min = Math.floor(s / 60);
  const sec = s % 60;
  if (min === 0) return `${sec} seconde${sec > 1 ? "s" : ""}`;
  if (sec === 0) return `${min} minute${min > 1 ? "s" : ""}`;
  return `${min}min${sec > 0 ? `${sec}s` : ""}`;
};

const pl = (n: number, word: string): string => `${n} ${word}${n > 1 ? "s" : ""}`;

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface SeriesData {
  reps?: string | number; percentage?: number; load?: number; tempo?: string;
  rpe?: number; angle?: number; timeUnderTension?: number; contractionType?: string;
  reductionType?: string; reductionValue?: number; pauseSeconds?: number;
  isActive?: boolean; phaseExerciseId?: string; phaseExerciseName?: string;
  exerciseId?: string; exerciseName?: string;
}

interface CrossFitExercise {
  exerciseName: string; reps?: string | number; percentage?: number;
  load?: number; tempo?: string; rpe?: number; rir?: number;
  angle?: number; timeUnderTension?: number;
}

interface LinkedExerciseData {
  exerciseName: string;
  params: { sets?: number; reps?: string; load?: number; percentage?: number;
    tempo?: string; rpe?: number; rest?: number; visibleParams?: string[]; };
}

interface CircuitRecovery {
  strategy: string; globalRestSeconds?: number;
  perExerciseRestSeconds?: Record<number, number>;
}

// ─── LINKED (Superset, Biset, Triset, Giant Set, Combiné Haltéro) ───────────

function genLinked(methodType: string, exercises: LinkedExerciseData[], restSeconds?: number): string {
  if (exercises.length === 0) return "";
  const sets = exercises[0]?.params?.sets;
  const lines: string[] = [];

  const labels: Record<string, string> = {
    superset: "Superset",
    biset: "Biset",
    triset: "Triset",
    giant_set: "Giant Set",
    combine_haltero: "Combiné Haltéro",
    bulgarian: "Méthode Bulgare",
  };

  const name = labels[methodType] || "Méthode combinée";
  lines.push(name);
  lines.push(`Enchaîne les ${exercises.length} exercices sans repos entre eux.`);

  if (sets) {
    lines.push(`Réalise ${pl(sets, "série")} de cet enchaînement.`);
  }

  if (restSeconds) {
    lines.push(`Repos : ${fmt(restSeconds)} entre chaque tour.`);
  }

  return lines.join("\n");
}

// ─── REST-PAUSE ─────────────────────────────────────────────────────────────

function genRestPause(_exerciseName: string | undefined, config: {
  series: Array<{ miniSets: Array<{ reps: string | number; pauseSeconds: number }>;
    recoverySeconds?: number; percentage?: number; load?: number; tempo?: string; rpe?: number; }>;
  visibleVariables?: string[];
}): string {
  const { series } = config;
  if (series.length === 0) return "";
  const lines: string[] = [];

  lines.push("Rest-Pause");
  lines.push("Réalise les répétitions prévues puis prends une courte pause avant de reprendre.");

  const miniCount = series[0]?.miniSets?.length || 0;
  if (miniCount > 0) {
    lines.push(`${pl(series.length, "série")} de ${pl(miniCount, "mini-série")} à réaliser.`);
  } else {
    lines.push(`${pl(series.length, "série")} à réaliser.`);
  }

  const rec = series[0]?.recoverySeconds;
  if (rec) {
    lines.push(`Repos : ${fmt(rec)} entre chaque série.`);
  }

  return lines.join("\n");
}

// ─── DROP SET ───────────────────────────────────────────────────────────────

function genDropSet(series: SeriesData[], _vis: string[], _exerciseName?: string): string {
  if (series.length === 0) return "";
  const dropCount = series.length - 1;
  const lines: string[] = [];

  lines.push("Drop Set");
  lines.push("Réalise l'exercice en diminuant la charge sans repos entre les phases.");
  lines.push(`1 départ + ${pl(dropCount, "drop")} à enchaîner pour compléter une série.`);

  return lines.join("\n");
}

// ─── SERIES GENERIQUES (Pyramid, 5x5, etc.) ────────────────────────────────

function genSeries(series: SeriesData[], _vis: string[], _exerciseName?: string, methodType?: string, restSeconds?: number): string {
  if (series.length === 0) return "";
  const lines: string[] = [];

  const labels: Record<string, { name: string; desc: string }> = {
    pyramid_up: { name: "Pyramide montante", desc: "Augmente la charge à chaque série en diminuant les répétitions." },
    pyramid_down: { name: "Pyramide descendante", desc: "Diminue la charge à chaque série en augmentant les répétitions." },
    pyramid_full: { name: "Pyramide complète", desc: "Monte en charge puis redescend au fil des séries." },
    five_by_five: { name: "5×5", desc: "5 séries de 5 répétitions avec charge lourde." },
  };

  const info = methodType ? labels[methodType] : null;
  if (info) {
    lines.push(info.name);
    lines.push(info.desc);
  }

  lines.push(`${pl(series.length, "série")} à réaliser selon les variables prescrites.`);
  if (restSeconds && restSeconds > 0) {
    lines.push(`Repos : ${fmt(restSeconds)} entre chaque série.`);
  }

  return lines.join("\n");
}

// ─── ISOMETRIC ──────────────────────────────────────────────────────────────

function genIsometric(series: SeriesData[], _vis: string[], _exerciseName?: string, type = "Overcoming", restSeconds?: number): string {
  if (series.length === 0) return "";
  const lines: string[] = [];

  const name = type === "Overcoming" ? "Iso. Overcoming" : "Iso. Yielding";
  const desc = type === "Overcoming"
    ? "Pousse avec une force maximale contre une résistance immobile."
    : "Maintiens la position le plus longtemps possible.";

  lines.push(name);
  lines.push(desc);
  lines.push(`${pl(series.length, "série")} à réaliser selon les variables prescrites.`);
  if (restSeconds && restSeconds > 0) {
    lines.push(`Repos : ${fmt(restSeconds)} entre chaque série.`);
  }

  return lines.join("\n");
}

// ─── AMRAP ──────────────────────────────────────────────────────────────────

function genAmrap(ex: CrossFitExercise[], timeCap?: number, _vis?: string[]): string {
  if (ex.length === 0) return "";
  const lines: string[] = [];

  lines.push("AMRAP");
  lines.push("Réalise un maximum de tours du circuit dans le temps imparti.");

  if (timeCap) {
    lines.push(`Durée : ${pl(timeCap, "minute")}.`);
  }

  lines.push(`${pl(ex.length, "exercice")} à enchaîner par tour.`);

  return lines.join("\n");
}

// ─── FOR TIME ───────────────────────────────────────────────────────────────

function genForTime(ex: CrossFitExercise[], timeCap?: number, rounds?: number, _vis?: string[]): string {
  if (ex.length === 0) return "";
  const lines: string[] = [];

  lines.push("For Time");
  lines.push("Complète le circuit le plus rapidement possible.");

  if (rounds && rounds > 1) {
    lines.push(`${pl(rounds, "tour")} à réaliser.`);
  }

  if (timeCap) {
    lines.push(`Time cap : ${pl(timeCap, "minute")}.`);
  }

  return lines.join("\n");
}

// ─── EMOM ───────────────────────────────────────────────────────────────────

function genEmom(ex: CrossFitExercise[], cfg?: { intervalMinutes: number; totalMinutes: number }, _vis?: string[]): string {
  if (ex.length === 0) return "";
  const lines: string[] = [];
  const interval = cfg?.intervalMinutes || 1;

  lines.push(interval === 1 ? "EMOM" : `E${interval}MOM`);
  lines.push(`Réalise les exercices au début de chaque intervalle de ${pl(interval, "minute")}.`);

  if (cfg?.totalMinutes) {
    lines.push(`Durée totale : ${pl(cfg.totalMinutes, "minute")}.`);
  }

  lines.push(`${pl(ex.length, "exercice")} par intervalle.`);

  return lines.join("\n");
}

// ─── TABATA ─────────────────────────────────────────────────────────────────

function genTabata(ex: CrossFitExercise[], cfg?: { workSeconds: number; restSeconds: number; rounds: number }): string {
  if (ex.length === 0) return "";
  const lines: string[] = [];

  lines.push("Tabata");

  if (cfg) {
    lines.push(`${fmt(cfg.workSeconds)} d'effort, ${fmt(cfg.restSeconds)} de repos.`);
    lines.push(`${pl(cfg.rounds, "round")} à réaliser.`);
  } else {
    lines.push("Alterne effort et repos selon le protocole prescrit.");
  }

  return lines.join("\n");
}

// ─── CIRCUIT ────────────────────────────────────────────────────────────────

function genCircuit(ex: CrossFitExercise[], rounds?: number, rec?: CircuitRecovery, _vis?: string[]): string {
  if (ex.length === 0) return "";
  const lines: string[] = [];

  lines.push("Circuit");
  lines.push(`Enchaîne les ${pl(ex.length, "exercice")} du circuit.`);

  if (rounds) {
    lines.push(`${pl(rounds, "tour")} à réaliser.`);
  }

  if (rec?.strategy === "after_circuit" && rec.globalRestSeconds) {
    lines.push(`Repos : ${fmt(rec.globalRestSeconds)} après chaque tour.`);
  } else if (rec?.strategy === "between_exercises") {
    lines.push("Repos entre chaque exercice selon le temps prescrit.");
  }

  return lines.join("\n");
}

// ─── DEATH BY ───────────────────────────────────────────────────────────────

function genDeathBy(ex: CrossFitExercise[], cfg?: { startReps: number; incrementReps: number }, _vis?: string[]): string {
  if (ex.length === 0) return "";
  const lines: string[] = [];

  lines.push("Death By");

  if (cfg) {
    lines.push(`Démarre avec ${pl(cfg.startReps, "répétition")} et ajoute ${pl(cfg.incrementReps, "répétition")} chaque minute.`);
  } else {
    lines.push("Ajoute des répétitions chaque minute jusqu'à l'échec.");
  }

  lines.push("Le workout se termine quand tu ne peux plus finir dans la minute.");

  return lines.join("\n");
}

// ─── CLUSTER ────────────────────────────────────────────────────────────────

function genCluster(_exerciseName: string | undefined, config: {
  clusterSteps: Array<{ reps: number | "max"; restAfterSeconds?: number }>;
  sets: number; interSetRestSeconds: number; loadType: string;
  loadValue?: number; targetRpe?: number;
}): string {
  const c = config;
  const lines: string[] = [];

  lines.push("Cluster Set");
  lines.push(`Divise chaque série en ${pl(c.clusterSteps.length, "mini-série")} avec de courts repos entre elles.`);
  lines.push(`${pl(c.sets, "série")} à réaliser.`);
  lines.push(`Repos : ${fmt(c.interSetRestSeconds)} entre chaque série.`);

  return lines.join("\n");
}

// ─── FARTLEK ────────────────────────────────────────────────────────────────

const TERRAIN: Record<string, string> = {
  flat: "plat", hills: "vallonné", trail: "trail", track: "piste", mixed: "mixte",
};

function genFartlek(config: {
  totalDurationMinutes: number; structureType: string; terrain: string;
  cycles?: number;
  effortPhases: Array<{ durationSeconds: number; intensityType: string; intensityValue?: number; intensityLabel?: string; targetSpeed?: number; targetHeartRate?: number }>;
  recoveryPhases: Array<{ durationSeconds: number; targetSpeed?: number; targetHeartRate?: number }>;
  recoveryType: string;
}): string {
  const c = config;
  const lines: string[] = [];

  lines.push("Fartlek");

  if (c.structureType === "structure") {
    lines.push("Alterne phases d'effort et de récupération selon le protocole prescrit.");
  } else {
    lines.push("Varie l'intensité librement selon tes sensations.");
  }

  lines.push(`Durée totale : ${pl(c.totalDurationMinutes, "minute")} sur terrain ${TERRAIN[c.terrain] || c.terrain}.`);

  if (c.cycles) {
    lines.push(`${pl(c.cycles, "cycle")} à réaliser.`);
  }

  return lines.join("\n");
}

// ─── STATO-DYNAMIQUE ────────────────────────────────────────────────────────

function genStatoDyn(_exerciseName: string | undefined, config: {
  sequence: string; sets: number; dynamicReps: number; dynamicAmplitude: string;
  dynamicTempo?: string;
  loadType: string; loadValue?: number; interSetRestSeconds?: number; restSeconds?: number;
  staticPhases: Array<{ angle: string; holdSeconds?: number; durationSeconds?: number; timing: string }>;
  targetRpe?: number;
  athleteLevel?: string;
  coachNotes?: string;
}): string {
  const c = config;
  const lines: string[] = [];

  lines.push("Stato-Dynamique");
  lines.push("Combine une phase de maintien isométrique et des répétitions dynamiques.");
  lines.push(`${pl(c.sets, "série")} à réaliser.`);

  const restSec = c.interSetRestSeconds ?? c.restSeconds ?? 0;
  if (restSec > 0) {
    lines.push(`Repos : ${fmt(restSec)} entre chaque série.`);
  }

  return lines.join("\n");
}

// ─── INTERMITTENT CARDIO ────────────────────────────────────────────────────

const SUPPORT: Record<string, string> = {
  velo: "vélo", rameur: "rameur", ski_erg: "Ski Erg", assault_bike: "Assault Bike",
  elliptique: "elliptique", tapis: "tapis", natation: "natation", course: "course",
};

function genIntermittent(config: {
  support: string; totalSets: number; effortDurationSeconds: number;
  recoveryDurationSeconds: number; effortMode: string; effortValue?: number;
  recoveryMode?: string; recoveryValue?: number; targetHeartRate?: number;
  warmupMinutes?: number; cooldownMinutes?: number;
}): string {
  const c = config;
  const lines: string[] = [];
  const supportName = SUPPORT[c.support] || c.support;

  lines.push("Intermittent Cardio");
  lines.push(`Alterne ${fmt(c.effortDurationSeconds)} d'effort et ${fmt(c.recoveryDurationSeconds)} de récupération sur ${supportName}.`);
  lines.push(`${pl(c.totalSets, "série")} à réaliser.`);

  const extras: string[] = [];
  if (c.warmupMinutes) extras.push(`${pl(c.warmupMinutes, "min")} d'échauffement`);
  if (c.cooldownMinutes) extras.push(`${pl(c.cooldownMinutes, "min")} de retour au calme`);
  if (extras.length > 0) {
    lines.push(extras.join(" + ") + ".");
  }

  return lines.join("\n");
}

// ─── DISPATCHER ─────────────────────────────────────────────────────────────

export interface MethodNoteInput {
  methodType: string;
  exerciseName?: string;
  series?: SeriesData[];
  visibleVariables?: string[];
  setsCount?: number;
  timeCap?: number;
  totalMinutes?: number;
  repsPerRound?: number;
  tabataConfig?: { workSeconds: number; restSeconds: number; rounds: number };
  emomConfig?: { intervalMinutes: number; totalMinutes: number };
  deathByConfig?: { startReps: number; incrementReps: number };
  circuitRecovery?: CircuitRecovery;
  methodExercises?: CrossFitExercise[];
  restPauseConfig?: { series: Array<{ miniSets: Array<{ reps: string | number; pauseSeconds: number; percentage?: number; load?: number; tempo?: string; rpe?: number; rir?: number; }>; recoverySeconds?: number; percentage?: number; load?: number; tempo?: string; rpe?: number; rir?: number; reps?: number; }>; visibleVariables?: string[]; visibleMiniSetVariables?: string[]; };
  linkedExercises?: LinkedExerciseData[];
  methodRestSeconds?: number;
  clusterConfig?: { clusterSteps: Array<{ reps: number | "max"; restAfterSeconds?: number }>; sets: number; interSetRestSeconds: number; loadType: string; loadValue?: number; targetRpe?: number; };
  fartlekConfig?: any;
  statoDynamiqueConfig?: any;
  intermittentCardioConfig?: any;
}

function buildExList(input: MethodNoteInput): CrossFitExercise[] {
  if (input.methodExercises?.length) return input.methodExercises;
  const { series, exerciseName } = input;
  if (!series) return exerciseName ? [{ exerciseName }] : [];
  const from = series.filter(s => s.phaseExerciseName || s.exerciseName)
    .map(s => ({ exerciseName: s.phaseExerciseName || s.exerciseName || exerciseName || "",
      reps: s.reps, percentage: s.percentage, load: s.load, tempo: s.tempo, rpe: s.rpe,
      rir: s.rir, angle: s.angle, timeUnderTension: s.timeUnderTension }));
  if (from.length > 0) return from;
  if (exerciseName) return [{ exerciseName, reps: series[0]?.reps }];
  return [];
}

export function generateMethodNote(input: MethodNoteInput): string {
  const { methodType, series, visibleVariables = [], exerciseName } = input;

  if (input.linkedExercises?.length) return genLinked(methodType, input.linkedExercises, input.methodRestSeconds);
  if (input.clusterConfig) return genCluster(exerciseName, input.clusterConfig);
  if (input.fartlekConfig) return genFartlek(input.fartlekConfig);
  if (input.statoDynamiqueConfig) return genStatoDyn(exerciseName, input.statoDynamiqueConfig);
  if (input.intermittentCardioConfig) return genIntermittent(input.intermittentCardioConfig);
  if (methodType === "rest_pause" && input.restPauseConfig) return genRestPause(exerciseName, input.restPauseConfig);

  const ex = buildExList(input);
  switch (methodType) {
    case "amrap": return genAmrap(ex, input.timeCap, visibleVariables);
    case "for_time": return genForTime(ex, input.timeCap, input.repsPerRound, visibleVariables);
    case "emom": return genEmom(ex, input.emomConfig, visibleVariables);
    case "tabata": return genTabata(ex, input.tabataConfig);
    case "circuit": return genCircuit(ex, input.repsPerRound, input.circuitRecovery, visibleVariables);
    case "death_by": return genDeathBy(ex, input.deathByConfig, visibleVariables);
  }

  if (!series?.length) return "";
  switch (methodType) {
    case "drop_set": return genDropSet(series, visibleVariables, exerciseName);
    case "isometric_overcoming": return genIsometric(series, visibleVariables, exerciseName, "Overcoming", input.methodRestSeconds);
    case "isometric_yielding": return genIsometric(series, visibleVariables, exerciseName, "Yielding", input.methodRestSeconds);
    default: return genSeries(series, visibleVariables, exerciseName, methodType, input.methodRestSeconds);
  }
}
