// Types pour le mode simplifié de séance bowling.
// Pour l'instant, état local uniquement — la persistance sera ajoutée plus tard.

export type SimplifiedBlockType = "tactical" | "technical"; // d'autres types arriveront

export type SimplifiedTargetType =
  | "strike"
  | "pocket"
  | "composed_spare"
  | "single_pin";

export type ComposedSpareKey =
  | "6_10"
  | "3_6"
  | "1_3"
  | "1_2"
  | "2_4"
  | "4_7"
  | "2_8"
  | "3_9"
  | "3_10"
  | "washout_13_3_7"
  | "washout_1_2_10"
  | "belle_mere"
  | "custom";

export type SinglePinKey = "1" | "2" | "3" | "4" | "6" | "7" | "10";

export interface SimplifiedTacticalItem {
  id: string;
  target_type: SimplifiedTargetType;
  /** Pour composed_spare */
  composed_spare?: ComposedSpareKey;
  /** Combinaison custom de quilles (1-10) si composed_spare === "custom" */
  custom_pins?: number[];
  /** Pour single_pin */
  single_pin?: SinglePinKey;
  attempts: number;
  success: number;
}

export interface SimplifiedOilPattern {
  preset_name: string | null;
  image_url: string | null;
  length_feet: number | null;
  buff_distance_feet: number | null;
  width_boards: number | null;
  total_volume_ml: number | null;
  oil_ratio: string | null;
  profile_type: "flat" | "crown" | "reverse_block" | null;
  forward_oil: boolean;
  reverse_oil: boolean;
  outside_friction: "low" | "medium" | "high" | null;
}

export interface SimplifiedTacticalBlock {
  id: string;
  type: "tactical";
  title: string;
  duration_min: number;
  /** Boule utilisée pour ce bloc (id arsenal). */
  ball_id: string | null;
  oil_pattern: SimplifiedOilPattern;
  items: SimplifiedTacticalItem[];
}

export type TechnicalThemeKey =
  | "swing_axis"
  | "step_amplitude"
  | "release"
  | "feet_position"
  | "finish_position"
  | "timing"
  | "other";

export const TECHNICAL_THEMES: { value: TechnicalThemeKey; label: string }[] = [
  { value: "swing_axis", label: "Axe du Swing" },
  { value: "step_amplitude", label: "Amplitude des pas + appuis" },
  { value: "release", label: "Lâcher" },
  { value: "feet_position", label: "Position des appuis" },
  { value: "finish_position", label: "Position d'arrivée" },
  { value: "timing", label: "Timing" },
  { value: "other", label: "Autre (à préciser)" },
];

export interface SimplifiedTechnicalBlock {
  id: string;
  type: "technical";
  title: string;
  duration_min: number;
  /** Boule utilisée pour ce bloc (id arsenal). */
  ball_id: string | null;
  theme: TechnicalThemeKey;
  /** Si theme === "other" : libellé personnalisé */
  custom_theme?: string;
  /** Description libre de ce qui a été travaillé */
  description: string;
}

export type SimplifiedBlock = SimplifiedTacticalBlock | SimplifiedTechnicalBlock;

export const COMPOSED_SPARES: { value: ComposedSpareKey; label: string }[] = [
  { value: "6_10", label: "6-10" },
  { value: "3_6", label: "3-6" },
  { value: "1_3", label: "1-3" },
  { value: "1_2", label: "1-2" },
  { value: "2_4", label: "2-4" },
  { value: "4_7", label: "4-7" },
  { value: "2_8", label: "2-8" },
  { value: "3_9", label: "3-9" },
  { value: "3_10", label: "3-10" },
  { value: "washout_13_3_7", label: "Wash-out 1-3-3-7" },
  { value: "washout_1_2_10", label: "Wash-out 1-2-10" },
  { value: "belle_mere", label: "Belle-mère" },
  { value: "custom", label: "Autre (combinaison libre)" },
];

export const SINGLE_PINS: { value: SinglePinKey; label: string }[] = [
  { value: "1", label: "Quille 1" },
  { value: "2", label: "Quille 2" },
  { value: "3", label: "Quille 3" },
  { value: "4", label: "Quille 4" },
  { value: "6", label: "Quille 6" },
  { value: "7", label: "Quille 7" },
  { value: "10", label: "Quille 10" },
];

export const TARGET_TYPES: { value: SimplifiedTargetType; label: string }[] = [
  { value: "strike", label: "Strike" },
  { value: "pocket", label: "Poche du strike" },
  { value: "composed_spare", label: "Spares composés" },
  { value: "single_pin", label: "Quilles seules" },
];

export function itemLabel(item: SimplifiedTacticalItem): string {
  switch (item.target_type) {
    case "strike":
      return "Strike";
    case "pocket":
      return "Poche du strike";
    case "composed_spare": {
      if (item.composed_spare === "custom") {
        return item.custom_pins?.length
          ? `Spare custom (${item.custom_pins.join("-")})`
          : "Spare composé (à définir)";
      }
      const label = COMPOSED_SPARES.find((s) => s.value === item.composed_spare)?.label;
      return label ? `Spare ${label}` : "Spare composé";
    }
    case "single_pin": {
      const label = SINGLE_PINS.find((s) => s.value === item.single_pin)?.label;
      return label ?? "Quille seule";
    }
  }
}

export function technicalThemeLabel(block: SimplifiedTechnicalBlock): string {
  if (block.theme === "other") {
    return block.custom_theme?.trim() || "Autre thématique";
  }
  return TECHNICAL_THEMES.find((t) => t.value === block.theme)?.label ?? "Technique";
}

export function newItem(target_type: SimplifiedTargetType): SimplifiedTacticalItem {
  return {
    id: crypto.randomUUID(),
    target_type,
    attempts: 0,
    success: 0,
    ...(target_type === "composed_spare" ? { composed_spare: "6_10" as ComposedSpareKey } : {}),
    ...(target_type === "single_pin" ? { single_pin: "10" as SinglePinKey } : {}),
  };
}

export function newTacticalBlock(): SimplifiedTacticalBlock {
  return {
    id: crypto.randomUUID(),
    type: "tactical",
    title: "",
    duration_min: 20,
    oil_pattern: {
      preset_name: null,
      image_url: null,
      length_feet: null,
      buff_distance_feet: null,
      width_boards: null,
      total_volume_ml: null,
      oil_ratio: null,
      profile_type: null,
      forward_oil: true,
      reverse_oil: true,
      outside_friction: null,
    },
    items: [],
  };
}

export function newTechnicalBlock(): SimplifiedTechnicalBlock {
  return {
    id: crypto.randomUUID(),
    type: "technical",
    title: "",
    duration_min: 20,
    theme: "swing_axis",
    custom_theme: "",
    description: "",
  };
}
