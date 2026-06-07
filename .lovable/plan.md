## Objectif

Distinguer clairement deux types de compétitions Bowling :
- **Compétition Club** : créée par le coach, multi-participants, visible côté coach et alimente les stats club.
- **Compétition Personnelle** : créée par l'athlète, mono-participant (lui-même), privée, alimente uniquement ses stats personnelles.

## 1. Base de données

Ajouter sur la table `matches` deux colonnes :

- `created_by_player_id uuid` (FK → `players.id`, nullable) — non null = compétition personnelle de cet athlète.
- `is_personal boolean default false` — flag rapide pour filtrage.

Index : `(category_id, is_personal)` pour les listings, `(created_by_player_id)` pour les vues athlète.

Politiques RLS adaptées :
- Coach : SELECT/UPDATE/DELETE sur les matchs club (`is_personal = false`) de ses catégories, comme aujourd'hui.
- Coach : SELECT uniquement des matchs personnels (`is_personal = true`) via le profil athlète (filtré côté requête, pas bloqué RLS).
- Athlète : SELECT/INSERT/UPDATE/DELETE de ses propres matchs personnels ; SELECT des matchs club où il est aligné.

## 2. Création côté Athlète (AddMatchCalendarDialog en mode `athletePlayerId`)

- Forcer `is_personal = true` et `created_by_player_id = playerId` dans le payload envoyé à l'edge function `athlete-create-match`.
- L'edge function valide que `player.user_id === userId` (déjà fait), puis insère avec ces deux champs.
- Auto-créer une ligne `match_lineups` (athlète = seul participant) pour que la compétition apparaisse immédiatement dans son onglet "Parties".
- Masquer toute UI de sélection multi-participants côté athlète (déjà absente du dialog actuel — RAS, mais s'assurer qu'aucun bouton "Participants" n'apparaît côté espace athlète sur une compétition personnelle).

## 3. Création côté Coach

Aucun changement de comportement : `is_personal = false`, `created_by_player_id = null`. La gestion des participants via "Participants" reste identique.

## 4. Filtrage Coach (MatchesTab → "Gestion des compétitions")

- Ajouter `.eq("is_personal", false)` à la requête principale `["matches", categoryId]` dans `MatchesTab`.
- Idem dans : `DecisionCenter` (upcoming_matches), `ReportsTab`, `MatchSheetsSection`, `AthleticsCompetitionAnalyticsTab`, `JudoCompetitionAnalyticsTab`, `useTeamSportsAnalytics`, `WeeklyPlanningCalendar`, `SessionHistoryTimeline`, `AnnualPlanningView` (compétitions club uniquement).
- Conséquence : aucune compétition personnelle ne pollue plus les listes club, le calendrier club, les stats collectives, ni les PDF club.

## 5. Espace Athlète

- `AthleteSpaceCalendar` (queryKey `athlete-calendar-matches`) : afficher **(a)** les matchs club où l'athlète est aligné + **(b)** ses propres compétitions personnelles (`created_by_player_id = playerId`).
- Onglet "Parties" / huilage / stats personnelles de l'athlète : inclure les compétitions personnelles + les compétitions club où il est aligné (déjà filtré par lineup).

## 6. Accès Coach via profil athlète

Dans la fiche joueur (player profile), ajouter une sous-section **"Compétitions personnelles"** dans l'onglet Historique / Compétitions du joueur :
- Liste les `matches` où `created_by_player_id = player.id`.
- Affiche les parties, huilages, résultats, en lecture seule par défaut (le coach peut consulter mais pas dupliquer dans la gestion club).
- Badge visuel "Personnelle" pour bien distinguer.

## 7. Visuels & libellés

- Sur les cartes côté athlète : petit badge "Personnelle" (couleur cyan) vs "Club" (orange) pour clarifier l'origine.
- Côté coach (uniquement dans le profil joueur) : même badge "Personnelle".

## 8. Tests manuels (validation)

1. Coach crée compétition → visible Gestion compétitions, visible calendrier athlètes sélectionnés.
2. Athlète A crée compétition perso → invisible côté coach (Gestion), visible dans son calendrier + ses parties + ses stats.
3. Athlète B ne voit jamais la compétition perso de A.
4. Coach ouvre profil Athlète A → onglet "Compétitions personnelles" → voit la compét perso de A uniquement.
5. Stats club : pas d'impact des compétitions perso (vérifier ReportsTab + analytics).

## Détails techniques (pour info)

- Migration SQL : `ALTER TABLE matches ADD COLUMN created_by_player_id uuid REFERENCES players(id) ON DELETE SET NULL, ADD COLUMN is_personal boolean NOT NULL DEFAULT false;` + index.
- Backfill : rien à migrer (toutes les compétitions existantes restent `is_personal = false`).
- Edge function `athlete-create-match` : ajouter les 2 champs au whitelist + auto-insert `match_lineups`.
- Pas de changement sur `match_lineups`, `bowling_oil_patterns`, `bowling_training_games` — le filtrage par `match_id` suffit naturellement.