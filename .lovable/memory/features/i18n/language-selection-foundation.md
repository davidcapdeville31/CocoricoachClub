---
name: Language Selection Foundation
description: i18n FR/EN via react-i18next, language switcher in category header, default language persisted in profiles.language + localStorage
type: feature
---

- Moteur : `i18next` + `react-i18next`, init dans `src/i18n/index.ts`, ressources dans `src/i18n/locales/{fr,en}.ts` (namespaces `common`, `language`, `header`, `nav`).
- `LanguageProvider` (`src/contexts/LanguageContext.tsx`) monté dans `App.tsx` sous `AuthProvider` : applique la langue stockée au montage, puis la langue par défaut du compte à la connexion.
- Persistance : bouton **« Langue par défaut »** → écrit `profiles.language` ('fr' | 'en') + `localStorage` (`app-language`, `app-language-default`). La langue choisie reste après déconnexion/reconnexion et suit l'utilisateur sur tous ses appareils.
- UI : `LanguageSwitcher` (icône Globe) dans le header de catégorie, à côté de Paramètres/Déconnexion.
- Traduction progressive : header + onglets de navigation de catégorie faits en premier (validé sur M14 rugby). Étendre en réutilisant `useTranslation()` et en ajoutant les clés dans les deux fichiers de locales.
