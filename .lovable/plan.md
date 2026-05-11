# Plan — Live Match Tracker Rugby (event-based)

Refonte complète du système de stats rugby vers un module event-based professionnel, accessible via un nouveau bouton rouge **"Démarrer"** sur chaque carte de match (Rugby uniquement : XV, à 7, à 13).

## 1. Bouton "Démarrer" (entrée)

- Ajouter un gros bouton rouge **"Démarrer"** (icône Play, `bg-red-600 hover:bg-red-700`) à côté de Modifier / Composition / Statistiques / Ajouter un match
- Visible uniquement pour les disciplines rugby (`isRugby`, `isRugby7`, `isRugby13`)
- Ouvre une route plein écran `/categories/:id/match/:matchId/live` (optimisée tablette)

## 2. Base de données

Nouvelle table `match_events` :

```text
id            uuid PK
match_id      uuid FK matches
team_side     text  ('home' | 'away')
player_id     uuid FK players (nullable, pour adversaire)
minute        int
second        int (default 0)
period        text ('H1' | 'HT' | 'H2' | 'ET')
event_type    text (try, conversion, penalty, drop, lineout, scrum,
                    ruck, tackle, turnover, knock_on, foul, yellow_card,
                    red_card, substitution, injury, kickoff, restart,
                    maul, kick, occupation, exit_22)
event_subtype text (nullable — type d'essai, type de faute, etc.)
outcome       text ('success' | 'fail' | 'won' | 'lost' | 'contested' | nullable)
points        int (default 0 — calculé serveur via trigger)
metadata      jsonb (zone, side, kickDistance, contested, motif, ...)
created_at    timestamptz
created_by    uuid
```

Trigger BEFORE INSERT/UPDATE pour auto-calculer `points` :
- try success → 5
- conversion success → 2
- penalty success → 3
- drop success → 3
- sinon 0

RLS : staff de la catégorie peut CRUD ; lecture publique via token de match si déjà en place pour `matches`.

## 3. Architecture front

Nouveau dossier `src/components/category/matches/live/` :

- `LiveMatchTracker.tsx` — page conteneur 3 zones, gestion période/chrono, raccourcis clavier (E/P/T/M/C/D)
- `LiveScoreboard.tsx` — sticky top, scores dérivés des événements, chrono start/pause/reset, sélecteur période
- `LiveTimeline.tsx` — liste cards triées chronologiquement, actions modifier/supprimer/dupliquer
- `LiveQuickActions.tsx` — grille de gros boutons tactiles (Essai, Transfo, Pénalité, Drop, Touche, Mêlée, Ruck, Plaquage, Turnover, En-avant, Faute, Jaune, Rouge, Remplacement, Blessure, Coup d'envoi, Renvoi, Ballon porté, Jeu au pied, Occupation, Sortie de camp)
- `dialogs/` — un popup intelligent par type d'événement :
  - `TryDialog.tsx` (avec chaînage automatique vers `ConversionDialog`)
  - `PenaltyDialog.tsx` (chaîne vers tir au but si "au pied")
  - `LineoutDialog.tsx`, `ScrumDialog.tsx`, `CardDialog.tsx`, `SubstitutionDialog.tsx`, `GenericEventDialog.tsx`
- `hooks/useMatchEvents.ts` — query + realtime + mutations create/update/delete/duplicate
- `hooks/useMatchStats.ts` — dérive score live + stats équipe/adversaire/joueur depuis `match_events` (mémo client)
- `PostMatchAnalytics.tsx` — vue analytics : timeline score, momentum, répartition points, discipline, conquête (%), efficacité offensive, stats joueurs, comparatif équipe/adversaire (Recharts)

## 4. Logique intelligente popups

- **Essai** : minute auto-remplie (chrono), équipe, marqueur, zone, sous-type → après save, prompt « Transformation tentée ? » → `ConversionDialog` (buteur, position, succès) → 2 events créés en cascade
- **Pénalité** : motif faute, mode (au pied / pénaltouche / mêlée / rapide) ; si pied → buteur + résultat ; success +3
- **Touche** : zone, gagnée/perdue, lancer, réceptionneur, contestée
- **Mêlée** : gagnée/perdue, pénalité obtenue/concédée, bras cassé, introduction
- **Carton rouge** : marque le joueur indisponible pour les composition futures du match (filtré dans sélecteurs)

Chrono : auto-remplit `minute`/`period` mais éditable manuellement (saisie a posteriori).

## 5. Stats auto-calculées (toutes dérivées de `match_events`)

Depuis `useMatchStats` :

- **Score** : somme `points` par `team_side`
- **Équipe Attaque** : essais, transfos (réussies/tentées), pénalités (réussies/tentées), drops, points
- **Conquête** : touches gagnées/perdues + %, mêlées gagnées/perdues + %, pénalités de mêlée, mauls
- **Discipline** : pénalités concédées, jaunes, rouges
- **Défense** : plaquages réussis/manqués, turnovers
- **Jeu au pied** : occupation, longueur moyenne (depuis `metadata.kickDistance`), renvois
- **Joueurs** : agrégation par `player_id` — essais, points, transfos, drops, pénalités, plaquages, turnovers, fautes, cartons, temps de jeu (via events substitution + minute)

Ces stats remplacent l'ancienne saisie manuelle dans `SportMatchStatsDialog` pour le rugby. L'ancien dialog reste en lecture seule (résumé) pour les matchs déjà saisis ; bascule automatique vers le nouveau système si des `match_events` existent.

## 6. Design

- Thème sombre premium réutilisant `--surface-elevated`, `--brand-500`, `rounded-2xl`
- Boutons rapides : `min-h-20`, icônes Lucide, couleurs par catégorie d'action (attaque vert, défense bleu, discipline orange/rouge, conquête violet)
- Layout tablette : grid 12 cols (scoreboard full, timeline 7 cols, actions 5 cols) ; sur mobile, tabs Timeline/Actions
- Animations framer-motion sur ajout d'event (slide-in)

## 7. Raccourcis clavier (mode analyste)

`E` essai · `P` pénalité · `T` touche · `M` mêlée · `C` carton · `D` drop · `Espace` pause/play chrono

## 8. Livrables / fichiers

- Migration SQL `match_events` + trigger points + RLS
- `src/pages/LiveMatchPage.tsx` + route dans `App.tsx`
- `src/components/category/matches/live/*` (composants + hooks + dialogs ci-dessus)
- Bouton "Démarrer" ajouté dans la carte match rugby (`MatchesTab` / composant carte)
- Mémoire mise à jour : nouveau pattern event-based pour rugby

## Hors-scope (à confirmer)

- Migration des matchs déjà saisis manuellement vers `match_events` (probablement non — coexistence)
- Export PDF analytics post-match (peut être V2)
- Multi-utilisateurs simultanés sur le même match en realtime collaboratif (le realtime Supabase suffit pour la lecture, pas de verrouillage d'écriture)

Confirme-moi pour que je lance l'implémentation (migration DB + tous les composants).
