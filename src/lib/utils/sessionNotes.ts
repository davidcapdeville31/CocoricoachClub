/**
 * Strips hidden test metadata (<!--TESTS:...-->) from session notes
 * and returns only the user-visible portion.
 */
export function getDisplayNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  return notes
    .replace(/<!--v2-meta:.*?-->/g, "")
    .replace(/<!--\s*v2-block:[^>]+-->/g, "")
    .replace(/<!--\s*v2-test:[^>]+-->/g, "")
    .replace(/<!--BLOCK:.*?-->/g, "")
    .replace(/\n?<!--TESTS:.*?-->/g, "")
    .replace(/\n?<!--PRECISION_EXERCISE:.*?-->/g, "")
    .replace(/\n?\[precision_exercise:.*?\]/g, "")
    .trim();
}

export function parseV2Meta(notes: string | null | undefined): {
  v2: boolean;
  dayName?: string | null;
  dayOfWeek?: string | null;
  weekNumber?: number | null;
} | null {
  if (!notes) return null;
  const match = notes.match(/<!--v2-meta:(.*?)-->/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return {
      v2: true,
      dayName: typeof parsed?.dayName === "string" ? parsed.dayName : null,
      dayOfWeek: typeof parsed?.dayOfWeek === "string" ? parsed.dayOfWeek : null,
      weekNumber: typeof parsed?.weekNumber === "number" ? parsed.weekNumber : null,
    };
  } catch {
    return { v2: true };
  }
}

export function parseV2BlockTag(notes: string | null | undefined): { type: string; name: string } | null {
  if (!notes) return null;
  const m = notes.match(/<!--\s*v2-block:([^:]+):([^>]+?)\s*-->/);
  if (!m) return null;
  return { type: (m[1] || "").trim(), name: (m[2] || "").trim() };
}

/**
 * Parses test config from session notes metadata.
 */
export function parseTestsFromNotes(notes: string | null | undefined): Array<{ test_category: string; test_type: string; result_unit?: string }> {
  if (!notes) return [];
  const match = notes.match(/<!--TESTS:(.*?)-->/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

export function parsePrecisionExerciseFromNotes(notes: string | null | undefined): { id: string | null; label: string } | null {
  if (!notes) return null;

  // New format: <!--PRECISION_EXERCISE:{"id":"...","label":"..."}-->
  const match = notes.match(/<!--PRECISION_EXERCISE:(.*?)-->/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (!parsed || typeof parsed.label !== "string" || !parsed.label.trim()) {
        return null;
      }
      return {
        id: typeof parsed.id === "string" && parsed.id.trim() ? parsed.id : null,
        label: parsed.label.trim(),
      };
    } catch {
      return null;
    }
  }

  // Legacy format: [precision_exercise:category|label]
  const legacyMatch = notes.match(/\[precision_exercise:(.*?)\|(.*?)\]/);
  if (legacyMatch) {
    return {
      id: legacyMatch[1] || null,
      label: legacyMatch[2] || "Précision",
    };
  }

  return null;
}
