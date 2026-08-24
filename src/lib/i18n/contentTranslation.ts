// Automatic translation of user-entered content (free text saved by staff or
// athletes: exercise names, session themes, notes, objectives...).
//
// Strategy chosen with the user: translate AT SAVE TIME. When a record is
// created or updated we push its free-text fields to the `translate-content`
// edge function, which stores FR + EN in the `content_translations` cache.
// Reading is then instant and free: `useContentTranslation()` swaps the strings
// as soon as the interface language changes.
import { supabase } from "@/integrations/supabase/client";
import type { AppLanguage } from "@/i18n";

export const CONTENT_LANGUAGES: AppLanguage[] = ["fr", "en"];

/** In-memory cache: `${targetLang}::${text}` -> translation. */
const memoryCache = new Map<string, string>();
/** Texts we already know have no translation, to avoid refetch storms. */
const missCache = new Set<string>();

const cacheKey = (lang: AppLanguage, text: string) => `${lang}::${text}`;

export async function hashText(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sanitize(texts: (string | null | undefined)[]): string[] {
  return Array.from(
    new Set(
      texts
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 2000)
        // Pure numbers / codes never need translating.
        .filter((t) => /\p{L}{2,}/u.test(t)),
    ),
  );
}

/**
 * Call this right after saving user content. Fire-and-forget: it never throws
 * and never blocks the save flow.
 *
 * @example
 * await supabase.from("exercise_library").insert(row);
 * void translateOnSave([row.name, row.description]);
 */
export async function translateOnSave(
  texts: (string | null | undefined)[],
  sourceLang: AppLanguage = "fr",
): Promise<void> {
  const clean = sanitize(texts);
  if (clean.length === 0) return;

  const targets = CONTENT_LANGUAGES.filter((l) => l !== sourceLang);

  await Promise.all(
    targets.map(async (targetLang) => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "translate-content",
          { body: { texts: clean, sourceLang, targetLang } },
        );
        if (error) throw error;
        const map = (data as { translations?: Record<string, string> })
          ?.translations;
        if (!map) return;
        for (const [source, translated] of Object.entries(map)) {
          memoryCache.set(cacheKey(targetLang, source), translated);
          missCache.delete(cacheKey(targetLang, source));
        }
      } catch (e) {
        // Translation is a non-blocking enhancement: log and move on.
        console.warn("[contentTranslation] save-time translation failed", e);
      }
    }),
  );
}

/** Synchronous lookup used by the render path. */
export function getCachedTranslation(
  text: string | null | undefined,
  targetLang: AppLanguage,
): string | null {
  if (!text) return null;
  return memoryCache.get(cacheKey(targetLang, text.trim())) ?? null;
}

/**
 * Loads translations for a batch of texts from the cache table (cheap read,
 * no AI call). Unknown texts stay untranslated.
 */
export async function loadContentTranslations(
  texts: (string | null | undefined)[],
  targetLang: AppLanguage,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const clean = sanitize(texts);
  const pending: string[] = [];

  for (const text of clean) {
    const hit = memoryCache.get(cacheKey(targetLang, text));
    if (hit) result.set(text, hit);
    else if (!missCache.has(cacheKey(targetLang, text))) pending.push(text);
  }

  if (pending.length === 0) return result;

  try {
    const hashes = await Promise.all(pending.map(hashText));
    const hashToText = new Map<string, string>();
    hashes.forEach((h, i) => hashToText.set(h, pending[i]));

    // Fetch in chunks to keep the URL length sane.
    const CHUNK = 150;
    for (let i = 0; i < hashes.length; i += CHUNK) {
      const slice = hashes.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("content_translations")
        .select("source_hash, translated_text")
        .eq("target_lang", targetLang)
        .in("source_hash", slice);
      if (error) throw error;
      for (const row of data ?? []) {
        const source = hashToText.get(row.source_hash);
        if (!source) continue;
        memoryCache.set(cacheKey(targetLang, source), row.translated_text);
        result.set(source, row.translated_text);
      }
    }

    for (const text of pending) {
      if (!result.has(text)) missCache.add(cacheKey(targetLang, text));
    }
  } catch (e) {
    console.warn("[contentTranslation] cache read failed", e);
  }

  return result;
}

/** Clears the local caches (useful after a bulk re-translation). */
export function resetContentTranslationCache() {
  memoryCache.clear();
  missCache.clear();
}
