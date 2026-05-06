## Objectif

Permettre à l'athlète bowling (et au staff) d'enregistrer une **session d'entraînement bowling** (parties + exercices de précision : quille 7/10, spares, poche) directement depuis le calendrier de l'Espace athlète, et de retrouver ces stats dans un sous-onglet **Datas d'entraînement**.

## 1. Calendrier Espace athlète — bouton dédié bowling

Fichier : `src/components/athlete-space/AthleteSpaceCalendar.tsx`

- À côté du bouton actuel **"+ Ajouter une séance"** (violet), afficher un nouveau bouton **"+ Ajouter un entraînement"** (couleur entraînement bleu) **uniquement si `sportType` contient "bowling"**.
- Ce bouton ouvre un nouveau dialog `BowlingTrainingEntryDialog` (créé ci-dessous), pré-rempli avec la date sélectionnée.
- Idem pour les boutons de fallback (zone "Aucun événement" et bouton bas de liste) : on duplique avec une variante bowling.

## 2. Nouveau composant `BowlingTrainingEntryDialog`

Fichier nouveau : `src/components/bowling/BowlingTrainingEntryDialog.tsx`

Dialog plein écran (`max-w-4xl h-[90vh]`) avec :

- En-tête : date de l'entraînement (sélecteur).
- 2 sous-onglets internes :
  - **Parties d'entraînement** → réutilise `BowlingScoreSheet` ; sauvegarde dans `matches` (event_type=`training`) + `competition_rounds` + `competition_round_stats` pour `playerId` courant.
  - **Précision (spares)** → réutilise `BowlingSpareTraining` (déjà fait pour quille 7 / quille 10 / spares / poche, avec champs "tentatives" / "réussites").
- Pas besoin de sélecteur de joueur : on est dans l'Espace athlète, le `playerId` est fixé.

Les écritures se font via un nouvel **Edge Function** `athlete-bowling-training` (analogue à `athlete-create-session`) :
- Vérifie JWT + accès via `players.user_id` ou `can_access_category` (staff).
- Vérifie l'appartenance du player à la catégorie (primary ou `player_categories`).
- Crée/réutilise le match d'entraînement du jour (`event_type='training'`).
- Insère un `competition_round` + `competition_round_stats` pour les parties.
- Insère les lignes `bowling_spare_training` pour la précision.

Cela contourne les RLS qui exigent staff access sur `matches` et `competition_rounds`.

Côté staff, on appelle directement Supabase (RLS OK).

## 3. Sous-onglet "Datas d'entraînement" côté athlète

Fichier : `src/pages/AthleteSpace.tsx` (lignes ~763-811)

- Pour `isBowling`, remplacer le `BowlingCumulativeStats` solo par un `Tabs` à 2 sous-onglets identiques au staff :
  - **Datas de compétition** → `BowlingCumulativeStats` (filtré sur `playerId`).
  - **Datas d'entraînement** → `BowlingTrainingStats` adapté pour un seul athlète (filtre `playerId` interne).
- `BowlingTrainingStats` doit accepter un prop optionnel `playerId` pour filtrer la liste des athlètes affichés.

## 4. Côté staff (déjà OK)

Le sous-onglet **Datas d'entraînement** existe déjà dans `src/components/category/tabs/DatasTab.tsx` pour bowling → `BowlingTrainingStats`. **Aucun changement**.

## Détails techniques

```text
AthleteSpaceCalendar
 ├── [+ Ajouter une séance]   → SessionEditorV2 (existant)
 └── [+ Ajouter un entraînement] (bowling only)
       └── BowlingTrainingEntryDialog
             ├── tab "Parties"     → BowlingScoreSheet + edge fn athlete-bowling-training
             └── tab "Précision"   → BowlingSpareTraining (idem)

AthleteSpace > tab "stats" (bowling)
 └── Tabs
     ├── "Datas de compétition" → BowlingCumulativeStats(playerId)
     └── "Datas d'entraînement" → BowlingTrainingStats(categoryId, playerId)
```

Edge function `supabase/functions/athlete-bowling-training/index.ts` :
- Inputs : `category_id`, `player_id`, `session_date`, `mode: "game"|"spare"`, payload spécifique.
- Sécurité JWT identique à `athlete-create-session`.
- Pas de modification de schéma DB ni de RLS.

## Hors scope

- Pas de toucher au flux Compétitions officielles (séparation training/compétition conservée — cf. mémoire "Match vs Training Coherence").
- Pas de modifications pour les autres sports.

Confirme et je l'implémente.