// Bowling — Travail Technique : paramètres et options structurés
// Aucune mention de source externe. Réutilisé coach + athlète.

export type TechParamGroup =
  | "speed"
  | "axis"
  | "rotation"
  | "depth"
  | "approach"
  | "release"
  | "swing"
  | "routine";

export interface TechnicalParameterOption {
  value: string;
  label: string;
  group: TechParamGroup;
}

export const TECHNICAL_EXERCISE_TYPES = [
  { value: "axis", label: "Axe de rotation" },
  { value: "speed", label: "Vitesse" },
  { value: "rotation", label: "Rotation" },
  { value: "depth", label: "Profondeur de pose" },
  { value: "consistency", label: "Régularité gestuelle" },
  { value: "technical_line", label: "Ligne de jeu technique" },
  { value: "technical_spare", label: "Spare technique" },
  { value: "routine", label: "Travail de routine" },
  { value: "custom_combo", label: "Travail combiné personnalisé" },
] as const;
export type TechnicalExerciseType = (typeof TECHNICAL_EXERCISE_TYPES)[number]["value"];

export const TECHNICAL_PARAMETERS: TechnicalParameterOption[] = [
  { value: "speed_normal", label: "Vitesse normale", group: "speed" },
  { value: "speed_minus", label: "Vitesse −", group: "speed" },
  { value: "speed_plus", label: "Vitesse +", group: "speed" },

  { value: "axis_natural", label: "Axe naturel", group: "axis" },
  { value: "axis_0", label: "Axe 0°", group: "axis" },
  { value: "axis_0_30", label: "Axe 0° à 30°", group: "axis" },
  { value: "axis_30_60", label: "Axe 30° à 60°", group: "axis" },

  { value: "rotation_normal", label: "Rotation normale", group: "rotation" },
  { value: "rotation_minus", label: "Rotation −", group: "rotation" },
  { value: "rotation_plus", label: "Rotation +", group: "rotation" },

  { value: "depth_normal", label: "Profondeur normale", group: "depth" },
  { value: "depth_minus", label: "Profondeur −", group: "depth" },
  { value: "depth_plus", label: "Profondeur +", group: "depth" },

  { value: "approach_normal", label: "Approche normale", group: "approach" },
  { value: "approach_slow", label: "Approche ralentie", group: "approach" },
  { value: "approach_dynamic", label: "Approche dynamique", group: "approach" },

  { value: "release_normal", label: "Relâchement normal", group: "release" },
  { value: "release_soft", label: "Relâchement souple", group: "release" },
  { value: "release_fast", label: "Relâchement accéléré", group: "release" },

  { value: "swing_free", label: "Swing libre", group: "swing" },
  { value: "swing_controlled", label: "Swing contrôlé", group: "swing" },

  { value: "routine_full", label: "Routine complète", group: "routine" },
  { value: "routine_simple", label: "Routine simplifiée", group: "routine" },
];

export const TECH_PARAM_GROUP_LABELS: Record<TechParamGroup, string> = {
  speed: "Vitesse",
  axis: "Axe",
  rotation: "Rotation",
  depth: "Profondeur de pose",
  approach: "Approche",
  release: "Relâchement",
  swing: "Swing",
  routine: "Routine",
};

export const SEQUENCE_MODES = [
  { value: "consecutive", label: "Consécutif" },
  { value: "alternating", label: "Alterné" },
  { value: "series", label: "Par série" },
  { value: "free", label: "Libre" },
  { value: "progressive", label: "Progressif" },
  { value: "decreasing", label: "Décroissant" },
  { value: "difficulty_up", label: "Difficulté croissante" },
  { value: "difficulty_down", label: "Difficulté décroissante" },
] as const;

export const THROW_PRESETS = [10, 20, 30, 40, 50] as const;

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Élevée" },
] as const;

export function getParamLabel(value: string): string {
  return TECHNICAL_PARAMETERS.find((p) => p.value === value)?.label ?? value;
}
