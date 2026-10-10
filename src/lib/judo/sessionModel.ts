/**
 * Modèle de la séance judo premium. Stockage compatible :
 * - training_sessions (training_type "terrain", session_kind training/competition)
 * - training_session_blocks (training_type judo_*, theme, durée, intensité prévue, objective = résumé)
 * - détail structuré dans un tag rétrocompatible `<!--judo-block:{...}-->` en fin de notes.
 */
import {
  COOLDOWN_OPTIONS, JUDO_MODALITIES, OPPOSITION_TYPES, PHYSICAL_QUALITIES, RANDORI_TYPES,
  TACTICAL_AXES, WARMUP_OPTIONS, labelOf, techniqueByKey, NE_WAZA_SITUATIONS, familyByKey,
  type JudoPosition,
} from "./nomenclature";

export type JudoBlockKind = "technique" | "tactic" | "randori" | "physical" | "warmup" | "cooldown";

export const BLOCK_META: Record<JudoBlockKind, { label: string; emoji: string; trainingType: string; tone: string }> = {
  technique: { label: "Technique", emoji: "🥋", trainingType: "judo_technique", tone: "judo-technique" },
  tactic: { label: "Tactique", emoji: "🎯", trainingType: "judo_tactique", tone: "judo-tactic" },
  randori: { label: "Randori", emoji: "⚡", trainingType: "judo_randori", tone: "judo-randori" },
  physical: { label: "Physique", emoji: "💪", trainingType: "judo_physique", tone: "judo-physical" },
  warmup: { label: "Échauffement", emoji: "🔥", trainingType: "judo_echauffement", tone: "judo-tactic" },
  cooldown: { label: "Retour au calme", emoji: "🧘", trainingType: "judo_retour_calme", tone: "judo-mental" },
};

export const BLOCK_ORDER: JudoBlockKind[] = ["technique", "tactic", "randori", "physical", "warmup", "cooldown"];

export interface ModalityEntry {
  key: string;
  duration_min: number | null;
  sets: number | null;
  reps: number | null;
  rest_s: number | null;
  partner: string;
  instructions: string;
}

export interface PhysicalExercise {
  id: string;
  name: string;
  sets: number | null;
  reps: number | null;
  duration_min: number | null;
  load: string;
  rest_s: number | null;
  intensity: number | null;
  instructions: string;
}

