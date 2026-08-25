import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { fr } from "./locales/fr";
import { en } from "./locales/en";
import { decisionFr, decisionEn } from "./locales/modules/decision";
import { planningFr, planningEn } from "./locales/modules/planning";
import { workloadFr, workloadEn } from "./locales/modules/workload";
import { athleteSpaceFr, athleteSpaceEn } from "./locales/modules/athleteSpace";
import { healthFr, healthEn } from "./locales/modules/health";
import { adminFr, adminEn } from "./locales/modules/admin";
import { academyFr, academyEn } from "./locales/modules/academy";
import { rosterFr, rosterEn } from "./locales/modules/roster";
import { adminAttendanceFr, adminAttendanceEn } from "./locales/modules/adminAttendance";
import { adminRecruitDocsFr, adminRecruitDocsEn } from "./locales/modules/adminRecruitDocs";
import { adminReportsFr, adminReportsEn } from "./locales/modules/adminReports";
import { adminStaffFr, adminStaffEn } from "./locales/modules/adminStaff";
import { programmationFr, programmationEn } from "./locales/modules/programmation";
import { competitionFr, competitionEn } from "./locales/modules/competition";

const frResources = {
  ...fr,
  decision: decisionFr,
  planning: planningFr,
  workload: workloadFr,
  athleteSpace: athleteSpaceFr,
  health: healthFr,
  ...adminFr,
  ...academyFr,
  roster: rosterFr,
  adminAttendance: adminAttendanceFr,
  ...adminRecruitDocsFr,
  ...adminReportsFr,
  ...adminStaffFr,
  ...programmationFr,
  ...competitionFr,
};

const enResources = {
  ...en,
  decision: decisionEn,
  planning: planningEn,
  workload: workloadEn,
  athleteSpace: athleteSpaceEn,
  health: healthEn,
  ...adminEn,
  ...academyEn,
  roster: rosterEn,
  adminAttendance: adminAttendanceEn,
  ...adminRecruitDocsEn,
  ...adminReportsEn,
  ...adminStaffEn,
  ...programmationEn,
  ...competitionEn,
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
    fr: { translation: frResources },
    en: { translation: enResources },
  },

  lng: getStoredLanguage(),
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
