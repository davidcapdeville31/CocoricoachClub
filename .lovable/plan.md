## Objectif

Dans `ManualRugbyStatsDialog`, ajouter une petite icône 📍 à côté des cellules suivantes (pour chaque joueur / mi-temps) :
- **Points** : Transformations ✓, Pénalités ✓, Drops ✓ (positions du tir)
- **Conquête** : Mêlées (gagnées/perdues), Touches (gagnées/perdues), Pénaltouches éventuelles

Cliquer sur l'icône ouvre une mini-popup avec le `RugbyFieldSVG` (côté gauche/droite togglable comme en live), permettant de placer **N marqueurs** correspondant exactement au nombre saisi dans la cellule. Les positions sont sauvegardées par événement individuel dans `match_events.metadata.position = { x, y, side }` — même format que la saisie live, donc compatibles avec `CumulativeKickingMap` et le PDF.

## UX

- L'icône (lucide `MapPin`) apparaît seulement si le compteur > 0, en gras coloré quand toutes les positions sont placées, en outline grisé sinon.
- Tooltip : « Placer la position sur le terrain ».
- Popup : titre dynamique (« Position des transformations », etc.), toggle Gauche/Droite, terrain interactif. Les marqueurs déjà placés sont cliquables pour suppression. Un compteur « 2/3 placées ».
- Snap automatique sur la ligne de touche pour les touches (réutiliser la logique snap de `EventDialog`).
- Pas obligatoire : on peut sauvegarder sans avoir placé toutes les positions (les événements sans `position` resteront comme aujourd'hui).

## Refacto data

Aujourd'hui les events sont reconstruits depuis des compteurs agrégés. Pour préserver les positions on passe à une structure :

```ts
type StatRow = {
  // compteurs (inchangés, dérivés)
  ...
  // nouveau : positions par stat (longueur libre, max = compteur)
  positions: Partial<Record<PositionableKey, Array<{ x:number; y:number; side:"left"|"right" }>>>
}
```

Où `PositionableKey` ∈ `conversionsMade | penaltiesMade | drops | scrumsWon | scrumsLost | lineoutsWon | lineoutsLost`.

- À l'incrément de compteur : on n'ajoute pas auto une position vide (laissé null).
- À la décrémentation : si `positions.length > newCount`, on tronque.
- Lors de la rehydratation depuis `existingEvents`, on lit `metadata.position` et on remplit le tableau dans l'ordre H1 puis H2.
- `buildEvents` : pour chaque stat positionable, on émet N events ; les K premiers reçoivent `metadata.position = positions[k]`, les autres restent sans position.

## Composants à créer / modifier

1. **Nouveau** `src/components/category/matches/ManualRugbyPositionDialog.tsx` — mini-dialog réutilisable (terrain + N markers + side toggle + snap optionnel).
2. **Modifié** `ManualRugbyStatsDialog.tsx` :
   - Ajouter le state `positions` dans `StatRow` + EMPTY.
   - Bouton 📍 dans chaque cellule positionable (rendu inline à droite de l'`Input`).
   - Nouvelle ligne « Adversaire » (déjà existante) : même icône.
   - Hydratation et `buildEvents` mis à jour (push `metadata.position` quand dispo, snap pour touches).
3. **Aucune migration SQL** (le format `metadata.position` est déjà accepté par `match_events`).

## Fichiers techniques

```text
src/components/category/matches/
├── ManualRugbyStatsDialog.tsx        (modifié)
└── ManualRugbyPositionDialog.tsx     (nouveau, ~150 lignes)
```

Pas de changement côté `CumulativeKickingMap` / PDF / aggregator : ils consomment déjà `metadata.position`.

## Hors scope

- Replay temporel des positions saisies manuellement (on garde `minute=0`).
- Édition fine du marqueur après placement (drag) — on supprime + reclique.
