import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { fr } from "./locales/fr";
import { en } from "./locales/en";
import { decisionFr, decisionEn } from "./locales/modules/decision";
import { planningFr, planningEn } from "./locales/modules/planning";
import { workloadFr, workloadEn } from "./locales/modules/workload";
import { athleteSpaceFr, athleteSpaceEn } from "./locales/modules/athleteSpace";
import { healthFr, healthEn } from "./locales/modules/health";

const frResources = {
  ...fr,
  decision: decisionFr,
  planning: planningFr,
  workload: workloadFr,
  athleteSpace: athleteSpaceFr,
  health: healthFr,
};

const enResources = {
  ...en,
  decision: decisionEn,
  planning: planningEn,
  workload: workloadEn,
  athleteSpace: athleteSpaceEn,
  health: healthEn,
};


export type AppLanguage = "fr" | "en";
export const APP_LANGUAGES: AppLanguage[] = ["fr", "en"];
export const LANGUAGE_STORAGE_KEY = "app-language";

export function getStoredLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    // localStorage unavailable
  }
  return "fr";
}

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: getStoredLanguage(),
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
