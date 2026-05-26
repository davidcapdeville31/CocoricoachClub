/**
 * Catalogue des 9 exercices DTN FFBSQ pour la programmation bowling.
 *
 * Chaque exercice appartient à l'une des 3 grandes catégories bowling :
 * - bowling_technique : gestes / fondamentaux (approche, lâcher, spares, paramètres perf)
 * - bowling_tactique  : utilisation de la piste, lignes de jeu, zones, placements
 * - bowling_parties   : situations de jeu / parties complètes
 *
 * Les variables ("fields") sont rendues dynamiquement par <BowlingExerciseVariables />.
 */

export type BowlingParent = "bowling_technique" | "bowling_tactique" | "bowling_parties";

export type BowlingFieldType = "number" | "select" | "multiselect" | "text" | "oil";

export interface BowlingExerciseField {
  key: string;
  label: string;
  type: BowlingFieldType;
  /** For select / multiselect. */
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  /** When true, the field is hidden / disabled for this exercise. */
  hidden?: boolean;
  help?: string;
}

export interface BowlingExercise {
  id: string; // dtn_ex1 ... dtn_ex9
  parent: BowlingParent;
  label: string;
  objective: string;
  successCriterion: string;
  fields: BowlingExerciseField[];
}

// ─── Champs communs réutilisables ─────────────────────────────────────────────
const ballField: BowlingExerciseField = {
  key: "ball_count",
  label: "Choix du matériel (boules)",
  type: "select",
  options: [
    { value: "1", label: "1 boule" },
    { value: "2", label: "2 boules" },
    { value: "3+", label: "3 boules ou +" },
    { value: "arsenal", label: "Tout l'arsenal" },
  ],
  help: "L'athlète choisira la(les) boule(s) précise(s) depuis son arsenal au moment de la séance",
};

// ─── Champs communs réutilisables ─────────────────────────────────────────────
const ballField: BowlingExerciseField = {
  key: "ball_choice",
  label: "Choix de la boule",
  type: "ball",
  help: "Sélectionne 1, 2 ou + boules depuis l'arsenal de l'athlète",
};

const oilField: BowlingExerciseField = {
  key: "oil_pattern_id",
  label: "Huilage",
  type: "oil",
  help: "À plat de préférence — laisser vide si non applicable",
};

const perfParamsField: BowlingExerciseField = {
  key: "perf_params",
  label: "Paramètres de la performance",
  type: "multiselect",
  options: [
    { value: "vitesse_normal", label: "Vitesse normale" },
    { value: "vitesse_moins", label: "Vitesse —" },
    { value: "vitesse_plus", label: "Vitesse +" },
    { value: "axe_naturel", label: "Axe naturel" },
    { value: "axe_0", label: "Axe 0°" },
    { value: "axe_0_30", label: "Axe 0° à 30°" },
    { value: "axe_30_60", label: "Axe 30° à 60°" },
    { value: "rotation_normale", label: "Rotation normale" },
    { value: "rotation_moins", label: "Rotation —" },
    { value: "rotation_plus", label: "Rotation +" },
    { value: "profondeur_normale", label: "Profondeur pose normale" },
    { value: "profondeur_moins", label: "Profondeur pose —" },
    { value: "profondeur_plus", label: "Profondeur pose +" },
  ],
  help: "1 paramètre seul (normal/moins/plus) ou 2 combinés",
};

