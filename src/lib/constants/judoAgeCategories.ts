/**
 * Catégories d'âge Judo (FFJDA) — l'appartenance se base sur l'âge atteint
 * durant l'année civile de la saison sportive.
 *
 * Référence donnée pour la saison 2026 :
 *  - Cadets (14 à 16 ans)        : 2010 / 2011 / 2012
 *  - Juniors (17 à 19 ans)       : 2007 / 2008 / 2009
 *  - Seniors (20 ans et plus)    : 2006 et avant
 *  - Vétérans / Masters (30 ans+): 1997 et avant
 */

export type JudoAgeCategoryValue = "cadets" | "juniors" | "seniors" | "veterans";

export interface JudoAgeCategoryDef {
  value: JudoAgeCategoryValue;
  name: string;
  /** Année de naissance la plus ancienne acceptée (offset appliqué à l'année de référence). */
  minYearOffset?: number;
  /** Année de naissance la plus récente acceptée (offset appliqué à l'année de référence). */
  maxYearOffset: number;
}

const JUDO_AGE_CATEGORY_DEFS: JudoAgeCategoryDef[] = [
  { value: "cadets", name: "Cadets (14 à 16 ans)", minYearOffset: 16, maxYearOffset: 14 },
  { value: "juniors", name: "Juniors (17 à 19 ans)", minYearOffset: 19, maxYearOffset: 17 },
  { value: "seniors", name: "Seniors (20 ans et plus)", maxYearOffset: 20 },
  { value: "veterans", name: "Vétérans / Masters (30 ans et plus)", maxYearOffset: 29 },
];

export interface JudoAgeCategoryOption {
  value: JudoAgeCategoryValue;
  label: string;
  /** Années de naissance éligibles (bornes incluses). */
  fromYear?: number;
  toYear: number;
}

export function getJudoAgeCategories(referenceYear: number = new Date().getFullYear()): JudoAgeCategoryOption[] {
  return JUDO_AGE_CATEGORY_DEFS.map((def) => {
    const toYear = referenceYear - def.maxYearOffset;
    const fromYear = def.minYearOffset != null ? referenceYear - def.minYearOffset : undefined;
    const years =
      fromYear != null
        ? Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i).join(" · ")
        : `${toYear} et avant`;
    return { value: def.value, label: `${def.name} : ${years}`, fromYear, toYear };
  });
}

/** Une date de naissance est-elle éligible à la catégorie d'âge judo choisie ? */
export function isEligibleForJudoAgeCategory(
  birthDate: string | null | undefined,
  categoryValue: string,
  referenceYear: number = new Date().getFullYear(),
): boolean {
  if (!birthDate) return false;
  const option = getJudoAgeCategories(referenceYear).find((o) => o.value === categoryValue);
  if (!option) return true;
  const birthYear = new Date(birthDate).getFullYear();
  if (Number.isNaN(birthYear)) return false;
  if (birthYear > option.toYear) return false;
  if (option.fromYear != null && birthYear < option.fromYear) return false;
  return true;
}

export function isJudoSport(sportType?: string | null): boolean {
  return !!sportType && sportType.toLowerCase().startsWith("judo");
}
