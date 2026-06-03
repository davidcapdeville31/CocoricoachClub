// Bowling — Travail Technique : paramètres et options structurés
// Aucune mention de source externe. Réutilisé coach + athlète.

export type TechParamGroup =
  | "speed"
  | "axis"
  | "rotation"
  | "depth"
  | "approach";

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
];

export const TECH_PARAM_GROUP_LABELS: Record<TechParamGroup, string> = {
  speed: "Vitesse",
  axis: "Axe",
  rotation: "Rotation",
  depth: "Profondeur de pose",
  approach: "Approche",
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

/** Synthetic params used outside the technical block (e.g. tactical zone pass). */
const SYNTHETIC_PARAM_LABELS: Record<string, string> = {
  __zone_pass__: "Passage sur la zone (flèche)",
};

export function getParamLabel(value: string): string {
  return (
    TECHNICAL_PARAMETERS.find((p) => p.value === value)?.label ??
    SYNTHETIC_PARAM_LABELS[value] ??
    value
  );
}
