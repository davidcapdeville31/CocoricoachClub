// Tactique : zones de jeu, types d'exercices, options pattern.

export const TACTICAL_EXERCISE_TYPES = [
  { value: "pocket_strike_between_arrows", label: "Poche/strike entre les flèches" },
  { value: "arrow_zone", label: "Zone flèche" },
  { value: "foot_placement", label: "Placement déterminé au pied" },
  { value: "play_line", label: "Ligne de jeu" },
  { value: "pattern_adaptation", label: "Adaptation pattern" },
  { value: "pocket_search", label: "Recherche de poche" },
  { value: "strike_search", label: "Recherche de strike" },
  { value: "foot_move", label: "Déplacement au pied" },
  { value: "breakpoint_move", label: "Déplacement au point de sortie" },
  { value: "ball_change", label: "Changement de boule" },
  { value: "lane_transition", label: "Gestion de transition de piste" },
  { value: "game_situation", label: "Situation de jeu" },
  { value: "custom_tactical", label: "Tactique personnalisé" },
] as const;
export type TacticalExerciseType = (typeof TACTICAL_EXERCISE_TYPES)[number]["value"];

export interface TacticalZone {
  value: string;
  label: string;
  short: string;
  /** Latte représentative (centre, planche bowling 1-39) pour heatmap */
  board: number;
}

// Zones côté ligne (droitier), de la rigole gauche vers la rigole droite.
export const TACTICAL_ZONES: TacticalZone[] = [
  { value: "gutter_f1", label: "Rigole → Flèche 1", short: "G-F1", board: 3 },
  { value: "f1", label: "Flèche 1", short: "F1", board: 5 },
  { value: "f1_f2", label: "Entre F1 et F2", short: "F1-F2", board: 8 },
  { value: "f2", label: "Flèche 2", short: "F2", board: 10 },
  { value: "f2_f3", label: "Entre F2 et F3", short: "F2-F3", board: 13 },
  { value: "f3", label: "Flèche 3", short: "F3", board: 15 },
  { value: "f3_f4", label: "Entre F3 et F4", short: "F3-F4", board: 18 },
  { value: "f4", label: "Flèche 4", short: "F4", board: 20 },
  { value: "f5", label: "Flèche 5", short: "F5", board: 25 },
  { value: "f6", label: "Flèche 6", short: "F6", board: 30 },
  { value: "custom", label: "Zone personnalisée", short: "Perso", board: 20 },
];

export const TOLERANCE_OPTIONS = [
  { value: 1, label: "± 1 latte" },
  { value: 2, label: "± 2 lattes" },
  { value: 3, label: "± 3 lattes" },
] as const;

export const PATTERN_DIFFICULTY = [
  { value: "easy", label: "Facile" },
  { value: "medium", label: "Moyenne" },
  { value: "hard", label: "Difficile" },
  { value: "very_hard", label: "Très difficile" },
] as const;

export const GAME_OBJECTIVES = [
  { value: "avg_score", label: "Score moyen" },
  { value: "pct_pocket", label: "% poche" },
  { value: "pct_strike", label: "% strike" },
  { value: "pct_spare", label: "% spare" },
  { value: "pct_single_pin", label: "% quilles seules" },
  { value: "pct_compound_spare", label: "% spares composés" },
  { value: "pct_ge_8", label: "% ≥ 8" },
  { value: "max_splits", label: "Nombre de splits maximum" },
  { value: "consistency", label: "Régularité" },
  { value: "strategy", label: "Stratégie de jeu" },
  { value: "competition_routine", label: "Routine compétition" },
] as const;

export function zoneLabel(value: string): string {
  return TACTICAL_ZONES.find((z) => z.value === value)?.label ?? value;
}
export function zoneShort(value: string): string {
  return TACTICAL_ZONES.find((z) => z.value === value)?.short ?? value;
}
