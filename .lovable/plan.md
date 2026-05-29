
# Refonte du module Entraînement Bowling

Refonte ciblée, **bowling uniquement**, sans toucher aux autres sports ni casser le calendrier, l'arsenal, la feuille de score compétition ou l'espace athlète.

## 1. Architecture séance bowling

4 types de blocs (au lieu des 3 actuels) : **Échauffement · Technique · Tactique · Parties**.

Chaque bloc partage un socle commun :
- titre, durée, nb lancers (libre, presets 10/20/30/40/50 + saisie manuelle, **plus aucun plafond 20**)
- consigne coach, note interne, priorité (faible/moyen/élevé)
- objectif principal + critères de réussite structurés
- zone bilan après réalisation

Le champ « notes » n'est plus jamais requis pour décrire l'exercice : tout passe par des champs structurés. Un **résumé auto** (titre généré) est affiché en preview.

## 2. Travail Technique — constructeur dédié

Interface distincte du tactique. Sélecteurs structurés :
- **Type** : axe rotation, vitesse, rotation, profondeur de pose, régularité, ligne technique, spare technique, routine, combiné perso
- **Paramètres techniques** (multi) : vitesse −/normale/+, axe naturel/0°/0-30°/30-60°, rotation −/normale/+, profondeur −/normale/+, approche normale/ralentie/dynamique, relâchement normal/souple/accéléré, swing libre/contrôlé, routine complète/simplifiée
- **Objectifs résultat** (multi) : quille 1 ou quille précise 1-10, poche, poche+strike, spare, point de sortie, zone flèche, vitesse cible, ligne, doublé/triplé/quadruplé
- **Mode d'enchaînement** : consécutif, alterné, par série, libre, progressif, décroissant, difficulté croissante/décroissante
- **Critères réussite** : % axe / poche / strike / poche+strike / point de sortie / quille touchée, tolérance vitesse km/h, réussites consécutives attendues, score min

## 3. Travail Tactique — constructeur dédié

Interface visuelle distincte :
- **Type** : poche/strike entre flèches, zone flèche, placement déterminé pied, ligne de jeu, adaptation pattern, recherche poche, recherche strike, déplacement pied, déplacement point de sortie, changement de boule, transition piste, situation jeu, personnalisé
- **Pattern / huilage** : choix existant, libre, longueur, ratio, volume, difficulté perçue, commentaire
- **Zones de jeu** : sélecteur visuel (rigole→F1, F1, F1-F2, F2, F2-F3, F3, F3-F4, F4, F5, F6, perso + plages de lattes)
- **Flèches/lattes** : flèche cible, entre 2 flèches, plage de lattes, latte cible, tolérance ±1/±2/±3, point de sortie cible + tolérance
- Possibilité de définir N lancers par zone (ex : 10 par zone sur 5 zones)

## 4. Parties d'entraînement

- Coach configure : nb parties, pattern (ou libre), objectif (score moyen, % poche, % strike, % spare, % quilles seules, % spares composés, % ≥8, splits max, régularité, stratégie, routine compét), consigne
- Athlète : **réutilise la feuille de score existante** (composant compétition) en mode entraînement, frame par frame
- Liaison session ↔ pattern ↔ boule ↔ objectifs
- Les parties alimentent les stats d'**entraînement** (séparées des stats compétition, filtre commun possible)

## 5. Saisie athlète lancer par lancer

Mobile-first, gros boutons oui/non, bouton « lancer suivant », correction possible, résumé après chaque série, bilan final.

**Champs Technique par lancer** : boule (depuis arsenal), axe respecté, quille 1/cible touchée, poche, strike, point de sortie respecté, vitesse (option), commentaire court.

**Champs Tactique par lancer** : zone prévue, latte de départ pied, latte point de sortie, boule, flèche/zone jouée, poche, strike, spare, adaptation effectuée, commentaire. Le système calcule **automatiquement** les décalages (« +2 au pied », « −1 au point de sortie ») par diff avec le lancer précédent.

## 6. Stats d'entraînement bowling

Filtres croisés : athlète, période, séance, exercice, type, technique/tactique/parties, objectif, paramètre technique, pattern, boule, zone flèche, latte départ, point de sortie, poche, strike, spare.

KPIs : % réussite global, % par objectif, % axe, % vitesse cible, % profondeur, % point sortie, % poche, % strike, % poche+strike, % spare, % par zone / boule / pattern, meilleure série consécutive, progression temporelle, comparaison objectif coach vs réel, nb lancers, charge technique vs tactique vs volume parties.

Visus : cartes KPI · graphiques simples (Recharts) · tableau détaillé · **heatmap par zone** · **timeline lancer par lancer**.

## 7. Bibliothèque d'exercices bowling

Catalogue prédéfini (sans aucune mention du PDF source ni « DTN »), regroupé Technique / Tactique / Parties — voir la liste exacte demandée (Axe 0°+quille 1, Vitesse constante, Profondeur de pose, Spares composés, Zone flèche, Placement déterminé, Adaptation pattern, 4 parties situation, etc.).

