# Stats par défaut + override par match — plan

## Contexte trouvé dans le code

- Table `category_stat_preferences` (existe) : prefs au niveau catégorie.
- Table `match_stat_overrides` (existe déjà) : prefs au niveau match.
- Hook `useStatPreferences({ categoryId, sportType, matchId? })` (existe) : applique déjà la priorité **match > catégorie > tout**.
- `StatPreferencesDialog` : aujourd'hui sauvegarde uniquement en catégorie.
- Consommateurs de `useStatPreferences` : `SportMatchStatsDialog`, `CompetitionRoundsDialog`, `AggregatedRoundStatsDialog`, `PlayerCumulativeStats`, `PlayerMatchesTab`.
- ❌ `ManualRugbyStatsDialog` (saisie manuelle rugby) **n'utilise pas** `useStatPreferences` — ses colonnes sont en dur.
- ❌ `LiveMatchPage` (Démarrer temps réel) **n'utilise pas** non plus `useStatPreferences`.

## Travail à faire

### 1. Renommage UI
- Bouton dans `MatchesTab.tsx` (ligne 157) : "Personnaliser stats" → **"Modifier les stats par défaut"**.
- Titre dialog `StatPreferencesDialog` : "Personnaliser les statistiques" → **"Modifier les stats par défaut"** quand on est en mode catégorie.
- Quand le dialog est ouvert en mode **match override**, titre **"Personnaliser les statistiques pour ce match"** + sous-titre indiquant "Ces réglages remplacent ceux de la catégorie pour cette compétition uniquement."

### 2. Faire de `StatPreferencesDialog` un composant à 2 modes

Ajouter prop optionnelle `matchId?: string`.

- Si `matchId` **absent** → comportement actuel (sauvegarde dans `category_stat_preferences`).
- Si `matchId` **présent** :
  - Init des cases à cocher : lit `match_stat_overrides.enabled_stats` ; si null, prend les prefs catégorie comme point de départ (l'utilisateur part des défauts pour personnaliser).
  - Sauvegarde dans `match_stat_overrides` (upsert sur `match_id`).
  - Bouton supplémentaire **"Réinitialiser aux défauts catégorie"** qui supprime la ligne d'override.
- Invalidation queries : `["match-stat-overrides", matchId]` en plus.

### 3. Ajouter le bouton "Personnaliser pour ce match"

Dans `MatchCard.tsx`, sous le bouton "Démarrer (temps réel)" (ligne 661) :
- Nouveau bouton **"⚙️ Personnaliser les stats de ce match"** (variant outline, style discret).
- Ouvre `StatPreferencesDialog` avec `matchId` du match courant.
- Visible uniquement aux rôles autorisés (mêmes règles que "Démarrer temps réel").

### 4. Parité des stats — Saisie manuelle rugby

`ManualRugbyStatsDialog` doit cacher les colonnes désactivées dans les prefs.
- Brancher `useStatPreferences({ categoryId, sportType: "rugby", matchId })`.
- Map des `statKey` rugby → colonnes du tableau (essais, transformations, pénalités, drops, en-avants, plaquages, etc.).
- Si une colonne est désactivée → masquer l'entête + cellules + skip dans `buildEvents`.
- ⚠️ La logique de calcul du score reste inchangée : un essai désactivé n'est juste pas saisissable, mais le calcul score = essais×5 + transfo×2 + pén×3 + drop×3 reste identique sur les valeurs présentes.

### 5. Parité des stats — Live (Démarrer temps réel)

Idem : `LiveMatchPage` (et ses sous-composants de boutons rugby) doit filtrer les boutons d'action via `useStatPreferences({ categoryId, sportType, matchId })`.
- Identifier le composant qui rend les boutons rapides (en avant, plaquage, mêlée, etc.).
- Filtrer la liste des actions disponibles selon `enabledStatKeys`.

### 6. Vérification du référentiel commun

- S'assurer que `getStatsForSport("rugby")` (dans `lib/constants/sportStats.ts`) liste bien **toutes** les actions utilisables en live + en manuel (en-avant, mêlée, touche, plaquage, ruck, etc.). Si manquantes → les ajouter (juste dans le référentiel, sans changer les calculs).
- Ainsi décocher "En avant" enlève simultanément la colonne en saisie manuelle ET le bouton en live.

### 7. Application aux nouvelles compétitions

- ✅ Pas de migration nécessaire : la priorité `match override → category prefs → tout` est déjà appliquée au runtime. Toute nouvelle compétition prend automatiquement les prefs catégorie.

## Fichiers modifiés

- `src/components/category/MatchesTab.tsx` — label bouton.
- `src/components/category/settings/StatPreferencesDialog.tsx` — ajouter `matchId`, dual-mode save, titre dynamique, bouton reset défauts.
- `src/components/category/matches/MatchCard.tsx` — bouton "Personnaliser pour ce match" + state pour ouvrir le dialog.
- `src/components/category/matches/ManualRugbyStatsDialog.tsx` — brancher `useStatPreferences` et filtrer colonnes/events.
- `src/pages/LiveMatchPage.tsx` (+ sous-composants des boutons rapides) — brancher `useStatPreferences` et filtrer boutons.
- `src/lib/constants/sportStats.ts` — compléter le référentiel rugby si nécessaire.

## Hors scope (confirmé inchangé)

- Tables `category_stat_preferences` et `match_stat_overrides` : structure inchangée.
- RLS, calcul score, structure events `rugby_match_stats`.
- Bouton "Saisie manuelle" et "Démarrer (temps réel)" : positions inchangées, juste filtrés.

## Confirmations rapides avant code

1. **Bouton match-scope** : tu le veux à côté de "Démarrer (temps réel)" dans la card match ? Ou plutôt dans un menu "⋯ Plus" pour ne pas surcharger ?
2. **Mode match** : si l'utilisateur n'a jamais touché aux prefs match, on **part des prefs catégorie** (UX la plus évidente) — OK ?
3. **Périmètre Live (étape 5)** : aujourd'hui le bouton "Démarrer temps réel" affiche tous les boutons rugby ? Confirme et je branche le filtre. Sinon je peux faire un PR plus court qui couvre 1-4 + 6-7 et on traite Live dans un second temps.
