/**
 * Cardio metric adaptation for athlete session feedback.
 * When the coach prescribes distance (m) or duration, the athlete logs the same
 * metric instead of kg × reps. Generic for every discipline.
 */
import { parseExtraVariablesTag } from "@/lib/program-builder-v2/extraVariablesNotes";

export type CardioField = "distance" | "duration";

export interface CardioPrescription {
  fields: CardioField[];
  count: number;
  distancePerSet?: number;
  durationPerSet?: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function parseJson(v: unknown): any {
  if (!v) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(String(v)); } catch { return null; }
}

/** Returns a cardio prescription when the exercise is prescribed in distance/duration, else null. */
export function getCardioPrescription(ex: any): CardioPrescription | null {
  if (!ex) return null;
  const sets = Math.max(1, Number(ex.sets) || 1);

  // Intermittent cardio (e.g. 10 × 200 m)
  let inter = parseJson(ex.intermittent_config);
  if (!inter && typeof ex.notes === "string") {
    const m = ex.notes.match(/<!--\s*v2-intermittent:(.*?)-->/s);
    if (m) inter = parseJson(m[1]);
  }
  if (inter && (inter.effortMode === "distance" || inter.effortMode === "duration")) {
    const count = Math.max(1, (Number(inter.repetitions) || 1) * (Number(inter.series) || 1));
    if (inter.effortMode === "distance") {
      return { fields: ["distance"], count, distancePerSet: num(inter.effortDistanceMeters) || undefined };
    }
    return { fields: ["duration"], count, durationPerSet: num(inter.effortDurationSeconds) || undefined };
  }

  // Fartlek: total time + distance covered
  const method = String(ex.method || ex.set_type || "");
  const fartlekInNotes = typeof ex.notes === "string" && ex.notes.includes("v2-fartlek:");
  if (method === "fartlek" || ex.fartlek_config || fartlekInNotes) {
    const cfg = parseJson(ex.fartlek_config);
    const minutes = num(cfg?.totalDurationMinutes);
    return { fields: ["distance", "duration"], count: 1, durationPerSet: minutes ? minutes * 60 : undefined };
  }

  // Cardio machines / locomotion variables
  const values = parseExtraVariablesTag(ex.notes)?.values ?? {};
  const distance = num(values.distanceMeters) || num(values.runDistanceMeters);
  const duration = num(values.durationSeconds) || num(values.runDurationSeconds);
  if (distance || duration) {
    const fields: CardioField[] = [];
    if (distance) fields.push("distance");
    if (duration) fields.push("duration");
    return {
      fields,
      count: sets,
      distancePerSet: distance || undefined,
      durationPerSet: duration || undefined,
    };
  }
  return null;
}

/** "45", "45:30", "1:02:00" → seconds. A bare number is read as minutes. */
export function parseDurationInput(v: string | undefined): number {
  if (!v) return 0;
  const s = v.trim().replace(",", ".");
  if (!s) return 0;
  if (s.includes(":")) {
    const parts = s.split(":").map((p) => Number(p) || 0);
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : 0;
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function formatDistance(m: number): string {
  return m >= 1000 && m % 100 === 0 ? `${(m / 1000).toLocaleString("fr-FR")} km` : `${Math.round(m)} m`;
}

// ---- Hidden notes tag ----
export interface CardioLogPayload {
  fields: CardioField[];
  series: Array<{ m?: number; s?: number }>;
}

export const CARDIO_TAG_REGEX = /\s*<!--\s*v2-cardio:(.*?)-->/s;

export function encodeCardioTag(payload: CardioLogPayload): string {
  return `<!--v2-cardio:${JSON.stringify(payload)}-->`;
}

export function parseCardioTag(notes?: string | null): CardioLogPayload | null {
  if (!notes) return null;
  const m = notes.match(CARDIO_TAG_REGEX);
  if (!m) return null;
  try {
    const p = JSON.parse(m[1]);
    return p && Array.isArray(p.series) ? p : null;
  } catch { return null; }
}

export function stripCardioTag(notes: string): string {
  return notes.replace(CARDIO_TAG_REGEX, "").trim();
}

/** Short human summary, e.g. "3 × 1000 m · 12:30". */
export function formatCardioSummary(p: CardioLogPayload): string {
  const valid = p.series.filter((s) => (s.m ?? 0) > 0 || (s.s ?? 0) > 0);
  if (valid.length === 0) return "–";
  const parts: string[] = [];
  if (p.fields.includes("distance")) {
    const ds = valid.map((s) => s.m ?? 0);
    const same = ds.every((d) => d === ds[0]);
    parts.push(valid.length > 1 && same ? `${valid.length} × ${formatDistance(ds[0])}` : formatDistance(ds.reduce((a, b) => a + b, 0)));
  }
  if (p.fields.includes("duration")) {
    const total = valid.reduce((a, s) => a + (s.s ?? 0), 0);
    if (total > 0) parts.push(p.fields.length === 1 && valid.length > 1 ? `${valid.length} séries · ${formatDuration(total)}` : formatDuration(total));
  }
  return parts.join(" · ");
}
