// Bibliothèque d'exercices bowling prédéfinis (technique / tactique / parties).
// Aucune mention de source externe.

import type { Json } from "@/integrations/supabase/types";

export interface SeedExercise {
  category: "warmup" | "technical" | "tactical" | "games";
  name: string;
  description: string;
  config: Record<string, unknown>;
}

export const BOWLING_SEED_EXERCISES: SeedExercise[] = [
  // TECHNIQUE
  {
    category: "technical",
    name: "Axe 0° + quille 1",
    description: "Régularité axe 0° avec objectif quille 1.",
    config: {
      exercise_type: "axis",
      parameters: ["axis_0"],
      target_outcomes: ["axis", "pin_1"],
      planned_throws: 30,
      sequence: "consecutive",
    },
  },
  {
    category: "technical",
    name: "Axe 0° + poche",
    description: "Travail d'axe 0° avec recherche de poche.",
    config: {
      exercise_type: "axis",
      parameters: ["axis_0"],
      target_outcomes: ["axis", "pocket"],
      planned_throws: 30,
    },
  },
  {
    category: "technical",
    name: "Vitesse constante",
    description: "Maintenir une vitesse cible sur l'ensemble des lancers.",
    config: {
      exercise_type: "speed",
      parameters: ["speed_normal"],
      target_outcomes: ["speed_target"],
      planned_throws: 20,
    },
  },
  {
    category: "technical",
    name: "Profondeur de pose",
    description: "Travail de la profondeur de pose.",
    config: {
      exercise_type: "depth",
      parameters: ["depth_normal"],
      target_outcomes: ["pocket"],
      planned_throws: 20,
    },
  },
  {
    category: "technical",
    name: "Rotation contrôlée",
    description: "Travail de rotation contrôlée et régulière.",
    config: { exercise_type: "rotation", parameters: ["rotation_normal"], target_outcomes: ["pocket"], planned_throws: 20 },
  },
  {
    category: "technical",
    name: "Ligne de jeu avec point de sortie",
    description: "Respect d'une ligne de jeu et d'un point de sortie cible.",
    config: { exercise_type: "technical_line", target_outcomes: ["breakpoint", "line"], planned_throws: 20 },
  },
  {
    category: "technical",
    name: "Régularité poche",
    description: "Maximiser le nombre de poches consécutives.",
    config: { exercise_type: "consistency", target_outcomes: ["pocket"], planned_throws: 30 },
  },
  {
    category: "technical",
    name: "Spares quille seule",
    description: "Travail des spares sur quilles seules.",
    config: { exercise_type: "technical_spare", target_outcomes: ["spare"], planned_throws: 20 },
  },
  {
    category: "technical",
    name: "Spares composés",
    description: "Travail des spares composés.",
    config: { exercise_type: "technical_spare", target_outcomes: ["spare"], planned_throws: 20 },
  },
  {
    category: "technical",
    name: "Routine complète",
    description: "Travail de routine complète avant chaque lancer.",
    config: { exercise_type: "routine", parameters: ["routine_full"], planned_throws: 20 },
  },

  // TACTIQUE
  {
    category: "tactical",
    name: "Poche et strike toute largeur",
    description: "Recherche de poche et strike en explorant toute la largeur de la piste.",
    config: { tactical_type: "pocket_strike_between_arrows", zones: ["gutter_f1","f1","f1_f2","f2","f2_f3","f3","f3_f4","f4"], throws_per_zone: 5 },
  },
  {
    category: "tactical",
    name: "Poche et strike entre les flèches",
    description: "Poche et strike en jouant uniquement entre les flèches.",
    config: { tactical_type: "pocket_strike_between_arrows", zones: ["f1_f2","f2_f3","f3_f4"], throws_per_zone: 10 },
  },
  {
    category: "tactical",
    name: "Zone flèche",
    description: "Travail flèche par flèche.",
    config: { tactical_type: "arrow_zone", zones: ["f1","f2","f3","f4","f5"], throws_per_zone: 6 },
  },
  {
    category: "tactical",
    name: "Placement déterminé au pied",
    description: "Travail de placement précis au pied (lattes définies).",
    config: { tactical_type: "foot_placement", planned_throws: 30 },
  },
  {
    category: "tactical",
    name: "Recherche de poche par zone",
    description: "Combien de lancers pour trouver la poche dans chaque zone.",
    config: { tactical_type: "pocket_search", zones: ["f1_f2","f2","f2_f3","f3"], throws_per_zone: 8 },
  },
  {
    category: "tactical",
    name: "Recherche de strike par zone",
    description: "Combien de lancers pour trouver le strike dans chaque zone.",
    config: { tactical_type: "strike_search", zones: ["f1_f2","f2","f2_f3","f3"], throws_per_zone: 8 },
  },
  {
    category: "tactical",
    name: "Adaptation pattern",
    description: "Adaptation aux modifications du pattern de jeu.",
    config: { tactical_type: "pattern_adaptation", planned_throws: 40 },
  },
  {
    category: "tactical",
    name: "Changement de boule",
    description: "Travail tactique avec changements de boule.",
    config: { tactical_type: "ball_change", planned_throws: 30 },
  },
  {
    category: "tactical",
    name: "Transition de piste",
    description: "Gestion des transitions de piste en cours d'entraînement.",
    config: { tactical_type: "lane_transition", planned_throws: 40 },
  },
  {
    category: "tactical",
    name: "Situation de jeu",
    description: "Mise en situation de jeu réelle, contraintes compétition.",
    config: { tactical_type: "game_situation", planned_throws: 30 },
  },

  // PARTIES
  { category: "games", name: "2 parties objectif score", description: "2 parties d'entraînement avec objectif score moyen.", config: { games_count: 2, objective: "avg_score" } },
  { category: "games", name: "4 parties situation compétition", description: "4 parties dans des conditions de compétition.", config: { games_count: 4, objective: "competition_routine" } },
  { category: "games", name: "6 parties régularité", description: "6 parties avec objectif de régularité.", config: { games_count: 6, objective: "consistency" } },
  { category: "games", name: "Parties avec objectif spare", description: "Maximiser le % de spares sur l'ensemble.", config: { games_count: 3, objective: "pct_spare" } },
  { category: "games", name: "Parties avec objectif strike", description: "Maximiser le % de strikes.", config: { games_count: 3, objective: "pct_strike" } },
  { category: "games", name: "Parties avec routine compétition", description: "Travail de la routine compétition.", config: { games_count: 3, objective: "competition_routine" } },
];

export const BOWLING_LIBRARY_CATEGORY_LABEL: Record<SeedExercise["category"], string> = {
  warmup: "Échauffement",
  technical: "Technique",
  tactical: "Tactique",
  games: "Parties",
};

export type _SuppressJsonUnused = Json;
