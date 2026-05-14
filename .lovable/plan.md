# Module Datas — Sports collectifs (rugby d'abord)

Objectif : créer un moteur analytics qui lit **directement** la table `match_events` (alimentée par Compétition → Démarrer le match) et recalcule tout dynamiquement, dans l'esprit du module bowling. Aucun stockage en double.

## Architecture

### 1. Moteur de calcul (pur, côté front)
Nouveau dossier `src/lib/analytics/team-sports/` :
- `eventAggregator.ts` — agrège un `MatchEvent[]` filtré par période en `TeamStats` (étend l'existant `useMatchStats`) : score, essais, transfos, pénalités, drops, plaquages R/M + ratio, turnovers, ballons gagnés/perdus, mètres, franchissements, pénalités concédées, cartons, touches/mêlées G/L.
- `playerAggregator.ts` — `PlayerStats` par joueur (offensif / défensif / discipline / activité + temps de jeu déduit des `substitution`).
- `historyAggregator.ts` — pour un `categoryId`, joint `matches` + `match_events` et calcule par match : score final, V/D/N, lieu, possession, top stats.
- `comparisonEngine.ts` — sélection multi-joueurs/multi-matchs → datasets pour radar / bars / lignes.
- `momentum.ts` — série temporelle (cumul score par minute pour timeline et momentum).

### 2. Hooks React Query
`src/hooks/analytics/` :
- `useMatchAnalytics(matchId, period)` — fetch events + agrège.
- `useCategoryMatchHistory(categoryId)` — fetch matches + events agrégés.
- `usePlayerAnalytics(matchId, playerId, period)`.
- `useComparisonData(playerIds[], scope)`.

Tout passe par `match_events` existant (realtime déjà en place) — **pas de migration DB**.

### 3. UI — onglet Datas refondu pour rugby
Modifier `src/components/category/tabs/DatasTab.tsx` : si `isRugbyType`, monter le nouveau `<TeamSportsAnalytics categoryId sportType />`.

Nouveau dossier `src/components/category/datas/team-sports/` :

```
TeamSportsAnalytics.tsx     ← shell + sélecteur de match + 4 sous-onglets
├─ MatchSelector.tsx        ← liste déroulante des matchs joués
├─ tabs/
│   ├─ GeneralTab.tsx       ← KPI cards + diagrammes + timeline + momentum
│   ├─ PlayerStatsTab.tsx   ← liste joueurs (photo, poste, badges) + détail
│   ├─ HistoryTab.tsx       ← timeline chrono + recherche + filtres
│   └─ CompareTab.tsx       ← multi-select + radar/bar/lignes + filtres identité
└─ shared/
    ├─ PeriodToggle.tsx     ← [Match complet][1ère MT][2ème MT]
    ├─ KpiCard.tsx
    ├─ MomentumChart.tsx
    ├─ EventTimeline.tsx
    └─ PlayerIdentityBadges.tsx (réutilise badges existants)
```

### 4. Onglets — détail

**Général** : `PeriodToggle` en tête. KPIs score/essais/transfos/pénalités/drops, blocs Défense (plaquages + ratio), Jeu (turnovers, ballons G/P, mètres, franchissements), Discipline (pénalités, jaunes, rouges), Conquête (touches, mêlées). Timeline événements + courbe momentum (score cumulé domicile/extérieur).

**Statistiques par joueur** : colonne gauche scrollable (avatar, nom, poste, badges identité depuis `useAthleteAttributes`). Zone droite : `PeriodToggle` + sections Offensif/Défensif/Discipline/Activité + mini-timeline du joueur.

**Historique** : timeline verticale chrono, recherche (adversaire, compét, score, saison), filtres (dom/ext, V/D, compétition, sous-catégorie). Chaque carte → boutons "Général", "Joueurs", "Comparer" qui rechargent le match dans les autres onglets.

**Comparer** : multi-select joueurs (Tous / Aucun / par tag identité — 3e ligne, U18, gaucher…). Choix stats (chips comme bowling). Radar (recharts), bar chart, courbes d'évolution multi-matchs. Bouton "Par identité" pour grouper plutôt que joueur par joueur.

### 5. Réutilisations
- `useMatchEvents`, `useMatchStats` existants (étendus, pas remplacés).
- Recharts (déjà utilisé partout).
- `ColoredSubTabsList` pour les 4 onglets (cohérence bowling).
- `useAthleteAttributes` pour les badges identité.

### 6. Hors scope (pour l'instant)
- Football/basket/hand/volley/water-polo : l'architecture est générique mais seuls les libellés/types rugby existent. On expose le moteur comme générique ; l'adaptation par sport viendra quand chaque sport aura son flow live.
- Aucune modif des écrans de saisie live (Compétition → Démarrer reste tel quel).

## Livrables
- Moteur analytics pur + hooks
- 4 onglets premium recalculés à la volée
- Aucune nouvelle table, aucune migration
- Branchement automatique pour catégories rugby ; bowling et autres sports inchangés
