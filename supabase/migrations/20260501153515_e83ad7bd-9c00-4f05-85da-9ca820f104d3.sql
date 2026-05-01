-- Ajout des colonnes de compatibilité (anciens noms utilisés dans le reste de l'app)
ALTER TABLE public.exercise_library
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS youtube_url TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS muscle_groups TEXT[],
  ADD COLUMN IF NOT EXISTS difficulty TEXT;

-- Trigger de synchronisation bidirectionnelle des champs alias
CREATE OR REPLACE FUNCTION public.sync_exercise_library_aliases()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- name <-> exercise_name
  IF NEW.exercise_name IS NOT NULL AND (NEW.name IS NULL OR NEW.name = '') THEN
    NEW.name := NEW.exercise_name;
  ELSIF NEW.name IS NOT NULL AND (NEW.exercise_name IS NULL OR NEW.exercise_name = '') THEN
    NEW.exercise_name := NEW.name;
  END IF;

  -- category <-> station_name
  IF NEW.station_name IS NOT NULL AND (NEW.category IS NULL OR NEW.category = '') THEN
    NEW.category := NEW.station_name;
  ELSIF NEW.category IS NOT NULL AND (NEW.station_name IS NULL OR NEW.station_name = '') THEN
    NEW.station_name := NEW.category;
  END IF;

  -- youtube_url <-> video_url
  IF NEW.video_url IS NOT NULL AND NEW.youtube_url IS NULL THEN
    NEW.youtube_url := NEW.video_url;
  ELSIF NEW.youtube_url IS NOT NULL AND NEW.video_url IS NULL THEN
    NEW.video_url := NEW.youtube_url;
  END IF;

  -- is_system <-> is_default
  IF NEW.is_default IS NOT NULL THEN
    NEW.is_system := NEW.is_default;
  END IF;

  -- user_id <-> coach_id
  IF NEW.coach_id IS NOT NULL AND NEW.user_id IS NULL THEN
    NEW.user_id := NEW.coach_id;
  ELSIF NEW.user_id IS NOT NULL AND NEW.coach_id IS NULL THEN
    NEW.coach_id := NEW.user_id;
  END IF;

  -- muscle_groups <-> muscles
  IF NEW.muscles IS NOT NULL AND NEW.muscle_groups IS NULL THEN
    NEW.muscle_groups := NEW.muscles;
  ELSIF NEW.muscle_groups IS NOT NULL AND NEW.muscles IS NULL THEN
    NEW.muscles := NEW.muscle_groups;
  END IF;

  -- difficulty <-> difficulty_level
  IF NEW.difficulty_level IS NOT NULL AND NEW.difficulty IS NULL THEN
    NEW.difficulty := NEW.difficulty_level;
  ELSIF NEW.difficulty IS NOT NULL AND NEW.difficulty_level IS NULL THEN
    NEW.difficulty_level := NEW.difficulty;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_exercise_library_aliases_trigger ON public.exercise_library;
CREATE TRIGGER sync_exercise_library_aliases_trigger
  BEFORE INSERT OR UPDATE ON public.exercise_library
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_exercise_library_aliases();