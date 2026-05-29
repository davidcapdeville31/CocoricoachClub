// Objectifs résultat communs aux blocs technique/tactique/parties.

export interface TargetOutcome {
  value: string;
  label: string;
  /** Champ booléen correspondant côté lancer (bowling_throw_results) */
  field?:
    | "axis_success"
    | "speed_success"
    | "release_success"
    | "breakpoint_success"
    | "pocket_success"
    | "strike_success"
    | "spare_success";
}

export const TARGET_OUTCOMES: TargetOutcome[] = [
  { value: "pin_1", label: "Toucher la quille 1" },
  { value: "pin_2", label: "Toucher la quille 2" },
  { value: "pin_3", label: "Toucher la quille 3" },
  { value: "pin_4", label: "Toucher la quille 4" },
  { value: "pin_5", label: "Toucher la quille 5" },
  { value: "pin_6", label: "Toucher la quille 6" },
  { value: "pin_7", label: "Toucher la quille 7" },
  { value: "pin_8", label: "Toucher la quille 8" },
  { value: "pin_9", label: "Toucher la quille 9" },
  { value: "pin_10", label: "Toucher la quille 10" },
  { value: "pocket", label: "Boule en poche", field: "pocket_success" },
  { value: "pocket_strike", label: "Boule en poche + strike", field: "strike_success" },
  { value: "spare", label: "Spare réussi", field: "spare_success" },
  { value: "breakpoint", label: "Point de sortie respecté", field: "breakpoint_success" },
  { value: "arrow_zone", label: "Zone de flèche respectée" },
  { value: "speed_target", label: "Vitesse cible respectée", field: "speed_success" },
  { value: "line", label: "Ligne de jeu respectée" },
  { value: "axis", label: "Axe respecté", field: "axis_success" },
  { value: "double", label: "Doublé réussi" },
  { value: "triple", label: "Triplé réussi" },
  { value: "quad", label: "Quadruplé réussi" },
];

export const SUCCESS_CRITERIA_KEYS = [
  { key: "min_axis_pct", label: "% minimum axe respecté", suffix: "%" },
  { key: "min_pocket_pct", label: "% minimum poche", suffix: "%" },
  { key: "min_strike_pct", label: "% minimum strike", suffix: "%" },
  { key: "min_pocket_strike_pct", label: "% minimum poche + strike", suffix: "%" },
  { key: "min_breakpoint_pct", label: "% minimum point de sortie", suffix: "%" },
  { key: "min_pin_pct", label: "% minimum quille touchée", suffix: "%" },
  { key: "speed_tolerance_kmh", label: "Tolérance vitesse", suffix: "km/h" },
  { key: "consecutive_target", label: "Réussites consécutives", suffix: "" },
  { key: "min_score", label: "Score minimum", suffix: "pts" },
] as const;

export function outcomeLabel(value: string): string {
  return TARGET_OUTCOMES.find((o) => o.value === value)?.label ?? value;
}
