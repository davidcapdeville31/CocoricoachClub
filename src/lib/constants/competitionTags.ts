/**
 * Couleurs / catégories de compétition choisies par le staff.
 * Transversal : disponible pour toutes les disciplines.
 */
export type CompetitionTag = "mandatory" | "national_team" | "free_tournament";

export interface CompetitionTagDef {
  value: CompetitionTag;
  label: string;
  /** Classe de pastille (rond de couleur) */
  dot: string;
  /** Classe de badge (fond doux + texte) */
  badge: string;
  /** Classe d'encadré complet (bordure + fond teinté) */
  card: string;
  hex: string;
}

export const COMPETITION_TAGS: CompetitionTagDef[] = [
  {
    value: "mandatory",
    label: "Obligatoire",
    dot: "bg-red-500",
    badge: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    card: "border-red-500/60 bg-red-500/10 hover:bg-red-500/15",
    hex: "#ef4444",
  },
  {
    value: "national_team",
    label: "Équipe de France",
    dot: "bg-blue-500",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    card: "border-blue-500/60 bg-blue-500/10 hover:bg-blue-500/15",
    hex: "#3b82f6",
  },
  {
    value: "free_tournament",
    label: "Tournoi libre",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    card: "border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/15",
    hex: "#10b981",
  },
];

export function getCompetitionTag(value?: string | null): CompetitionTagDef | null {
  if (!value) return null;
  return COMPETITION_TAGS.find((t) => t.value === value) ?? null;
}
