## Contexte

Pour le bowling, on a déjà : (1) une cartographie cliquable côté staff (PrecisionFieldTracker), (2) un dialog "Ajouter un entraînement" côté athlète (`BowlingTrainingEntryDialog`), (3) un onglet "Datas d'entraînement" (BowlingTrainingStats), (4) une notification staff quand l'athlète termine sa saisie. La demande est de répliquer pour **toutes les disciplines basket** : `basketball`, `basketball_3x3`, `basketball_pro`, `basketball_jeunes`, `basketball_club`, `basketball_academie`, `basketball_national`.

Bonne nouvelle : la table `precision_training` (avec `zone_x`, `zone_y`, `attempts`, `successes`, `success_rate`, `exercise_label`, `player_id`, `category_id`, `session_date`, `training_session_id`) existe déjà et est utilisée par le rugby. On va donc la réutiliser et ajouter une cartographie SVG basket + UI dédiée.

## Étapes

### 1. SVG demi-terrain de basket cliquable
- Créer `src/components/basketball/BasketballHalfCourtSVG.tsx` :
  - SVG d'un demi-terrain (panier, raquette, ligne 3 pts, ligne médiane).
  - Coordonnées normalisées (0–100 sur chaque axe).
  - Props : `mode` ("free_throw" | "paint" | "three_point" | "all"), `onClick(x, y, zoneLabel)`, `points` (markers existants à afficher avec couleur réussite/échec).
  - Rendu visuel premium en cohérence avec le terrain rugby.

### 2. Constantes des exercices basket
- Créer `src/lib/constants/basketballPrecisionExercises.ts` :
  - 3 exercices : `free_throw` (Lancers francs), `paint_shot` (Tirs dans la raquette), `three_point` (Tirs à 3 points).
  - Helper `isBasketballPrecisionSport(sportType)` qui détecte tous les préfixes basket.

### 3. Composant tracker basket (équivalent PrecisionFieldTracker)
- Créer `src/components/basketball/BasketballPrecisionTracker.tsx` :
  - Sélecteur athlète + sélecteur exercice (dropdown : Lancers francs / Raquette / 3 pts).
  - Affiche le SVG basket. Sur clic d'une zone → dialog "Tentatives / Réussites" → enregistrement direct dans `precision_training`.
  - Sous le terrain : liste des saisies du jour + cartographie cumulée + filtre par période.
  - Bouton recap → réutilise `PrecisionTrainingStats` filtré sur les 3 exercices basket.

### 4. Intégration côté staff
- **`DatasTab.tsx`** : ajouter `isBasketballPrecisionSport` ; si vrai, rendre `BasketballPrecisionTracker` à la place de `PrecisionTrainingStats`.
- **Calendrier global → création séance terrain** : dans `SessionFormDialog`, le `PrecisionExerciseSelector` est déjà branché ; on ajoute une variante basket qui propose les 3 thématiques basket et bascule sur le SVG basket.
- **`SessionDetailsDialog` / `SessionFeedbackDialog`** : si sport basket, afficher `BasketballPrecisionTracker` au lieu de rugby.

### 5. Dialog athlète (équivalent BowlingTrainingEntryDialog)
- Créer `src/components/basketball/BasketballTrainingEntryDialog.tsx` :
  - Tab unique "Précision" : sélection thématique → SVG cliquable → champs Lancers/Réussis → calcul live du % → enregistrement.
  - Liste des exercices saisis aujourd'hui.
  - À l'enregistrement, écrit dans `precision_training` (player_id de l'athlète) + crée une `training_sessions` "auto-planifiée" (purple border) liée à la séance, **et insère une notification staff** (`notifications` table avec `notification_type = 'athlete_self_session'` et lien deep vers le calendrier global staff).

### 6. Espace athlète – bouton "+ ajouter un entraînement"
- **`AthleteSpaceCalendar.tsx`** : déjà branché bowling. Ajouter `isBasketballPrecisionSport` ; afficher le bouton "+ Ajouter un entraînement" qui ouvre `BasketballTrainingEntryDialog`.

### 7. Notification staff sur séance autonome athlète
- L'objectif : pour TOUTES disciplines (musculation ou entraînement spécifique), quand un athlète crée/termine sa séance dans son espace, le staff voit la séance détaillée dans le calendrier global ET reçoit une notif.
- Vérifier que l'edge function `athlete-create-session` insère bien dans `notifications` pour le staff (créer/étendre si besoin via une nouvelle migration ou un trigger DB).
- Ajouter un trigger DB : à l'`INSERT` d'une `precision_training` faite par un athlète (détecté via le créateur ou via un flag `created_by_athlete`), insérer une notification dans `notifications` pour le staff de la catégorie.

### 8. Migration DB
- Ajouter colonne `created_by_athlete BOOLEAN DEFAULT false` à `precision_training` (pour distinguer saisies athlète vs staff et déclencher la notif).
- Ajouter trigger `notify_staff_on_athlete_precision` qui insère une `notifications` row pour chaque membre staff de la catégorie quand un athlète saisit.

## Détails techniques

- Composants placés dans `src/components/basketball/`.
- Réutilise `precision_training`, `notifications`, `training_sessions`.
- Détection du sport via `(sportType || "").toLowerCase().startsWith("basketball")`.
- Aucune modif côté types Supabase manuelle (auto-régénérée après migration).
- RLS de `precision_training` : déjà OK pour staff ; pour les athlètes on passe par l'edge function `athlete-precision-training` (à créer, calquée sur `athlete-bowling-training`) qui bypass RLS et set `created_by_athlete = true`.

## Hors scope

- L'ajout des exercices de précision basket dans la **bibliothèque d'exercices générale** (déjà couvert par les `basketball_shooting/dribbling/...` existants).
- Tout changement dans les analytics globales (dashboards) au-delà de l'onglet "Datas d'entraînement".
