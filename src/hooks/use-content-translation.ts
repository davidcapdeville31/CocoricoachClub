import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getCachedTranslation,
  loadContentTranslations,
} from "@/lib/i18n/contentTranslation";

/**
 * Displays user-entered content in the active interface language.
 *
 * Pass the strings shown on screen so they can be preloaded in one query, then
 * render with `tc(text)`. Anything without a stored translation falls back to
 * the original text, so nothing ever disappears.
 *
 * @example
 * const { tc } = useContentTranslation(exercises.map((e) => e.name));
 * return <span>{tc(exercise.name)}</span>;
 */
export function useContentTranslation(texts?: (string | null | undefined)[]) {
  const { language } = useLanguage();
  const [version, setVersion] = useState(0);

  // Stable dependency for the batch of texts to preload.
  const signature = useMemo(
    () =>
      (texts ?? [])
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim())
        .sort()
        .join("\u0000"),
    [texts],
  );

  useEffect(() => {
    if (language === "fr" || !signature) return;
    let cancelled = false;
    (async () => {
      await loadContentTranslations(signature.split("\u0000"), language);
      if (!cancelled) setVersion((v) => v + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [signature, language]);

  const tc = useCallback(
    (text: string | null | undefined): string => {
      if (!text) return text ?? "";
      if (language === "fr") return text;
      return getCachedTranslation(text, language) ?? text;
      // `version` forces a re-render once translations land.
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, version],
  );

  return { tc, language };
}
