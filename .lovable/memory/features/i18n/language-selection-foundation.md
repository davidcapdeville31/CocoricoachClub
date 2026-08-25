---
name: Language Selection Foundation
description: i18n FR/EN via react-i18next, modular locale files, date-fns locale helper, language switcher in category header, default language in profiles.language + localStorage
type: feature
---

- Moteur : `i18next` + `react-i18next`, init dans `src/i18n/index.ts`. **Un seul namespace `translation`** : chaque module de locale est fusionné comme clé racine → toujours des clés en **points** (`t("admin.x.y")`), **jamais** la syntaxe `ns:key` (elle casse et renvoie la clé brute, ce qui provoque des crashs `.map is not a function` avec `returnObjects: true`).
- Fichiers : `src/i18n/locales/{fr,en}.ts` (common, language, header, nav, subnav) + modules `src/i18n/locales/modules/*.ts` : decision, planning, workload, athleteSpace, health, admin, adminAttendance, adminRecruitDocs, adminReports, adminStaff, academy, roster. Chaque module exporte `<nom>Fr` / `<nom>En` avec **structures de clés strictement identiques**, et doit être enregistré dans `src/i18n/index.ts`.
- Dates : `src/lib/i18n/dateLocale.ts` → `getDateLocale()` (date-fns) et `getLocaleTag()` (Intl / `toLocale*`). Ne plus importer `fr` de `date-fns/locale` ni coder `"fr-FR"` en dur.
- Persistance : bouton « Langue par défaut » → `profiles.language` ('fr' | 'en') + `localStorage` (`app-language`, `app-language-default`). `LanguageProvider` (`src/contexts/LanguageContext.tsx`) applique la langue au montage et à la connexion.
- Contenu saisi par l'utilisateur : traduit à l'enregistrement via `translateOnSave` / `tc()` (voir mémoire Content Auto-Translation), jamais via `t()`.
- Étendre : créer un module locale, l'enregistrer, puis brancher `useTranslation()` dans les composants (jamais de hook au niveau module : utiliser `import i18n from "@/i18n"` + `i18n.t`).
