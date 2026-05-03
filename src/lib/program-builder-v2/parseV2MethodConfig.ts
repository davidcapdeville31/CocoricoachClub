// Extract method-specific configs (Fartlek, Cluster, Stato, Intermittent) that
// were serialized inside `notes` as `<!--v2-<method>:{...}-->` tags by the V2
// session/program builder. Used by read-only previews (SessionDetailsDialog,
// GroupedExerciseList in athlete space, etc.) so the athlete sees the EXACT
// same configuration the coach built (kmh, bpm, phases, etc.).

const TAGS = ["fartlek", "cluster", "stato", "intermittent"] as const;
export type V2MethodKind = typeof TAGS[number];

export interface ParsedV2MethodConfig {
  kind: V2MethodKind;
  config: any;
}

export function parseV2MethodConfig(notes?: string | null): ParsedV2MethodConfig | null {
  if (!notes) return null;
  for (const kind of TAGS) {
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
  return notes
    .replace(/<!--\s*v2-fartlek:[\s\S]*?-->/gi, "")
    .replace(/<!--\s*v2-cluster:[\s\S]*?-->/gi, "")
    .replace(/<!--\s*v2-stato:[\s\S]*?-->/gi, "")
    .replace(/<!--\s*v2-intermittent:[\s\S]*?-->/gi, "")
    .trim();
}
