/**
 * Aide pour déterminer quelles "familles" d'épreuves d'athlétisme un athlète pratique,
 * en se basant sur ses tableaux disciplines[]/specialties[] (ou les champs single legacy).
 *
 * Familles supportées (clé interne) :
 *  - sprints      → 60m, 100m, 200m, 400m
 *  - haies        → 60mH, 100mH, 110mH, 400mH
 *  - demi_fond    → 800m, 1500m
 *  - fond         → 3000m, 5000m, 10000m, semi, marathon
 *  - marche       → marche athlétique
 *  - sauts        → longueur, triple, hauteur, perche
 *  - lancers      → poids, disque, javelot, marteau
 *  - combines     → décathlon / heptathlon
 */

export type AthleticsGroup =
  | "sprints"
  | "haies"
  | "demi_fond"
  | "fond"
  | "marche"
  | "sauts"
  | "lancers"
  | "combines";

export interface AthleteDisciplinesInput {
  discipline?: string | null;
  specialty?: string | null;
  disciplines?: string[] | null;
  specialties?: string[] | null;
}

const DISCIPLINE_TO_GROUP: Record<string, AthleticsGroup> = {
  athletisme_sprints: "sprints",
  athletisme_haies: "haies",
  athletisme_demi_fond: "demi_fond",
  athletisme_fond: "fond",
  athletisme_marche: "marche",
  athletisme_sauts: "sauts",
  athletisme_sauts_longueur: "sauts",
  athletisme_sauts_hauteur: "sauts",
  athletisme_sauts_triple: "sauts",
  athletisme_sauts_perche: "sauts",
  athletisme_lancers: "lancers",
  athletisme_combines: "combines",
};

export function disciplineToGroup(discipline?: string | null): AthleticsGroup | null {
  if (!discipline) return null;
  const direct = DISCIPLINE_TO_GROUP[discipline];
  if (direct) return direct;
  const k = discipline.toLowerCase();
  if (k.includes("sprint")) return "sprints";
  if (k.includes("haie")) return "haies";
  if (k.includes("demi")) return "demi_fond";
  if (k.includes("fond")) return "fond";
  if (k.includes("marche")) return "marche";
  if (k.includes("saut") || k.includes("longueur") || k.includes("hauteur") || k.includes("perche") || k.includes("triple"))
    return "sauts";
  if (k.includes("lancer") || k.includes("poids") || k.includes("disque") || k.includes("javelot") || k.includes("marteau"))
    return "lancers";
  if (k.includes("combin") || k.includes("decathlon") || k.includes("heptathlon")) return "combines";
  return null;
}

export function getAthleteGroups(p: AthleteDisciplinesInput): Set<AthleticsGroup> {
  const set = new Set<AthleticsGroup>();
  const list: string[] = [];
  if (p.disciplines && p.disciplines.length > 0) list.push(...p.disciplines);
  if (p.discipline) list.push(p.discipline);
  for (const d of list) {
    const g = disciplineToGroup(d);
    if (g) set.add(g);
  }
  return set;
}

/** Athlète sans disciplines déclarées → on l'inclut partout pour ne pas bloquer (legacy). */
export function practicesAny(p: AthleteDisciplinesInput, groups: AthleticsGroup[]): boolean {
  const has = getAthleteGroups(p);
  if (has.size === 0) return true; // legacy : pas de discipline renseignée → visible partout
  return groups.some((g) => has.has(g));
}
