-- V2 program builder: ajout des colonnes pour stocker les configurations
-- des nouvelles méthodes d'intensification (Cluster, Rest-Pause, Fartlek,
-- Intermittent, StatoDyn, Pyramid, AMRAP/EMOM/Tabata/ForTime/DeathBy,
-- Bulgarian, Combine haltero) et les liens entre exercices chaînés.

ALTER TABLE public.gym_session_exercises
  ADD COLUMN IF NOT EXISTS method_config jsonb,
  ADD COLUMN IF NOT EXISTS linked_group_id text,
  ADD COLUMN IF NOT EXISTS variable_sets jsonb,
  ADD COLUMN IF NOT EXISTS rest_pause_config jsonb,
  ADD COLUMN IF NOT EXISTS fartlek_config jsonb,
  ADD COLUMN IF NOT EXISTS intermittent_config jsonb,
  ADD COLUMN IF NOT EXISTS stato_dynamique_config jsonb,
  ADD COLUMN IF NOT EXISTS weightlifting_position text;

CREATE INDEX IF NOT EXISTS idx_gym_session_exercises_linked_group
  ON public.gym_session_exercises(linked_group_id)
  WHERE linked_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gym_session_exercises_method
  ON public.gym_session_exercises(method)
  WHERE method IS NOT NULL;