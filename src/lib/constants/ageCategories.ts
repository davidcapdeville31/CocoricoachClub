/**
 * Catégories d'âge officielles par fédération sportive.
 * Référentiels : FFR, FFBSQ, FFS/FIS, FFJDA, FFA, FFT, FFS Surf.
 * Fallback générique pour les autres sports : U10 → Master.
 */

import { getJudoAgeCategories } from "@/lib/constants/judoAgeCategories";

export type AgeCategoryOption = { value: string; label: string };

export const AGE_CATEGORIES_BY_SPORT: Record<string, AgeCategoryOption[]> = {
  // Rugby — FFR
  XV: [
    { value: "u6", label: "Moins de 6 ans (M6)" },
    { value: "u8", label: "Moins de 8 ans (M8)" },
    { value: "u10", label: "Moins de 10 ans (M10)" },
    { value: "u12", label: "Moins de 12 ans (M12)" },
    { value: "u14", label: "Moins de 14 ans (M14 - Benjamins)" },
    { value: "cadets_gaudermen", label: "Cadets Gaudermen (-16)" },
    { value: "cadets_alamercery", label: "Cadets Alamercery (-17)" },
    { value: "juniors_crabos", label: "Juniors Crabos (-19)" },
    { value: "juniors_balandrade", label: "Juniors Balandrade (-19)" },
    { value: "reichel_espoirs", label: "Reichel / Espoirs" },
    { value: "senior", label: "Senior" },
    { value: "veteran", label: "Vétéran" },
  ],
  rugby_a_7: [
    { value: "u14", label: "M14" },
    { value: "u16", label: "M16" },
    { value: "u18", label: "M18" },
    { value: "u20", label: "M20" },
    { value: "senior", label: "Senior" },
  ],

  // Bowling — FFBSQ
  bowling: [
    { value: "u12", label: "U12 (10-12)" },
    { value: "u14", label: "U14 (11-13)" },
    { value: "u19", label: "U19 (14-18)" },
    { value: "u23", label: "U23 (19-22)" },
    { value: "seniors", label: "Seniors (18-50)" },
    { value: "veterans_a", label: "Vétérans A (51-65)" },
    { value: "veterans_b", label: "Vétérans B (66+)" },
  ],

  // Ski / Snowboard — FFS / FIS
  ski_alpin: skiCategories(),
  ski_fond: skiCategories(),
  ski_freestyle: skiCategories(),
  ski_freeride: skiCategories(),
  snowboard: skiCategories(),


  // Athlétisme — FFA
  athletisme: athletismeCategories(),
  athletisme_demi_fond: athletismeCategories(),
  athletisme_fond: athletismeCategories(),
  athletisme_lancers: athletismeCategories(),
  athletisme_sauts: athletismeCategories(),
  athletisme_sprint: athletismeCategories(),
  athletisme_combine: athletismeCategories(),
  athletisme_marche: athletismeCategories(),
  athletisme_haies: athletismeCategories(),

  // Tennis / Padel — FFT
  tennis: tennisCategories(),
  padel: tennisCategories(),

  // Surf — FFS Surf
  surf: [
    { value: "u12", label: "U12" },
    { value: "u14", label: "U14" },
    { value: "u16", label: "U16" },
    { value: "u18", label: "U18" },
    { value: "open", label: "Open" },
    { value: "master", label: "Master (35+)" },
  ],
};

function skiCategories(): AgeCategoryOption[] {
  return [
    { value: "u8", label: "U8" },
    { value: "u10", label: "U10" },
    { value: "u12", label: "U12" },
    { value: "u14", label: "U14" },
    { value: "u16", label: "U16" },
    { value: "u18", label: "U18" },
    { value: "u21", label: "U21" },
    { value: "senior", label: "Senior" },
    { value: "master", label: "Master (30+)" },
  ];
}

function athletismeCategories(): AgeCategoryOption[] {
  return [
    { value: "eveil_athletique", label: "Éveil athlétique (7-9)" },
    { value: "poussins", label: "Poussins (10-11)" },
    { value: "benjamins", label: "Benjamins (12-13)" },
    { value: "minimes", label: "Minimes (14-15)" },
    { value: "cadets", label: "Cadets (16-17)" },
    { value: "juniors", label: "Juniors (18-19)" },
    { value: "espoirs", label: "Espoirs (20-22)" },
    { value: "seniors", label: "Seniors (23+)" },
    { value: "masters", label: "Masters (35+)" },
  ];
}

function tennisCategories(): AgeCategoryOption[] {
  return [
    { value: "8_ans", label: "8 ans" },
    { value: "9_10_ans", label: "9-10 ans" },
    { value: "11_12_ans", label: "11-12 ans" },
    { value: "13_14_ans", label: "13-14 ans" },
    { value: "15_16_ans", label: "15-16 ans" },
    { value: "17_18_ans", label: "17-18 ans" },
    { value: "senior", label: "Senior" },
    { value: "plus_35", label: "+35 ans" },
    { value: "plus_45", label: "+45 ans" },
    { value: "plus_55", label: "+55 ans" },
    { value: "plus_65", label: "+65 ans" },
  ];
}

const GENERIC_U_CATEGORIES: AgeCategoryOption[] = [
  { value: "u10", label: "U10" },
  { value: "u12", label: "U12" },
  { value: "u14", label: "U14" },
  { value: "u16", label: "U16" },
  { value: "u18", label: "U18" },
  { value: "u20", label: "U20" },
  { value: "senior", label: "Senior" },
  { value: "master", label: "Master (35+)" },
];

export function getAgeCategoriesForSport(
  sportType: string,
  referenceYear: number = new Date().getFullYear(),
): AgeCategoryOption[] {
  if (AGE_CATEGORIES_BY_SPORT[sportType]) return AGE_CATEGORIES_BY_SPORT[sportType];

  // Préfixes dynamiques (ski_*, athletisme_*, bowling_*)
  if (sportType?.startsWith("ski_") || sportType === "snowboard") return skiCategories();
  if (sportType?.startsWith("athletisme")) return athletismeCategories();
  if (sportType?.startsWith("bowling")) return AGE_CATEGORIES_BY_SPORT.bowling;
  if (sportType?.toLowerCase().startsWith("judo")) {
    // Les années éligibles suivent l'année civile de la saison en cours
    return getJudoAgeCategories(referenceYear).map((o) => ({ value: o.value, label: o.label }));
  }

  return GENERIC_U_CATEGORIES;
}

export function getAgeCategoryLabel(
  sportType: string,
  value: string,
  referenceYear: number = new Date().getFullYear(),
): string {
  return getAgeCategoriesForSport(sportType, referenceYear).find((o) => o.value === value)?.label ?? value;
}
