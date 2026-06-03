import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------- Pain customization ----------------

export type PainScaleLevel = {
  value: number; // 1..5
  label: string;
  color: string;
};

export type PainNature = {
  key: string;
  label: string;
  emoji?: string;
};

export type PainConfig = {
  scale: PainScaleLevel[]; // length 5, 1 = légère → 5 = intense
  natures: PainNature[];
};

export const DEFAULT_PAIN_NATURES: PainNature[] = [
  { key: "musculaire", label: "Musculaire", emoji: "💪" },
  { key: "articulaire", label: "Articulaire", emoji: "🦴" },
  { key: "tendineuse", label: "Tendineuse", emoji: "🧵" },
  { key: "ligamentaire", label: "Ligamentaire", emoji: "🪢" },
  { key: "osseuse", label: "Osseuse", emoji: "🦴" },
  { key: "nerveuse", label: "Nerveuse", emoji: "⚡" },
  { key: "autre", label: "Autre", emoji: "❓" },
];

export const DEFAULT_PAIN_CONFIG: PainConfig = {
  scale: [
    { value: 1, label: "Très légère", color: "hsl(var(--status-optimal))" },
    { value: 2, label: "Légère", color: "hsl(var(--status-optimal) / 0.7)" },
    { value: 3, label: "Modérée", color: "hsl(var(--status-attention))" },
    { value: 4, label: "Forte", color: "hsl(var(--status-critical) / 0.7)" },
    { value: 5, label: "Intense / limitante", color: "hsl(var(--status-critical))" },
  ],
  natures: DEFAULT_PAIN_NATURES,
};

export function mergePainConfig(saved: Partial<PainConfig> | null | undefined): PainConfig {
  if (!saved) return DEFAULT_PAIN_CONFIG;
  return {
    scale:
      Array.isArray(saved.scale) && saved.scale.length === 5
        ? saved.scale
        : DEFAULT_PAIN_CONFIG.scale,
    natures:
      Array.isArray(saved.natures) && saved.natures.length > 0
        ? saved.natures
        : DEFAULT_PAIN_CONFIG.natures,
  };
}

export function usePainConfig(categoryId: string | undefined) {
  return useQuery({
    queryKey: ["wellness_pain_config", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_question_configs")
        .select("pain_config")
        .eq("category_id", categoryId!)
        .maybeSingle();
      if (error) throw error;
      return mergePainConfig((data?.pain_config as unknown as PainConfig) ?? null);
    },
  });
}

export type WellnessScaleLevel = {
  value: number;
  label: string;
  color: string; // hsl(var(--token)) or hsl(...) string
};

export type WellnessQuestion = {
  key: string; // standard key or "custom_xxx"
  label: string;
  emoji: string;
  enabled: boolean;
  inverted: boolean; // true = lower is better
  is_custom: boolean;
  scale: WellnessScaleLevel[]; // length 5
  is_sleep_duration?: boolean; // special handling (heures)
};

const C_OPT = "hsl(var(--status-optimal))";
const C_GOOD = "hsl(var(--status-optimal) / 0.7)";
const C_MID = "hsl(var(--status-attention))";
const C_BAD = "hsl(var(--status-critical) / 0.7)";
const C_WORST = "hsl(var(--status-critical))";

// Inverted 0..5 (0 = best, 5 = worst). labels length 6.
const invertedScale = (labels: string[]): WellnessScaleLevel[] => [
  { value: 0, label: labels[0], color: C_OPT },
  { value: 1, label: labels[1], color: C_OPT },
  { value: 2, label: labels[2], color: C_GOOD },
  { value: 3, label: labels[3], color: C_MID },
  { value: 4, label: labels[4], color: C_BAD },
  { value: 5, label: labels[5], color: C_WORST },
];

// Fatigue musculaire 0..5 (0 = aucune fatigue)
const muscleFatigueScale = (): WellnessScaleLevel[] =>
  invertedScale([
    "Aucune fatigue",
    "Très légère",
    "Légère",
    "Modérée",
    "Forte",
    "Intense",
  ]);

