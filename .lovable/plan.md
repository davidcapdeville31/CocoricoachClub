## Refonte du dialog de saisie manuelle des statistiques rugby

### Objectif
Restructurer `ManualRugbyStatsDialog` en onglets thématiques, ajouter les phases de conquête, et permettre de noter à quel moment les actions ont eu lieu — pour notre équipe **et** l'équipe adverse, par mi-temps.

### Structure d'interface

```text
┌──────────────────────────────────────────────────────────┐
│  Score live :   Notre équipe  X  –  Y  Adversaire        │
├──────────────────────────────────────────────────────────┤
│  [ 1ʳᵉ mi-temps ] [ 2ᵉ mi-temps ]                        │
├──────────────────────────────────────────────────────────┤
│  [ Points ] [ Conquête ] [ Défense ] [ Discipline ]      │
├──────────────────────────────────────────────────────────┤
│  Tableau joueurs (colonnes filtrées par onglet)          │
│  + colonne « Minutes » (texte libre : "12', 34'…")       │
├──────────────────────────────────────────────────────────┤
│  Bloc équipe adverse (mêmes colonnes que l'onglet)       │
│  + champ Minutes                                          │
└──────────────────────────────────────────────────────────┘
```

### Onglets et champs

- **Points** : Essais, Tr ✓, Tr ✗, Pén ✓, Pén ✗, Drop ✓, Drop ✗
- **Conquête** : Mêlées gagnées, Mêlées perdues, Touches gagnées, Touches perdues, Ballons portés, Rucks
- **Défense** : Plaquages réussis, Plaquages manqués, En-avants
- **Discipline** : Fautes, Jaunes, Rouges

### Notation des moments
Chaque ligne (joueur ou adversaire) gagne un champ texte libre **Minutes** par mi-temps, où le staff peut taper p. ex. `12', 34', 56'`. Stocké dans `metadata.minutes_note` du premier événement de la ligne ou dans une nouvelle colonne dédiée si plus simple — voir détails techniques.

### Détails techniques
- Étendre `StatRow` avec : `scrumsWon, scrumsLost, lineoutsWon, lineoutsLost, mauls, rucks` (les autres champs existent déjà).
- Ajouter une constante `CATEGORIES` qui groupe les `FIELDS` par onglet (`points` / `conquest` / `defense` / `discipline`).
- Ajouter un state `category: "points" | "conquest" | "defense" | "discipline"` avec `Tabs` sous le sélecteur de mi-temps. Le tableau et le bloc adverse n'affichent que les colonnes de la catégorie active.
- Le sélecteur de mi-temps reste tel quel (déjà partagé entre nos joueurs et l'équipe adverse).
- Notes de minutes : ajouter `notes: { H1: Record<playerId|"opp", string>, H2: ... }` en state. À la sauvegarde, joindre la note dans `metadata.minutes_note` sur les events de la ligne (ou un event de type `note` si la table le permet sans casser l'agrégation).
- Mapper les nouveaux types d'événements (`scrum_won`, `scrum_lost`, `lineout_won`, `lineout_lost`, `maul`, `ruck`) côté `applyEvent` et `pushAll`. Ces types existent déjà côté analytics rugby (conquêtes), à vérifier rapidement avant d'écrire.
- Score live inchangé (toujours basé sur `computePoints`).

### Fichier modifié
- `src/components/category/matches/ManualRugbyStatsDialog.tsx`

### Hors-scope
- Pas de changement à `MatchCard` ni au mode live.
- Pas de schéma DB modifié — on réutilise `match_events.metadata` pour stocker les minutes.
