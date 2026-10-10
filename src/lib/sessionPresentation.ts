import { getTrainingTypeLabel } from "@/lib/constants/trainingTypes";

/**
 * Présentation centralisée des séances (titres, origine, notes, statuts).
 * Affichage uniquement : ne modifie ni les données ni les modes de saisie.
 */

const ATHLETE_MARKER = /\[Séance athlète\]\s*/gi;
const MODE_SUFFIX = /\s*[—–-]\s*Mode\s+(simplifié|détaillé|avancé|rapide|guidé)\s*/gi;
const HIDDEN_TAGS = /<!--[\s\S]*?-->/g;
/** Lignes auto-générées par les modes de saisie (redondantes avec le résumé). */
const AUTO_LINE = /^(Séance\s+\S+(\s+\S+)?\s*[—–-]\s*Mode\s+\S+|Durée\s*:\s*\d+\s*min(\s*·\s*RPE\s*:\s*\d+(\.\d+)?\/10)?|RPE\s*:\s*\d+(\.\d+)?\/10)\s*$/i;

const SPORT_TITLES: Record<string, string> = {
  bowling: "Séance bowling",
  judo: "Séance judo",
  musculation: "Séance musculation",
  gym: "Séance musculation",
  course: "Séance de course",
  running: "Séance de course",
  mental: "Séance mentale",
};

export function cleanTechnicalTitle(text: string): string {
  return text.replace(ATHLETE_MARKER, "").replace(MODE_SUFFIX, " ").replace(/\s{2,}/g, " ").trim();
}

/** Titre affiché : titre personnalisé conservé, sinon libellé lisible sans mode technique. */
export function getSessionDisplayTitle(session: { training_type?: string | null; title?: string | null; name?: string | null } | null | undefined): string {
  if (!session) return "";
  const custom = cleanTechnicalTitle(String(session.title || session.name || ""));
  if (custom) return custom;
  const type = String(session.training_type || "").toLowerCase();
  const prefix = type.split("_")[0];
  if (/_(simplified|advanced|detailed|guided|quick)$/.test(type) && SPORT_TITLES[prefix]) return SPORT_TITLES[prefix];
  if (SPORT_TITLES[type]) return SPORT_TITLES[type];
  const label = cleanTechnicalTitle(getTrainingTypeLabel(type));
  return label || "Séance";
}

export type SessionOrigin = "personal" | "prescribed" | "unknown";

/** Origine réelle : créée par l'athlète (personnelle) ou par le staff (prescrite). */
export function getSessionOrigin(session: { created_by_player_id?: string | null; notes?: string | null; author_user_id?: string | null } | null | undefined): SessionOrigin {
  if (!session) return "unknown";
  if (session.created_by_player_id) return "personal";
  if (/\[Séance athlète\]/i.test(String(session.notes || ""))) return "personal";
  if (session.author_user_id) return "prescribed";
  // Séance sans créateur athlète : historiquement créée par le staff.
  return "prescribed";
}

/** Notes lisibles, sans balises cachées, marqueurs ni lignes auto-générées. */
export function getReadableNotes(notes: string | null | undefined): string {
  return String(notes || "")
    .replace(HIDDEN_TAGS, "")
    .replace(ATHLETE_MARKER, "")
    .split("\n")
    .filter((line) => !AUTO_LINE.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Intitulé de la section de notes selon l'origine : jamais « Consignes du coach » pour une séance personnelle. */
export function getNotesSectionKey(origin: SessionOrigin): "coachInstructions" | "myNotes" {
  return origin === "personal" ? "myNotes" : "coachInstructions";
}

export type CompletionStatus = "scheduled" | "inProgress" | "done" | "cancelled";
export type EntryStatus = "toComplete" | "partial" | "recorded";

export function getCompletionStatus(
  session: { session_date?: string | null; session_start_time?: string | null; session_end_time?: string | null; status?: string | null; is_cancelled?: boolean | null },
  now: Date = new Date(),
): CompletionStatus {
  if (session.is_cancelled || /cancel|annul/i.test(String(session.status || ""))) return "cancelled";
  if (!session.session_date) return "scheduled";
  const start = new Date(`${session.session_date}T${String(session.session_start_time || "00:00").slice(0, 5)}:00`);
  const end = new Date(`${session.session_date}T${String(session.session_end_time || "23:59").slice(0, 5)}:00`);
  if (now < start) return "scheduled";
  if (now <= end) return "inProgress";
  return "done";
}

/** Statut de saisie, indépendant de la réalisation. */
export function getEntryStatus(hasRpe: boolean, hasDetail: boolean, detailExpected: boolean): EntryStatus {
  if (!hasRpe && !hasDetail) return "toComplete";
  if (hasRpe && (hasDetail || !detailExpected)) return "recorded";
  return "partial";
}
