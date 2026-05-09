-- Generic helper that creates a notification for an athlete when data is added on their behalf
CREATE OR REPLACE FUNCTION public.notify_athlete_data_added(
  _player_id uuid,
  _category_id uuid,
  _notification_type text,
  _title text,
  _message text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.players WHERE id = _player_id;
  IF v_user_id IS NULL THEN RETURN; END IF;
  -- Skip self-notifications (athlete added their own data)
  IF v_user_id = auth.uid() THEN RETURN; END IF;

  INSERT INTO public.notifications (
    user_id, category_id, notification_type, notification_subtype,
    title, message, priority, metadata
  ) VALUES (
    v_user_id, _category_id, _notification_type, NULL,
    _title, _message, 'normal',
    _metadata || jsonb_build_object('player_id', _player_id)
  );
END;
$$;

-- Helper: build athlete display name
CREATE OR REPLACE FUNCTION public._athlete_display_name(_player_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(first_name,''),' ',COALESCE(name,''))),''), name, 'Athlète')
  FROM public.players WHERE id = _player_id;
$$;

-- ============================================================
-- TEST trigger (works for jump/speed/strength/mobility/generic)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_notify_test_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
BEGIN
  v_label := CASE TG_TABLE_NAME
    WHEN 'jump_tests' THEN 'Test de détente'
    WHEN 'speed_tests' THEN 'Test de vitesse'
    WHEN 'strength_tests' THEN 'Test de force'
    WHEN 'mobility_tests' THEN 'Test de mobilité'
    WHEN 'generic_tests' THEN 'Nouveau test'
    ELSE 'Nouveau test'
  END;
  PERFORM public.notify_athlete_data_added(
    NEW.player_id, NEW.category_id, 'athlete_test',
    '🏃 ' || v_label || ' enregistré',
    'Un nouveau résultat de test a été ajouté à ton profil.',
    jsonb_build_object('table', TG_TABLE_NAME, 'test_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_jump_test ON public.jump_tests;
CREATE TRIGGER trg_notify_jump_test AFTER INSERT ON public.jump_tests
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_test_added();

DROP TRIGGER IF EXISTS trg_notify_speed_test ON public.speed_tests;
CREATE TRIGGER trg_notify_speed_test AFTER INSERT ON public.speed_tests
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_test_added();

DROP TRIGGER IF EXISTS trg_notify_strength_test ON public.strength_tests;
CREATE TRIGGER trg_notify_strength_test AFTER INSERT ON public.strength_tests
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_test_added();

DROP TRIGGER IF EXISTS trg_notify_mobility_test ON public.mobility_tests;
CREATE TRIGGER trg_notify_mobility_test AFTER INSERT ON public.mobility_tests
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_test_added();

DROP TRIGGER IF EXISTS trg_notify_generic_test ON public.generic_tests;
CREATE TRIGGER trg_notify_generic_test AFTER INSERT ON public.generic_tests
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_test_added();

-- ============================================================
-- TRAINING DATA trigger (gym_session_exercises = tonnage)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_notify_training_data_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_athlete_data_added(
    NEW.player_id, NEW.category_id, 'athlete_training_data',
    '🏋️ Donnée d''entraînement ajoutée',
    'Ton coach a ajouté une nouvelle donnée d''entraînement.',
    jsonb_build_object('table', TG_TABLE_NAME, 'row_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_gym_exercise ON public.gym_session_exercises;
CREATE TRIGGER trg_notify_gym_exercise AFTER INSERT ON public.gym_session_exercises
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_training_data_added();

-- ============================================================
-- COMPETITION DATA trigger (competition_rounds = match data)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_notify_competition_data_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify on INSERT, or on UPDATE when result-relevant fields change
  IF TG_OP = 'UPDATE' AND NEW.stat_data IS NOT DISTINCT FROM OLD.stat_data
     AND NEW.result IS NOT DISTINCT FROM OLD.result THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_athlete_data_added(
    NEW.player_id,
    (SELECT category_id FROM public.matches WHERE id = NEW.match_id),
    'athlete_competition_data',
    '🏆 Donnée de compétition ajoutée',
    'Ton coach a enregistré tes données de compétition.',
    jsonb_build_object('round_id', NEW.id, 'match_id', NEW.match_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_competition_round ON public.competition_rounds;
CREATE TRIGGER trg_notify_competition_round
AFTER INSERT OR UPDATE ON public.competition_rounds
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_competition_data_added();

-- Make sure realtime is on for the new tables (notifications already added previously)
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.jump_tests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.speed_tests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.strength_tests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mobility_tests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.generic_tests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.gym_session_exercises; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;