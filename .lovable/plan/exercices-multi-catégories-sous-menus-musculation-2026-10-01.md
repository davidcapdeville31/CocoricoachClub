# Exercices multi-catégories + sous-menus Musculation

## Objectif
1. Un exercice = une seule fiche (photo + vidéo), visible dans plusieurs catégories (ex. « Muscle-up » dans CrossFit ET Poids de corps/Gym).
2. Dans Musculation : sous-menus **Machines**, **Kettlebell**, **Haltères (dumbbell)**, **Poids de corps**, **Barres**, **Renforcement général** — un exercice pouvant être dans plusieurs.

## Ce que verra l'utilisateur
- Dans Admin club → Exercices (et la bibliothèque du programme), chaque catégorie liste aussi les exercices « partagés » ; la photo/vidéo ajoutée une fois apparaît partout.
- Dans la fiche d'un exercice : un champ « Catégories » (choix multiple) et, pour Musculation, « Matériel / sous-catégorie » (choix multiple).
- Dans Musculation : une rangée de boutons horizontaux pour filtrer par sous-catégorie.

## Fusion des doublons existants
- Détection par nom normalisé (minuscules, sans accents, pluriels, parenthèses, partie FR/EN avant/après « / ») : ex. « Muscle-up » / « Muscle-ups », « Dips », « Back squat », « Glute bridge », « Front squat »…
- Pour chaque groupe : on garde la fiche **qui a déjà photo + vidéo** (sinon celle qui en a le plus), on lui ajoute les catégories des autres.
- Les autres fiches ne sont pas supprimées (des programmes y font référence) : elles sont masquées de la bibliothèque et pointent vers la fiche principale, qui fournit photo/vidéo.
- Je te montrerai la liste des regroupements proposés avant de l'appliquer ; les variantes vraiment différentes (ex. Muscle-up barre vs anneaux) restent séparées.

## Attribution des sous-catégories Musculation
- Automatique d'après le nom et le matériel (machine, poulie, presse → Machines ; kettlebell/KB → Kettlebell ; haltère/dumbbell/DB → Haltères ; barre/barbell/squat/deadlift/développé → Barres ; sans matériel → Poids de corps ; gainage/prévention → Renforcement général).
- Modifiable ensuite à la main dans la fiche.

## Détails techniques
- Migration : `exercise_library` + colonnes `categories text[] default '{}'`, `subcategories text[] default '{}'`, `canonical_id uuid null` (FK self) ; backfill `categories = array[station_name]` ; index GIN.
- `get_merged_exercises_for_coach` : exclut les lignes avec `canonical_id`, renvoie `categories`/`subcategories`.
- Fusion et attribution via requêtes de données (après validation de la liste).
- Filtrage UI : `station_name = X` remplacé par `categories @> {X}` dans ExerciseLibrarySidebar, ExercisePicker, bibliothèque admin/super admin ; résolution media via `canonical_id` dans useExerciseMedia pour les anciennes références.
- `station_name` conservé pour compatibilité.