// Positive 0..5 (0 = worst, 5 = best). labels length 6.
const positiveScale = (labels: string[]): WellnessScaleLevel[] => [
  { value: 0, label: labels[0], color: C_WORST },
  { value: 1, label: labels[1], color: C_WORST },
  { value: 2, label: labels[2], color: C_BAD },
  { value: 3, label: labels[3], color: C_MID },
  { value: 4, label: labels[4], color: C_GOOD },
  { value: 5, label: labels[5], color: C_OPT },
];



export const DEFAULT_WELLNESS_QUESTIONS: WellnessQuestion[] = [
  {
    key: "sleep_quality",
    label: "Qualité du sommeil",
    emoji: "😴",
    enabled: true,
    inverted: false,
    is_custom: false,
    scale: positiveScale(["Pas dormi", "Très mal dormi", "Mal dormi", "Moyen", "Bien dormi", "Très bien dormi"]),
  },
  {
    key: "sleep_duration",
    label: "Heures de sommeil",
    emoji: "🛏️",
    enabled: true,
    inverted: false,
    is_custom: false,
    is_sleep_duration: true,
    scale: positiveScale(["<6h", "<6h", "6-7h", "7-8h", "8-9h", ">9h"]),
  },
  {
    key: "general_fatigue",
    label: "Fatigue générale",
    emoji: "🔋",
    enabled: true,
    inverted: true,
    is_custom: false,
    scale: invertedScale(["Aucune fatigue", "Très en forme", "En forme", "Fatigué", "Très fatigué", "Épuisé"]),
  },
  {
    key: "soreness_upper_body",
    label: "Fatigue haut du corps",
    emoji: "💪",
    enabled: true,
    inverted: true,
    is_custom: false,
    scale: muscleFatigueScale(),
  },
  {
    key: "soreness_lower_body",
    label: "Fatigue bas du corps",
    emoji: "🦵",
    enabled: true,
    inverted: true,
    is_custom: false,
    scale: muscleFatigueScale(),
  },

  {
    key: "stress_level",
    label: "Stress",
    emoji: "🧠",

    enabled: true,
    inverted: true,
    is_custom: false,
    scale: invertedScale(["Aucun stress", "Très détendu", "Détendu", "Un peu stressé", "Stressé", "Très stressé"]),
  },
];

export const STANDARD_KEYS = new Set(
  DEFAULT_WELLNESS_QUESTIONS.map((q) => q.key),
);

/** Merge saved config with defaults: keep order from saved, add missing standards at end as disabled? No → keep them enabled to preserve previous behavior unless explicitly disabled. */
export function mergeWithDefaults(saved: WellnessQuestion[] | null | undefined): WellnessQuestion[] {
  if (!saved || saved.length === 0) return DEFAULT_WELLNESS_QUESTIONS;
  const result: WellnessQuestion[] = [];
  const savedKeys = new Set(saved.map((q) => q.key));
  for (const q of saved) {
    const defaultQ = DEFAULT_WELLNESS_QUESTIONS.find(d => d.key === q.key);
    const isStandard = !!defaultQ;
    const validScale = Array.isArray(q.scale) && (q.scale.length === 5 || q.scale.length === 6);
    // Force standard keys to use the new 0..5 defaults (length 6) so legacy
    // saved configs (length 5, value 1..5) are automatically migrated.
    result.push({
      ...q,
      scale: isStandard
        ? defaultQ!.scale
        : (validScale ? q.scale : positiveScale(["0","1","2","3","4","5"])),
    });
  }


  // Append any default standards that were not in saved (e.g., added later)
  for (const d of DEFAULT_WELLNESS_QUESTIONS) {
    if (!savedKeys.has(d.key)) result.push(d);
  }
  return result;
}

export function useWellnessQuestions(categoryId: string | undefined) {
  return useQuery({
    queryKey: ["wellness_question_config", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_question_configs")
        .select("questions")
        .eq("category_id", categoryId!)
        .maybeSingle();
      if (error) throw error;
      const raw = (data?.questions as unknown as WellnessQuestion[]) || null;
      return mergeWithDefaults(raw);
    },
  });
}
