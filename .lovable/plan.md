## Objectif

Aligner les exports des sports collectifs (rugby, foot, hand, volley, basket) sur la qualité visuelle et le format du PDF bowling (`bowling_equipe_2026-05-16.pdf`) — header club brandé, photo athlète, palmarès, blocs stats colorés par catégorie, cartographies, footer pro — **et** ajouter les boutons "Excel" + "Exporter en PDF" (joueur/équipe) directement sur chaque carte match (`MatchCard.tsx`).

---

## 1. Nouveau module d'export unifié sports collectifs

Créer `src/lib/teamSports/teamSportsPdfExport.ts` inspiré de `src/lib/bowling/bowlingPdfExport.ts` (1507 lignes) :

- `exportTeamSportPlayerPdf(playerName, stats, options)` — bilan joueur unique
- `exportTeamSportTeamPdf(players[], options)` — bilan équipe (un bloc par joueur)

### Structure de chaque page (style bowling)
1. **Header club** : bandeau dégradé brand, logo/nom club, nom équipe, date compétition, adversaire & score, lieu, catégorie d'âge, compétition
2. **Bloc athlète** : photo ronde, nom, poste, n° licence, médailles/palmarès (récup `player_medals` comme bowling)
3. **Stats clés** : 4 KPI cards en haut (essais, plaquages, mètres, % réussite…) avec couleurs sémantiques selon seuils
4. **Stats détaillées par catégorie** : tables groupées (Attaque / Défense / Conquête / Discipline / Jeu au pied pour rugby) avec couleurs vert/orange/rouge selon référentiel
5. **Cartographie** : mini-pitch SVG avec essais marqués / tirs au but (rugby) ou heatmap actions (autres sports) — réutiliser le SVG existant
6. **Footer** : "CocoriCoach Club" + page X/Y + date génération

### Adaptation multi-sport
Helper `getSportStatGroups(sportType)` qui renvoie la liste des catégories à afficher selon le sport :
- Rugby : Attaque, Défense, Conquête, Discipline, Jeu au pied
- Football : Attaque, Défense, Passes, Discipline, Gardien (si applicable)
- Hand : Tirs, Défense, Passes, 7m, Discipline
- Volley : Attaque, Réception, Service, Bloc, Défense
- Basket : Tirs, Rebonds, Passes, Défense, Fautes

Réutiliser `SPORT_STAT_CATEGORIES` existant si déjà défini.

---

## 2. Excel branded sport collectif

Étendre `src/lib/excelExport.ts` (déjà utilisé par bowling) :
- 1 onglet "Équipe" + 1 onglet par catégorie de stats
- Header brandé (club logo + couleurs), zebra rows, footer
- Colorisation cellules selon seuils (vert/orange/rouge)
- Fonctions : `buildTeamSportExcelTeam(...)`, `buildTeamSportExcelPlayer(...)`

---

## 3. Remplacement dans `PlayerCumulativeStats.tsx`

Les fonctions `handleExportPdf` (lignes 710-1700, ~1000 lignes) et `handleExportExcel` (lignes 557-708) seront **remplacées par des wrappers** qui appellent les nouveaux modules unifiés. On garde l'API publique inchangée (mêmes signatures `mode: "all" | "team" | "individual" | "single"`) pour ne pas casser l'UI.

---

## 4. Boutons d'export sur `MatchCard.tsx`

Dans `src/components/category/matches/MatchCard.tsx`, ajouter dans le footer de la carte (à côté du bouton "Composition" ou près de "Préparer le match") :
- Bouton **Excel** (icône `FileSpreadsheet`)
- Bouton **Exporter en PDF** avec dropdown :
  - Exporter pour le joueur (sous-menu listant les joueurs du match)
  - Exporter pour l'équipe

Conditions d'affichage : `isTeamSport && match.is_finalized && !isBowling` (le bowling a son propre bouton dans la card bowling).

Les boutons reçoivent `matchId` et appellent les helpers unifiés avec `initialMatchIds: [matchId]` — réutilisation directe du flux existant via un dialog modal ou export direct.

---

## 5. Périmètre techique

- **Aucun changement DB** : on lit les tables existantes (`player_match_stats`, `matches`, `categories`, `players_safe`, `player_medals`, `match_kicking_positions`, `match_try_positions`)
- **Aucun changement RLS**
- **Pas de nouvelle dépendance** : `jspdf` + `jspdf-autotable` + `exceljs` déjà installés (utilisés par bowling)

---

## 6. Détails techniques

| Fichier | Action |
|---|---|
| `src/lib/teamSports/teamSportsPdfExport.ts` | Nouveau — copie adaptée de `bowlingPdfExport.ts` |
| `src/lib/teamSports/teamSportsExcelExport.ts` | Nouveau — extraction des helpers Excel actuels |
| `src/lib/teamSports/statGroupsBySport.ts` | Nouveau — mapping sport → catégories de stats |
| `src/lib/teamSports/pitchMapRenderer.ts` | Nouveau — rend mini-pitch SVG en image pour PDF (rugby/foot) |
| `src/components/category/matches/PlayerCumulativeStats.tsx` | Refacto : `handleExportPdf` & `handleExportExcel` deviennent des wrappers |
| `src/components/category/matches/MatchCard.tsx` | Ajout des 2 boutons + dropdown |
| `src/components/category/matches/MatchExportButtons.tsx` | Nouveau composant réutilisable pour les boutons (utilisé dans MatchCard) |

---

## 7. QA

- Tester export Joueur + Équipe sur 1 match rugby finalisé (catégorie active)
- Vérifier ouverture du PDF + visuel cohérent avec bowling
- Tester export depuis MatchCard ET depuis page Datas → résultat identique
- Tester sur foot/hand/volley/basket (au moins ouverture PDF sans erreur, catégories de stats adaptées)

---

## Hors scope (peut être fait après)

- Sports individuels (tennis, padel, athlétisme, ski…) — formats déjà spécifiques, à traiter séparément si demandé
- Modification des templates Excel existants (on les remplace en bloc par le nouveau format unifié)
- Bowling reste sur son module dédié (pas touché)
