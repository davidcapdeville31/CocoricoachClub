import { fr, enUS } from "date-fns/locale";
import i18n from "@/i18n";

/**
 * Returns the date-fns locale matching the current app language.
 * Falls back to French (app default).
 */
export function getDateLocale() {
  return i18n.language?.startsWith("en") ? enUS : fr;
}

/** BCP47 tag matching the current app language, for Intl / toLocale* APIs. */
export function getLocaleTag() {
  return i18n.language?.startsWith("en") ? "en-GB" : "fr-FR";
}
