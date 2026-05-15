# Refonte UX/UI — Onglet "Statistiques" du match

## Contexte

Aujourd'hui, depuis la card d'un match, le bouton **Statistiques** (sous "Composition") :
- **Rugby (match officiel)** : redirige vers `/categories/:id/match/:id/live` (page live, pas une vraie consultation post-match)
- **Autres sports** : ouvre `SportMatchStatsDialog` (formulaire de saisie basique)
- **Sports à rounds** (judo/bowling/aviron/athlétisme) : ouvre `AggregatedRoundStatsDialog`

L'expérience est hétérogène, vieillissante, et ne propose pas de vraie lecture analytique. On refond l'expérience consultation en gardant 100% de la logique métier (calculs, persistance, schémas).

## Objectif

Une **interface unique de consultation post-match**, moderne, fluide, dans l'esprit du redesign de la saisie manuelle :
- En-tête match (score, équipes, lieu, date, statut)
- Onglets **Équipe** / **Joueurs** (+ **Timeline** + **Pied** si rugby)
- Lecture rapide, faible charge cognitive, dense mais aérée
- Compatible desktop + tablette, responsive mobile

Hors périmètre : la **saisie** (live + manuelle) reste sur ses outils existants. Cette refonte concerne uniquement la **consultation** depuis le bouton "Statistiques".

## Architecture cible

### Nouveau composant : `MatchStatsDialog.tsx`

Dialog plein écran (`max-w-7xl`, `h-[90vh]`) qui devient le point d'entrée unique pour la consultation des stats d'un match (tous sports confondus, sauf rounds qui gardent `AggregatedRoundStatsDialog`).

```
┌────────────────────────────────────────────────────────────┐
│  HEADER — gradient brand                                   │
│  [Logo] Mon Équipe  24 — 17  @ Adversaire                  │
│  Fédérale 1 · 11 mai 2026 · Dax · Finalisé · Extérieur     │
│  [Export PDF] [Saisie manuelle] [Live] [Personnaliser]    │
├────────────────────────────────────────────────────────────┤
│  [ Équipe ] [ Joueurs ] [ Timeline ] [ Pied ]*             │
├────────────────────────────────────────────────────────────┤
│  Contenu de l'onglet                                       │
└────────────────────────────────────────────────────────────┘
```
\* Onglets Timeline / Pied uniquement rugby.

### Onglet **Équipe** (`MatchTeamStatsView.tsx`)

- **KPI cards top** (grid 4-6 cols) : Essais, Transformations, Pénalités, Drops, % Réussite tirs au but, Points totaux (rugby). Pour autres sports : KPIs adaptés via `getStatsForSport`.
- **Bloc Conquête** (rugby uniquement) : Mêlées intro/contre, Touches intro/contre, % gagnées (déjà existant dans `LiveStatsPanel`).
- **Bloc Discipline** : Pénalités concédées, Cartons.
- **Bloc Attaque/Défense** : Plaquages réussis/manqués, Franchissements, En-avants, Turnovers.
- Filtré par `useStatPreferences({ categoryId, sportType, matchId })` → masque les stats désactivées.

### Onglet **Joueurs** (`MatchPlayerStatsView.tsx`)

- **Header tableau sticky** avec recherche + filtre poste (rugby).
- Une **ligne par joueur titulaire/remplaçant**, format compact :
  ```
  [#10 Pivert M.]  Min:62  Ess:1  Tr:2/3  Pén:1/2  Pl:8  Fr:3
  ```
- Cellules cliquables → ouvre un side panel avec détails (terrain, minutes, contexte).
- Tri colonnes, pagination/scroll virtualisé si > 25 joueurs.
- Colonnes adaptées au poste rugby (avants vs lignes arrière) — en s'appuyant sur `positionToActions.ts` du redesign saisie manuelle (créé en parallèle).

### Onglet **Timeline** (rugby seulement)

- Bande horizontale 0-80', pastilles colorées par type d'événement (essais, transfos, pénalités, cartons), regroupement par mi-temps.
- Hover → tooltip joueur+minute. Click → side panel détail.
- Source : `match_events` déjà persistés.

### Onglet **Pied** (rugby seulement)

- Mini-map terrain SVG (réutilise `CumulativeKickingMap` déjà existant).
- Stats par buteur, % réussite par zone.

## Intégration dans `MatchCard`

- Le bouton "Statistiques" (rugby et non-rugby, hors rounds) ouvre désormais `MatchStatsDialog` au lieu de naviguer vers `/live` ou d'ouvrir `SportMatchStatsDialog`.
- Le dialog inclut un bouton **"Saisie manuelle"** (ouvre `ManualRugbyStatsDialog`) et **"Mode Live"** (navigate `/live`) pour préserver les flux d'entrée.
- Pour les sports à rounds, on continue d'utiliser `AggregatedRoundStatsDialog` (ne change pas).

## Fichiers

**Nouveaux**
- `src/components/category/matches/stats/MatchStatsDialog.tsx`
- `src/components/category/matches/stats/MatchStatsHeader.tsx`
- `src/components/category/matches/stats/MatchTeamStatsView.tsx`
- `src/components/category/matches/stats/MatchPlayerStatsView.tsx`
- `src/components/category/matches/stats/MatchTimelineView.tsx` (rugby)
- `src/components/category/matches/stats/MatchKickingView.tsx` (rugby — wrapper de `CumulativeKickingMap`)
- `src/components/category/matches/stats/StatKpiCard.tsx`
- `src/components/category/matches/stats/PlayerStatRow.tsx`

**Modifiés**
- `src/components/category/matches/MatchCard.tsx` :
  - Le bouton "Statistiques" (lignes ~732-749) ouvre `MatchStatsDialog` (non-rugby et rugby), au lieu de nav `/live` ou `SportMatchStatsDialog`.
  - Conserver `SportMatchStatsDialog` accessible uniquement via "Saisie" depuis le nouveau dialog.

## Hors scope (strictement inchangé)

- Schémas DB (`match_events`, `player_match_stats`, `category_stat_preferences`, `match_stat_overrides`)
- Calculs de score, agrégations existantes
- `LiveMatchPage`, `ManualRugbyStatsDialog`, `AggregatedRoundStatsDialog` (réutilisés tels quels)
- Permissions / RLS

## Validation

- Build OK
- Visual QA via screenshot du nouveau dialog (vue équipe + vue joueurs) sur le match Dax existant
- Confirmer que le score et le nombre d'événements correspondent à ce qui est déjà affiché en live
