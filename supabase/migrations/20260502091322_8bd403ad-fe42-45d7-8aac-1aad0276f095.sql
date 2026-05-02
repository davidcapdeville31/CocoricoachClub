-- Convertit les valeurs sleep_duration > 5 (saisies en heures par erreur via l'espace athlète)
-- vers le score 1-5 cohérent avec le reste de l'application.
-- Échelle: >=8h => 1, 7h => 2, 6h => 3, 5h => 4, <5h => 5
UPDATE public.wellness_tracking
SET sleep_duration = CASE
  WHEN sleep_duration >= 8 THEN 1
  WHEN sleep_duration = 7 THEN 2
  WHEN sleep_duration = 6 THEN 3
  ELSE sleep_duration
END
WHERE sleep_duration > 5;