// ─── Les 9 exercices ──────────────────────────────────────────────────────────
export const BOWLING_DTN_EXERCISES: BowlingExercise[] = [
  // 1
  {
    id: "dtn_ex1",
    parent: "bowling_tactique",
    label: "Poches & Strikes",
    objective:
      "Réaliser le maximum de poches et de strikes en utilisant toute la largeur de la piste.",
    successCriterion:
      "Fixer un % de poche et de strike proche de celui réalisé en compétition.",
    fields: [
      { key: "throws", label: "Nombre de lancers", type: "number", min: 30, max: 200, step: 1, placeholder: "30 à …" },
      ballField,
      oilField,
      perfParamsField,
    ],
  },
  // 2
  {
    id: "dtn_ex2",
    parent: "bowling_tactique",
    label: "Poches & Strikes entre les flèches",
    objective:
      "Maximum de poches et strikes en jouant entre les flèches (bord de rigole F1 jusqu'à F4/F5 voire au-delà).",
    successCriterion: "% de poche et de strike proche de celui réalisé en compétition.",
    fields: [
      {
        key: "throws_per_zone",
        label: "Nombre de lancers par zone",
        type: "select",
        options: [
          { value: "10", label: "10" },
          { value: "15", label: "15" },
          { value: "20", label: "20" },
        ],
      },
      ballField,
      oilField,
      perfParamsField,
    ],
  },
  // 3
  {
    id: "dtn_ex3",
    parent: "bowling_tactique",
    label: "Poches & Strikes — Zone flèche",
    objective:
      "Maximum de poches et strikes en jouant « zone flèche » (la flèche + 1 latte à droite ou à gauche) de F1 à F6.",
    successCriterion: "% de poche et de strike proche de celui réalisé en compétition.",
    fields: [
      {
        key: "throws_per_arrow",
        label: "Nombre de lancers par flèche",
        type: "select",
        options: [
          { value: "10", label: "10" },
          { value: "15", label: "15" },
          { value: "20", label: "20" },
        ],
      },
      {
        key: "arrows",
        label: "Flèches travaillées",
        type: "multiselect",
        options: ["F1", "F2", "F3", "F4", "F5", "F6"].map((f) => ({ value: f, label: f })),
      },
      ballField,
      oilField,
      perfParamsField,
    ],
  },
  // 4
  {
    id: "dtn_ex4",
    parent: "bowling_tactique",
    label: "Poches & Strikes — Placement déterminé",
    objective:
      "Maximum de poches et strikes en partant 5e, 15e, 25e, 35e latte au pied.",
    successCriterion: "% de poche et de strike proche de celui réalisé en compétition.",
    fields: [
      {
        key: "throws_per_placement",
        label: "Nombre de lancers par placement",
        type: "select",
        options: [
          { value: "10", label: "10" },
          { value: "15", label: "15" },
          { value: "20", label: "20" },
        ],
      },
      {
        key: "placements",
        label: "Placements (latte au pied)",
        type: "multiselect",
        options: [
          { value: "5", label: "5e latte" },
          { value: "15", label: "15e latte" },
          { value: "25", label: "25e latte" },
          { value: "35", label: "35e latte" },
        ],
      },
      ballField,
      oilField,
      perfParamsField,
    ],
  },
  // 5
  {
    id: "dtn_ex5",
    parent: "bowling_parties",
    label: "Doublés / Triplés",
    objective: "Réaliser le maximum de doublés ou triplés — noter les poches et les strikes.",
    successCriterion: "Fixer un nombre de doublés ou triplés en fonction du nombre de lancers.",
    fields: [
      {
        key: "throws",
        label: "Nombre de lancers",
        type: "select",
        options: [
          { value: "10", label: "10" },
          { value: "15", label: "15" },
          { value: "20", label: "20" },
        ],
      },
      {
        key: "target_kind",
        label: "Objectif",
        type: "select",
        options: [
          { value: "doubles", label: "Doublés" },
          { value: "triples", label: "Triplés" },
        ],
      },
      ballField,
      // Huilage désactivé pour les parties (comme demandé) — laissé optionnel
      { ...oilField, hidden: true },
      perfParamsField,
    ],
  },
  // 6
  {
    id: "dtn_ex6",
    parent: "bowling_tactique",
    label: "Points à réaliser",
    objective:
      "5 pts pour point de sortie / poche / strike — 3 pts pour point de sortie / poche — 1 pt pour point de sortie ou poche.",
    successCriterion: "Moyenne des points / lancers > 3.",
    fields: [
      { key: "points_target", label: "Nombre de points à réaliser", type: "number", min: 80, max: 500, step: 5, placeholder: "80 minimum" },
      ballField,
      oilField,
      {
        key: "use_zones",
        label: "Utilisation de la piste",
        type: "select",
        options: [
          { value: "full", label: "Toute la piste" },
          { value: "zones", label: "Par zones" },
        ],
      },
      perfParamsField,
    ],
  },
  // 7
  {
    id: "dtn_ex7",
    parent: "bowling_technique",
    label: "Vitesse / Axes / Rotations / Profondeur",
    objective:
      "Lancers consécutifs sur paramètres de la performance — niveau 1 (sans objectif résultat) ou niveau 2 (avec objectif résultat).",
    successCriterion: "60 à 70% de résultats positifs (à définir suivant la période).",
    fields: [
      {
        key: "throws_per_series",
        label: "Lancers par série",
        type: "select",
        options: [
          { value: "10", label: "10" },
          { value: "15", label: "15" },
          { value: "20", label: "20" },
        ],
      },
      {
        key: "sequence",
        label: "Enchaînement",
        type: "select",
        options: [
          { value: "consecutive", label: "Consécutifs" },
          { value: "alternate", label: "Alterner les paramètres" },
        ],
      },
      ballField,
      perfParamsField,
    ],
  },
  // 8
  {
    id: "dtn_ex8",
    parent: "bowling_tactique",
    label: "Lignes de jeu",
    objective:
      "Jouer des lignes de jeu définies (point de sortie marqué avec 2 scotchs, 2-3 lattes d'écart). Vérifier la position du pied à la ligne de faute, connaître ses numéros personnels.",
    successCriterion:
      "Position du pied correcte ET boule entre les scotchs — 60 à 70% de résultats positifs.",
    fields: [
      {
        key: "lines",
        label: "Type de lignes de jeu",
        type: "multiselect",
        options: [
          { value: "parallel", label: "Parallèles" },
          { value: "angular", label: "Angulaires" },
        ],
      },
      { key: "throws_per_line", label: "Nombre de lancers par ligne", type: "number", min: 5, max: 50, step: 1 },
      ballField,
      oilField,
    ],
  },
  // 9
  {
    id: "dtn_ex9",
    parent: "bowling_technique",
    label: "Les Spares",
    objective:
      "Objectif 1 : réussir 20 fois une quille seule ou un spare composé. Objectif 2 : fixer un nombre important de répétitions (min. 30 à …).",
    successCriterion: "À fixer en fonction des % personnels.",
    fields: [
      {
        key: "spare_target",
        label: "Cible",
        type: "select",
        options: [
          { value: "Q1", label: "Q1" },
          { value: "Q7", label: "Q7" },
          { value: "Q10", label: "Q10" },
          { value: "S1_2", label: "S1/2" },
          { value: "S1_3", label: "S1/3" },
          { value: "S2_4", label: "S2/4" },
          { value: "S3_6", label: "S3/6" },
          { value: "custom", label: "Autre (cf. notes)" },
        ],
      },
      { key: "reps", label: "Nombre de répétitions", type: "number", min: 10, max: 200, step: 5, placeholder: "20 à 30+" },
      ballField,
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const BOWLING_PARENT_LABELS: Record<BowlingParent, string> = {
  bowling_technique: "Travail Technique",
  bowling_tactique: "Travail Tactique",
  bowling_parties: "Parties d'Entraînement",
};

export const BOWLING_PARENT_VALUES: BowlingParent[] = [
  "bowling_technique",
  "bowling_tactique",
  "bowling_parties",
];

export function getBowlingExercisesByParent(parent: BowlingParent): BowlingExercise[] {
  return BOWLING_DTN_EXERCISES.filter((e) => e.parent === parent);
}

export function getBowlingExerciseById(id?: string | null): BowlingExercise | undefined {
  if (!id) return undefined;
  return BOWLING_DTN_EXERCISES.find((e) => e.id === id);
}

/**
 * Mapping rétro-compatibilité : ancien training_type → nouveau parent.
 * Permet d'afficher correctement les séances déjà saisies sans migration BDD.
 */
export const LEGACY_BOWLING_TYPE_MAP: Record<string, BowlingParent> = {
  bowling_practice: "bowling_technique",
  bowling_technique: "bowling_technique",
  bowling_approche: "bowling_technique",
  bowling_release: "bowling_technique",
  bowling_spare: "bowling_technique",
  bowling_game: "bowling_parties",
};

export function normalizeBowlingType(value?: string | null): string | null {
  if (!value) return null;
  if (value === "bowling_tactique") return value;
  return LEGACY_BOWLING_TYPE_MAP[value] ?? value;
}

// ─── Sérialisation des variables dans les notes ──────────────────────────────
const DTN_MARKER_RE = /<!--\s*bowling-dtn:(.*?)-->/s;

export function encodeBowlingDtnMeta(
  exerciseId: string | null,
  variables: Record<string, unknown>,
  existingNotes?: string | null,
): string {
  const stripped = (existingNotes || "").replace(DTN_MARKER_RE, "").trimEnd();
  if (!exerciseId) return stripped;
  const payload = JSON.stringify({ exerciseId, variables });
  return `${stripped}${stripped ? "\n" : ""}<!-- bowling-dtn:${payload} -->`;
}

export function decodeBowlingDtnMeta(notes?: string | null): {
  exerciseId: string | null;
  variables: Record<string, unknown>;
  visibleNotes: string;
} {
  if (!notes) return { exerciseId: null, variables: {}, visibleNotes: "" };
  const match = notes.match(DTN_MARKER_RE);
  const visibleNotes = notes.replace(DTN_MARKER_RE, "").trim();
  if (!match) return { exerciseId: null, variables: {}, visibleNotes };
  try {
    const parsed = JSON.parse(match[1]);
    return {
      exerciseId: parsed.exerciseId ?? null,
      variables: parsed.variables ?? {},
      visibleNotes,
    };
  } catch {
    return { exerciseId: null, variables: {}, visibleNotes };
  }
}