Coach peut : appliquer un modèle, dupliquer un bloc, sauvegarder un bloc comme modèle perso, publier dans la bibliothèque du club.

## 8. Côté athlète (espace athlète)

- **Voir séance coach** : blocs en lecture-structure, saisie lancer par lancer, brouillon, terminer.
- **Créer son entraînement** : strictement le même constructeur que le coach (techniques, tactiques, parties). Alimente ses stats perso ; visible du coach selon les droits déjà en place.

## 9. UX coach — flux 3 étapes

1. Choisir type de bloc (Échauffement / Technique / Tactique / Parties)
2. Configurer (formulaire conditionnel selon type — aucun champ inutile, presets intelligents)
3. Définir critères de réussite + preview résumé auto

Boutons dupliquer / enregistrer comme modèle / ajouter à la bibliothèque.

---

## Détails techniques

### Modèle de données (nouvelles tables)

```text
bowling_training_blocks
  id, session_id (training_sessions), athlete_id, source ('coach'|'athlete'),
  block_type ('warmup'|'technical'|'tactical'|'games'),
  title, duration_min, planned_throws, priority,
  coach_instruction, internal_note, objectives jsonb, success_criteria jsonb,
  pattern_id, config jsonb, status, order_index, debrief jsonb

bowling_throw_results
  id, block_id, exercise_index, throw_number, ball_arsenal_id,
  foot_board, breakpoint_board, target_arrow, target_zone, actual_zone,
  speed_kmh, axis_success, speed_success, release_success,
  breakpoint_success, pocket_success, strike_success, spare_success,
  pin_hit smallint[], success_global, comment,
  foot_delta, breakpoint_delta (auto via trigger sur lancer N vs N-1)

bowling_training_games
  id, block_id, game_number, score, stats jsonb, pattern_id, ball_arsenal_id

bowling_exercise_library
  id, scope ('system'|'club'|'user'), club_id, owner_id, category, name,
  config jsonb, created_at
```

RLS standard : accès via `can_access_category` + propriétaire. GRANTs `authenticated` + `service_role`.

### Réutilisation existante

- `bowling_spare_training` conservée pour rétro-compat (les nouveaux blocs y inscrivent toujours une ligne agrégée pour ne pas casser `BowlingTrainingStats` / `BowlingCumulativeStats` / `BowlingFrameAnalysis`).
- Feuille de score compétition (`competition_round_stats` + composants existants) réutilisée telle quelle pour les blocs Parties, simplement liée par `block_id`.
- `bowling_oil_patterns` réutilisée pour le sélecteur pattern.
- Arsenal joueur : `BowlingBallSelector` existant.
- Edge function `athlete-bowling-training` étendue : `action: 'save_block'`, `'save_throw'`, `'save_game'`.

### Front

```
src/components/bowling/
  blocks/
    BowlingBlockTypePicker.tsx           (étape 1)
    BowlingTechnicalBuilder.tsx          (étape 2 technique)
    BowlingTacticalBuilder.tsx           (étape 2 tactique)
    BowlingGamesBuilder.tsx              (étape 2 parties)
    BowlingWarmupBuilder.tsx
    BowlingSuccessCriteria.tsx           (étape 3 commune)
    BowlingBlockPreview.tsx              (résumé auto)
  selectors/
    BowlingZoneSelector.tsx              (zones visuelles flèches/lattes)
    BowlingParametersPicker.tsx          (multi-pills paramètres techniques)
    BowlingTargetOutcomesPicker.tsx
  athlete/
    BowlingThrowEntry.tsx                (saisie 1 lancer mobile-first)
    BowlingBlockRunner.tsx               (timeline lancer-par-lancer, brouillon)
    BowlingGamesRunner.tsx               (réutilise score sheet existant)
  stats/
    BowlingTrainingKpis.tsx
    BowlingZoneHeatmap.tsx
    BowlingThrowTimeline.tsx
    BowlingTrainingFilters.tsx
  library/
    BowlingExerciseLibraryDialog.tsx
    bowlingLibrarySeed.ts                (catalogue prédéfini)
src/lib/constants/
  bowlingTechnicalParameters.ts
  bowlingTacticalZones.ts
  bowlingTargetOutcomes.ts
src/lib/bowling/
  throwDeltas.ts                         (calcul +2/−1 pied/point de sortie)
  trainingStatsAggregator.ts             (KPIs croisés)
```

`FieldSessionDialog` détecte `sport=bowling` et bascule sur le nouveau flux 3 étapes. `AthleteCreateSession` partage les mêmes builders.

### Non-régression

- Anciens types `bowling_spare/practice/approche/release` toujours mappés (déjà fait dans le plan précédent) pour les séances historiques.
- Les composants stats existants continuent de lire `bowling_spare_training` ; les nouveaux composants lisent `bowling_throw_results` + agrègent.
- Tests Deno sur edge function (`save_throw`, deltas auto, autorisation cross-category) + tests unitaires sur `trainingStatsAggregator`.

### Hors scope

- Aucune modification autres sports.
- Pas de refonte compétition bowling ni de l'arsenal.
- Pas de changement des graphiques bowling existants (ils restent alimentés via la passerelle `bowling_spare_training`).
