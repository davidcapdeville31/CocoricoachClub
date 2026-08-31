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
    .replace(/<!--MENTAL:[\s\S]*?-->/g, "")
    .replace(/\n?<!--TESTS:.*?-->/g, "")
    .replace(/\n?<!--TESTWINDOW:.*?-->/g, "")

    .replace(/\n?<!--PRECISION_EXERCISE:.*?-->/g, "")
    .replace(/\n?\[precision_exercise:.*?\]/g, "")
    .replace(/^\s*\[Séance athlète\]\s*/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Returns the user-entered session title stored as the first visible line
 * of the notes (used by mental sessions and other titled event types).
 * Returns null when no meaningful title is present.
 */
export function getSessionTitleFromNotes(notes: string | null | undefined): string | null {
  const display = getDisplayNotes(notes);
  if (!display) return null;
  const firstLine = display.split("\n")[0]?.trim();
  return firstLine || null;
}


export function parseMentalFromNotes(
  notes: string | null | undefined,
): { duration_min?: number; theme?: string } | null {
  if (!notes) return null;
  const m = notes.match(/<!--MENTAL:(\{[\s\S]*?\})-->/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]);
    return {
      duration_min: typeof parsed?.duration_min === "number" ? parsed.duration_min : undefined,
      theme: typeof parsed?.theme === "string" ? parsed.theme : undefined,
    };
  } catch {
    return null;
  }
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

export interface TestWindow {
  start: string; // yyyy-MM-dd
  end: string; // yyyy-MM-dd
}

/**
 * Parses the optional test campaign window (<!--TESTWINDOW:{"start":"...","end":"..."}-->).
 * When present, an athlete may only submit each test once inside that date range,
 * even if the same test is planned on several sessions of the period.
 */
export function parseTestWindowFromNotes(notes: string | null | undefined): TestWindow | null {
  if (!notes) return null;
  const m = notes.match(/<!--TESTWINDOW:(.*?)-->/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]);
    const start = typeof parsed?.start === "string" ? parsed.start : null;
    const end = typeof parsed?.end === "string" ? parsed.end : null;
    if (!start || !end) return null;
    return start <= end ? { start, end } : { start: end, end: start };
  } catch {
    return null;
  }
}

export function buildTestWindowMeta(start?: string | null, end?: string | null): string {
  if (!start || !end) return "";
  return `\n<!--TESTWINDOW:${JSON.stringify({ start, end })}-->`;
}

export function isSimplifiedSession(notes: string | null | undefined): boolean {
  return !!notes && /<!--\s*SIMPLIFIED_SESSION\s*-->/.test(notes);
}
