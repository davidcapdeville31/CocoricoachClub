// Extract method-specific configs (Fartlek, Cluster, Stato, Intermittent,
// Drop Set, Rest-Pause, Pyramides, 5x5, Iso, AMRAP, EMOM, Tabata, Death By,
// For Time, Circuit) that were serialized inside `notes` as
// `<!--v2-<method>:{...}-->` tags by the V2 session/program builder.
//
// Used by read-only previews (SessionDetailsDialog calendar, GroupedExerciseList
// in athlete space, etc.) so the athlete sees the EXACT same configuration the
// coach built (colors, séries détaillées, kmh, bpm, phases, etc.).

const TAGS = [
  "fartlek",
  "cluster",
  "stato",
  "intermittent",
  "drop_set",
  "rest_pause",
  "pyramid_up",
  "pyramid_down",
  "pyramid_full",
  "five_by_five",
  "isometric_overcoming",
  "isometric_yielding",
  "amrap",
  "for_time",
  "death_by",
  "circuit",
  "tabata",
  "emom",
] as const;
export type V2MethodKind = typeof TAGS[number];

export interface ParsedV2MethodConfig {
  kind: V2MethodKind;
  config: any;
}

export function parseV2MethodConfig(notes?: string | null): ParsedV2MethodConfig | null {
  if (!notes) return null;
  for (const kind of TAGS) {
    // Escape the `_` etc. — they're literals, fine in regex but be safe.
    const re = new RegExp(`<!--\\s*v2-${kind}:([\\s\\S]*?)-->`, "i");
    const m = notes.match(re);
    if (m?.[1]) {
      try {
        return { kind, config: JSON.parse(m[1].trim()) };
      } catch {
        // ignore malformed payload
      }
    }
  }
  return null;
}

export function stripV2MethodTags(notes?: string | null): string {
  if (!notes) return "";
  let result = notes;
  for (const kind of TAGS) {
    const re = new RegExp(`<!--\\s*v2-${kind}:[\\s\\S]*?-->`, "gi");
    result = result.replace(re, "");
  }
  return result.trim();
}

// Map a parsed v2 method kind to the `method` field expected by ValidatedMethodCard.
export function v2KindToMethod(kind: V2MethodKind): string {
  if (kind === "stato") return "stato_dynamique";
  if (kind === "intermittent") return "intermittent_cardio";
  return kind;
}
