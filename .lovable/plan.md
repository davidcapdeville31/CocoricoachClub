# Groupes d'athlètes personnalisables

Créer des groupes d'athlètes dans « Effectif » et pouvoir les utiliser comme raccourci de sélection partout où l'on convoque des athlètes (événements, tests, musculation, compétitions, programmes).

## Ce que tu pourras faire

Dans Effectif :
- Un bouton « Groupes » ouvre la gestion : créer un groupe (nom, couleur), y ajouter/retirer des athlètes, renommer, supprimer.
- Un athlète peut appartenir à plusieurs groupes (ex. « Gardiennes », « Groupe force », « Section sportive »).
- Les groupes sont propres à la catégorie et visibles par tout le staff de la catégorie.

Partout où l'on choisit des athlètes :
- Une ligne de pastilles de groupes au-dessus de la liste. Cliquer sur une pastille coche tous les athlètes du groupe (recliquer les décoche).
- Le bouton « Tous les athlètes » reste disponible.
- La sélection individuelle reste possible et se combine librement avec les groupes.

## Où ce sélecteur est mis à jour

- Convocation aux compétitions / événements
- Planification de tests
- Séances (terrain, musculation, séance simplifiée)
- Assignation de programmes
- Cycles de la vue annuelle

Générique : disponible pour toutes les disciplines.

## Détails techniques

Base de données (Lovable Cloud) :
- `player_groups` : id, category_id, name, color, created_by, created_at, unique (category_id, lower(name)).
- `player_group_members` : id, group_id (FK cascade), player_id (FK cascade), unique (group_id, player_id).
- GRANT select/insert/update/delete à `authenticated`, ALL à `service_role`.
- RLS : lecture pour tout utilisateur pouvant accéder à la catégorie (`can_access_category`) ; écriture réservée au staff pouvant modifier la catégorie (même fonction, exclusion des athlètes via `is_category_athlete`).

Front :
- `src/hooks/usePlayerGroups.ts` : lecture des groupes + membres (queryKey `["player-groups", categoryId]`), mutations create/rename/delete/setMembers avec invalidation.
- `src/components/category/players/PlayerGroupsManagerDialog.tsx` : gestion complète (liste des groupes, édition des membres via la liste d'effectif avec recherche).
- Bouton « Groupes » ajouté dans `EffectifTab.tsx` à côté du filtre saison.
- `src/components/category/players/PlayerGroupChips.tsx` : barre de pastilles réutilisable (props `categoryId`, `value`, `onChange`, `availableIds`) — coche/décoche l'union des membres du groupe présents dans la liste affichée ; état actif si tous les membres sont sélectionnés.
- Intégration des pastilles dans `AdvancedPlayerSelection.tsx`, `MatchParticipantsSelector.tsx`, `ScheduleTestDialog.tsx` et le sélecteur de participants des cycles, sans changer leurs API existantes (`value` / `onChange`).
- Zones verrouillées (création de séance athlète, RPE, Wellness) non touchées : seule la sélection staff est enrichie.

Vérification : `bunx tsgo --noEmit` puis contrôle visuel du sélecteur de convocation.
