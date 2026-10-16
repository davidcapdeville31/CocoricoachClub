---
name: Saisie des stats de match par l'athlète
description: Sports collectifs — l'athlète en composition saisit ses propres stats si la catégorie l'autorise
type: feature
---

# Saisie des stats de match par l'athlète (sports collectifs)

- Déclencheur : catégorie `athlete_competition_entry_enabled = true` + athlète présente dans `match_lineups` (composition) + jour du match atteint.
- Bouton « Mes stats » sur la carte compétition de l'espace athlète (sports collectifs uniquement, jamais judo ni sports individuels qui ont leur propre flux).
- Composant `AthleteMatchStats` : réutilise `useStatPreferences` + `getStatsForSport` + `groupStatsByTheme`, mêmes champs et pourcentages calculés que la saisie staff.
- L'athlète ne lit/modifie/supprime que sa propre ligne `player_match_stats` (policies RLS dédiées via `is_player_owner` + composition + flag catégorie). Les autres joueuses restent au staff.
- Si le bouton est décoché côté staff : l'athlète ne saisit que son RPE (AthleteMatchRpe), le temps de jeu et les stats restent côté staff.
- Export PDF personnel : cases à cocher sur les compétitions passées + bouton « Exporter mes stats » → `exportAthleteMatchStatsPdf` (jsPDF, logo club, stats groupées par catégorie, uniquement les propres lignes de l'athlète).