export interface JudoBlock {
  id: string;
  kind: JudoBlockKind;
  title: string;
  /** Durée saisie manuellement ; pour le randori, calculée si nombre + durée unitaire sont renseignés. */
  duration_min: number | null;
  /** Intensité prévue (1–10), facultative. */
  intensity: number | null;
  description: string;
  observations: string;
  // Technique
  positions: JudoPosition[];
  families: string[];
  techniques: string[];
  situations: string[];
  modalities: ModalityEntry[];
  // Tactique
  axes: string[];
  start_situation: string;
  tactical_goal: string;
  constraints: string;
  // Randori
  randori_type: string | null;
  opposition_type: string | null;
  randori_count: number | null;
  randori_unit_min: number | null;
  randori_rest_min: number | null;
  evaluation: Record<string, string>;
  // Physique
  qualities: string[];
  exercises: PhysicalExercise[];
  // Échauffement / retour au calme
  options: string[];
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newBlock(kind: JudoBlockKind): JudoBlock {
  return {
    id: uid(), kind, title: "", duration_min: null, intensity: null, description: "", observations: "",
    positions: [], families: [], techniques: [], situations: [], modalities: [],
    axes: [], start_situation: "", tactical_goal: "", constraints: "",
    randori_type: null, opposition_type: null, randori_count: null, randori_unit_min: null, randori_rest_min: null, evaluation: {},
    qualities: [], exercises: [], options: [],
  };
}

export const newModality = (key: string): ModalityEntry => ({ key, duration_min: null, sets: null, reps: null, rest_s: null, partner: "", instructions: "" });
export const newExercise = (): PhysicalExercise => ({ id: uid(), name: "", sets: null, reps: null, duration_min: null, load: "", rest_s: null, intensity: null, instructions: "" });

/** Durées randori : opposition, récupération (entre randori), total. Null si données insuffisantes. */
export function randoriDurations(b: Pick<JudoBlock, "randori_count" | "randori_unit_min" | "randori_rest_min">) {
  const n = b.randori_count ?? 0;
  const u = b.randori_unit_min ?? 0;
  if (n <= 0 || u <= 0) return null;
  const opposition = n * u;
  const recovery = Math.max(n - 1, 0) * (b.randori_rest_min ?? 0);
  return { opposition, recovery, total: opposition + recovery };
}

/** Durée effective d'un bloc ; null si non renseignée (jamais 0 inventé). */
export function blockDuration(b: JudoBlock): number | null {
  if (b.kind === "randori") {
    const r = randoriDurations(b);
    if (r) return r.total;
  }
  return b.duration_min && b.duration_min > 0 ? b.duration_min : null;
}

export function sumBlocks(blocks: JudoBlock[]) {
  let total = 0;
  let missing = 0;
  for (const b of blocks) {
    const d = blockDuration(b);
    if (d == null) missing++;
    else total += d;
  }
  return { total, missing };
}

/** Durée entre deux heures HH:MM ; null si invalide ou fin ≤ début. */
export function durationFromTimes(start: string, end: string): number | null {
  const m = (s: string) => {
    const r = /^(\d{1,2}):(\d{2})$/.exec(s || "");
    return r ? Number(r[1]) * 60 + Number(r[2]) : null;
  };
  const a = m(start), b = m(end);
  if (a == null || b == null || b <= a) return null;
  return b - a;
}

export function addMinutes(start: string, minutes: number): string | null {
  const r = /^(\d{1,2}):(\d{2})$/.exec(start || "");
  if (!r) return null;
  const t = Number(r[1]) * 60 + Number(r[2]) + minutes;
  if (t >= 24 * 60) return null;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export const blockTitle = (b: JudoBlock) => b.title.trim() || BLOCK_META[b.kind].label;

/** Résumé court, uniquement à partir des données saisies. */
export function blockSummary(b: JudoBlock): string {
  const parts: string[] = [];
  if (b.kind === "technique") {
    if (b.positions.length) parts.push(b.positions.map((p) => (p === "tachi" ? "Tachi-waza" : "Ne-waza")).join(" + "));
    if (b.modalities.length) parts.push(b.modalities.map((m) => labelOf(JUDO_MODALITIES, m.key)).join(", "));
    const techs = b.techniques.map((k) => techniqueByKey(k)?.label ?? k);
    if (techs.length) parts.push(techs.slice(0, 3).join(", ") + (techs.length > 3 ? ` +${techs.length - 3}` : ""));
    else if (b.families.length) parts.push(b.families.map((f) => familyByKey(f)?.label ?? f).join(", "));
    if (b.situations.length) parts.push(b.situations.map((s) => labelOf(NE_WAZA_SITUATIONS, s)).join(", "));
  } else if (b.kind === "tactic") {
    if (b.axes.length) parts.push(b.axes.map((a) => labelOf(TACTICAL_AXES, a)).join(", "));
    if (b.tactical_goal.trim()) parts.push(b.tactical_goal.trim());
  } else if (b.kind === "randori") {
    if (b.randori_type) parts.push(labelOf(RANDORI_TYPES, b.randori_type));
    if (b.randori_count && b.randori_unit_min) parts.push(`${b.randori_count} × ${b.randori_unit_min} min`);
    if (b.opposition_type) parts.push(labelOf(OPPOSITION_TYPES, b.opposition_type));
  } else if (b.kind === "physical") {
    if (b.qualities.length) parts.push(b.qualities.map((q) => labelOf(PHYSICAL_QUALITIES, q)).join(", "));
    const named = b.exercises.filter((e) => e.name.trim());
    if (named.length) parts.push(`${named.length} exercice${named.length > 1 ? "s" : ""}`);
  } else {
    const list = b.kind === "warmup" ? WARMUP_OPTIONS : COOLDOWN_OPTIONS;
    if (b.options.length) parts.push(b.options.map((o) => labelOf(list, o)).join(", "));
  }
  return parts.join(" · ");
}

const JUDO_TAG = /<!--judo-block:([\s\S]*?)-->/;

/** Texte lisible (anciens écrans) + tag structuré. */
export function encodeBlockNotes(b: JudoBlock): string {
  const lines: string[] = [];
  const s = blockSummary(b);
  if (s) lines.push(s);
  if (b.kind === "randori") {
    const r = randoriDurations(b);
    if (r) lines.push(`Opposition ${r.opposition} min · Récupération ${r.recovery} min · Total ${r.total} min`);
  }
  if (b.kind === "tactic") {
    if (b.start_situation.trim()) lines.push(`Situation : ${b.start_situation.trim()}`);
    if (b.constraints.trim()) lines.push(`Contraintes : ${b.constraints.trim()}`);
  }
  if (b.kind === "randori" && b.constraints.trim()) lines.push(`Contraintes : ${b.constraints.trim()}`);
  for (const m of b.modalities) if (m.instructions.trim()) lines.push(`${labelOf(JUDO_MODALITIES, m.key)} : ${m.instructions.trim()}`);
  for (const e of b.exercises) {
    if (!e.name.trim()) continue;
    const bits = [e.sets && e.reps ? `${e.sets} × ${e.reps}` : e.sets ? `${e.sets} séries` : null, e.duration_min ? `${e.duration_min} min` : null, e.load.trim() || null].filter(Boolean);
    lines.push(`• ${e.name.trim()}${bits.length ? ` — ${bits.join(" · ")}` : ""}`);
  }
  if (b.description.trim()) lines.push(b.description.trim());
  if (b.observations.trim()) lines.push(`Observations : ${b.observations.trim()}`);
  const { id: _id, ...data } = b;
  return `${lines.join("\n")}\n<!--judo-block:${JSON.stringify({ v: 1, ...data })}-->`;
}

export function decodeBlockNotes(notes: string | null | undefined): Partial<JudoBlock> | null {
  const m = JUDO_TAG.exec(notes || "");
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

export interface JudoSessionMeta {
  objective: string | null;
  secondary_objectives: string[];
  competition?: { name: string; location: string; category: string; level: string; observations: string } | null;
}

export function encodeSessionNotes(title: string, meta: JudoSessionMeta): string {
  return `${title}\n<!--judo-session:${JSON.stringify({ v: 1, ...meta })}-->`;
}

/** Ligne prête à insérer dans training_session_blocks (sans training_session_id). */
export function toBlockRow(b: JudoBlock, idx: number) {
  return {
    block_order: idx,
    training_type: BLOCK_META[b.kind].trainingType,
    theme: blockTitle(b),
    duration_minutes: blockDuration(b),
    intensity: b.intensity && b.intensity >= 1 && b.intensity <= 10 ? b.intensity : null,
    objective: blockSummary(b) || null,
    notes: encodeBlockNotes(b),
  };
}
