
# Bowling — Création de séance & 9 exercices DTN

## Objectif

Aligner la création de séance terrain bowling sur la méthodologie FFBSQ : 3 grandes catégories (Technique, Tactique, Parties), 9 exercices avec leurs variables, et alimentation automatique des stats d'entraînement de l'athlète.

## 1. Refonte des catégories bowling (3 au lieu de 6)

Aujourd'hui le menu propose 6 types bowling mélangés. On garde 3 types parents et on regroupe :

- **bowling_technique** — Travail Technique
  - Sous-thèmes : Travail d'Approche · Travail de Lâcher · Travail des Spares · Vitesse / Axes / Rotations / Profondeur de pose · Poche du Strike (régularité 1 boule)
- **bowling_tactique** — Travail Tactique
  - Sous-thèmes : Poches/Strikes entre les flèches · Poches/Strikes zone flèche · Poches/Strikes placement déterminé · Lignes de jeu · Points à réaliser · Le Strike (modification lignes de jeu)
- **bowling_parties** — Parties d'Entraînement
  - Sous-thèmes : Doublés/Triplés · Situation de jeu (4/6/8 parties) · Parties boule polyester

Renommage / consolidation côté `trainingTypes.ts`, `AddSessionTemplateDialog`, `SessionTemplateCard`, `SessionDetailsDialog`, `AthleteCreateSession`. Migration douce : les anciens `bowling_spare`, `bowling_practice`, `bowling_approche`, `bowling_release` sont mappés vers le bon parent pour l'affichage (rétro-compatibilité).

## 2. Catalogue des 9 exercices DTN

Nouveau fichier `src/lib/constants/bowlingExercises.ts` listant les 9 exercices du PDF avec leur catégorie parent, leurs variables et l'objectif/critère de réussite :

| # | Exercice | Parent | Variables principales |
|---|----------|--------|----|
| 1 | Poches & Strikes | Tactique | nb lancers, boule(s), huilage, paramètre perf |
| 2 | Poches & Strikes entre les flèches | Tactique | nb lancers/zone, boule(s), huilage, paramètre perf |
| 3 | Poches & Strikes "zone flèche" (F1→F6) | Tactique | nb lancers/flèche, boule(s), huilage, paramètre perf |
| 4 | Placement déterminé (5/15/25/35e latte) | Tactique | nb lancers/placement, boule(s), huilage, paramètre perf |
| 5 | Doublés / Triplés | Parties | nb lancers, boule(s), huilage, paramètre perf |
| 6 | Points à réaliser (5/3/1) | Tactique | objectif points, boule(s), huilage, zones, paramètre perf |
| 7 | Vitesse / Axes / Rotations / Profondeur | Technique | nb lancers série, consécutifs ou alternés, paramètre choisi |
| 8 | Lignes de jeu | Tactique | lignes (parallèle/angulaire), nb lancers/ligne, huilage |
| 9 | Les Spares | Technique | quille/spare ciblé, nb répétitions, % perso de réussite |

Chaque exercice expose son schéma de variables (`fields: [{key, label, type, options?, required?}]`) pour générer dynamiquement le formulaire. Les "Parties" peuvent désactiver le champ huilage (comme demandé).

## 3. UI — Création de séance terrain (cas bowling)

Quand le sport de la catégorie est bowling, le `FieldSessionDialog` / `BowlingBlockManager` :

1. Le sélecteur de bloc liste uniquement **Technique / Tactique / Parties**.
2. Sous le type, un second sélecteur "Exercice DTN" filtre les 9 exercices appartenant au parent choisi.
3. Une zone "Variables" se génère selon le schéma de l'exercice : nb lancers, boule (depuis arsenal joueur via `BowlingBallSelector`), huilage (depuis `bowling_oil_patterns` ou désactivé), paramètres de performance (vitesse / axe / rotation / profondeur de pose), zones/flèches/placements.
4. L'objectif et le critère de réussite s'affichent en encart info pour le coach.
5. Durée et RPE attendu restent saisis comme aujourd'hui.

## 4. Persistance & remontée stats

- Le bloc est stocké dans `training_session_blocks` avec `training_type ∈ {bowling_technique, bowling_tactique, bowling_parties}` + `notes` enrichi (commentaire HTML caché `<!-- bowling-exercise: {id, variables} -->`, comme le pattern Session Metadata Notes déjà utilisé).
- À la validation par un athlète, une ligne est créée dans `bowling_spare_training` (table déjà reliée à `training_session_id`, `ball_arsenal_id`, `player_id`, `category_id`) avec `exercise_type` = id de l'exercice DTN, `attempts` = nb lancers, `successes` = réussites saisies → le trigger existant calcule `success_rate`.
- Pour les exercices "Parties", on continue d'utiliser les tables jeux/parties existantes (BowlingGameHistory).
- Les composants `BowlingTrainingStats`, `BowlingCumulativeStats`, `BowlingFrameAnalysis` voient déjà ces lignes : les nouvelles séances apparaissent automatiquement dans les stats d'entraînement de l'athlète, filtrables par exercice DTN.

## 5. Détails techniques

```text
src/lib/constants/
  bowlingExercises.ts     (NEW — catalogue 9 exercices + schéma variables)
  trainingTypes.ts        (consolidation 6→3 + labels rétro-compatibles)
src/components/bowling/
  BowlingBlockManager.tsx (sélecteur exercice + variables dynamiques)
  BowlingExerciseVariables.tsx (NEW — form génératif basé sur le schéma)
src/components/category/
  SessionDetailsDialog.tsx (labels)
  calendar/FieldSessionDialog.tsx (passe sport=bowling au BlockManager)
src/components/planning/
  AddSessionTemplateDialog.tsx, SessionTemplateCard.tsx (3 options)
src/components/athlete-portal/
  AthleteCreateSession.tsx (3 options + sélecteur exercice)
```

Pas de migration SQL : la table `bowling_spare_training` couvre déjà les besoins (exercise_type est `text`, ball_arsenal_id, attempts/successes, link session). On étend juste les valeurs possibles de `exercise_type` (`dtn_ex1` … `dtn_ex9`).

## Hors scope

- Pas de modification des autres sports (changement spécifique bowling, conformément à la règle "Compétitions et Datas spécifiques par sport").
- Pas de refonte des graphiques bowling : ils consomment déjà `bowling_spare_training`.
