# Séances simplifiées — toutes disciplines (espace athlète)

## Objectif
Aujourd'hui seuls **Bowling** et **Musculation** proposent un "mode simplifié" quand l'athlète crée une séance depuis son calendrier. On étend ce mode à **toutes les disciplines** (rugby, football, judo, ski, snowboard, tennis, padel, surf, athlé, basket, hand, natation, cyclisme, course, etc.) avec le même contrat : saisie rapide → alimente automatiquement le workload.

## Comportement final
Dans l'espace athlète → Calendrier → "Ajouter une séance" :

1. Bowling → picker "Simplifié / Avancé" (inchangé).
2. Toute autre discipline → nouveau picker "Mode simplifié / Programme complet".
3. Le mode simplifié ouvre un dialog générique :
   - Sélecteur du **type de séance** (filtré par sport de la catégorie).
   - **Description libre** (textarea).
   - **Durée** (minutes).
   - **RPE ressenti** 1-10 (boutons colorés).
   - Bouton Valider → crée la séance via `athlete-create-session` avec `session_start_time` / `session_end_time` calculés depuis la durée + `intensity = RPE` → alimente automatiquement la charge d'entraînement.
4. Côté staff, la séance apparaît dans le calendrier (déjà géré via RLS + liseré violet indiquant le créateur).

## Fichiers modifiés / créés

### Nouveau
- `src/components/athlete-space/SimplifiedSessionDialog.tsx`
  - Généralisation de `MusculationSimplifiedDialog`.
  - Props : `open`, `onOpenChange`, `date`, `categoryId`, `athletePlayerId`, `sportType`.
  - Récupère les training types via `getTrainingTypesForSport(sportType)` en excluant `bowling_*` (couvert par le flux dédié) et propose un `<Select>` de type de séance.
  - Envoie à `athlete-create-session` : `training_type` choisi, `intensity` = RPE, `session_start_time`/`session_end_time` depuis la durée, notes préfixées `<!--SIMPLIFIED_SESSION-->`.

### Édités
- `src/components/category/calendar/CreateEventDialog.tsx`
  - Renommer la prop `onSelectMusculationSimplified` en `onSelectSessionSimplified` (générique). Conserver un alias pour compat.
  - Déclencher `session_mode` pour `typeId === "session"` dès qu'un `athletePlayerId` est fourni (plus seulement musculation).
  - Adapter les libellés du picker "Mode simplifié / Programme complet" (retirer la mention "Musculation", parler de "séance").
- `src/components/athlete-space/AthleteSpaceCalendar.tsx`
  - Remplacer l'usage de `MusculationSimplifiedDialog` par `SimplifiedSessionDialog` avec `sportType` transmis depuis la catégorie.
  - Renommer les states `isMusculationSimplifiedOpen` → `isSessionSimplifiedOpen`.
  - Câbler `onSelectSessionSimplified` sur `CreateEventDialog`.

### Conservé
- `MusculationSimplifiedDialog.tsx` : peut être supprimé une fois le remplacement validé, ou gardé en wrapper qui redirige vers `SimplifiedSessionDialog` avec type verrouillé `musculation` (au choix). Plan par défaut : suppression après migration.
- Flux Bowling simplifié : inchangé.

## Détails techniques

- Workload : `athlete-create-session` insère dans `training_sessions` avec `intensity` + heures début/fin ; les hooks EWMA/AWCR/tonnage consomment déjà ces champs, aucun changement backend requis.
- Visibilité staff : la policy RLS "Users can view training sessions in accessible categories" couvre déjà les séances créées par un athlète — `ImprovedCalendarView` affiche déjà les sessions avec `created_by_player_id` (badge violet + nom du créateur).
- Types de séance filtrés : on exclut explicitement `bowling_*` du sélecteur générique pour ne pas dupliquer le flux Bowling.
- Notes stockées : `<!--SIMPLIFIED_SESSION-->\n{description}\nDurée : X min · RPE : Y/10` — même convention que le mode musculation actuel (mémoire "Session Metadata Notes Pattern").

## Hors périmètre
- Sports strictement individuels de compétition (Compétitions/Datas) restent gérés par leurs flows dédiés — le mode simplifié cible uniquement l'entraînement.
- Aucune migration DB.
