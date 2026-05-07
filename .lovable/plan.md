## Objectif

Ajouter un sous-menu "Profil adversaire" pour le judo, permettre de sélectionner un adversaire enregistré lors de la saisie d'un combat (filtré par sexe + catégorie de poids), et afficher des statistiques de victoires/défaites par profil d'adversaire (gauchers/droitiers, etc.).

## 1. Base de données

Nouvelle table `opponent_profiles` :
- `id, club_id, category_id` (rattachée à la catégorie judo)
- `last_name, first_name`
- `gender` ('male' / 'female')
- `weight_category` (clé judo, ex. `judo_-63kg`)
- `handedness` ('left' / 'right' / 'unknown')
- `club_origin, country, birth_year, notes` (détails supplémentaires utiles)
- `created_at, updated_at` + RLS (mêmes règles que `players` : staff du club uniquement)

Ajout sur `competition_rounds` :
- `opponent_profile_id uuid` (FK vers `opponent_profiles`, ON DELETE SET NULL)
- `result` reste libre, mais sera interprété (V / D / N) pour les stats

## 2. UI — Sous-onglet "Profil adversaire" (judo uniquement)

`CompetitionTab.tsx` : ajouter un onglet `opponents` (icône Users) visible si `sportType` est judo.
Nouveau composant `JudoOpponentsTab.tsx` :
- Liste des adversaires enregistrés (table avec recherche, filtre par sexe / catégorie de poids)
- Bouton "Ajouter adversaire" → dialog `OpponentProfileDialog.tsx` (création / édition)
- Suppression confirmée

## 3. Sélection d'adversaire dans un combat

Dans `CompetitionRoundsDialog.tsx`, pour le judo :
- Remplacer l'`Input` "opponent_name" par un combo : `Select` des adversaires filtrés par `gender` + `weight_category` correspondant à l'athlète (via `players.gender` et `players.position`/`specialty` si poids défini ; fallback : tous les profils + recherche manuelle)
- Option "Saisir manuellement" qui garde le champ texte
- Quand un profil est choisi : on enregistre `opponent_profile_id` et on copie le nom dans `opponent_name`

## 4. Statistiques

Dans le dialog stats compétition (judo, agrégation au niveau athlète/club), nouveau bloc "Analyse adversaires" :
- % victoires / défaites global
- % victoires vs gauchers / droitiers
- % victoires par catégorie de poids rencontrée
Les victoires sont déduites du champ `result` (V/W/Victoire vs D/L/Défaite, normalisation simple).

## Détails techniques

- Migration : table + colonne + RLS + trigger updated_at.
- `OpponentProfileDialog` réutilise les options de `WEIGHT_CATEGORIES` judo de `sportTypes.ts`.
- Filtrage : on lit `players.gender` et un nouveau champ `weight_category` (déjà présent dans `position` ou `specialty` pour judo ? sinon on prend la catégorie côté formulaire). Pour rester simple : le formulaire de combat propose un filtre éditable (sexe + poids) pré-rempli depuis le profil athlète si disponible.
- Stats : helper `judoOpponentStats.ts` qui regroupe par `handedness`, `weight_category`, etc.

Fichiers créés :
- `supabase/migrations/...` (table + colonne)
- `src/components/category/judo/JudoOpponentsTab.tsx`
- `src/components/category/judo/OpponentProfileDialog.tsx`
- `src/lib/judo/opponentStats.ts`

Fichiers modifiés :
- `src/components/category/tabs/CompetitionTab.tsx`
- `src/components/category/matches/CompetitionRoundsDialog.tsx`
- `src/components/category/matches/MatchCard.tsx` (bloc stats agrégées judo)
