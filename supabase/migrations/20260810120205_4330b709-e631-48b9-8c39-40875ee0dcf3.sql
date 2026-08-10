
ALTER TABLE public.wellness_tracking ADD COLUMN IF NOT EXISTS auto_filled boolean NOT NULL DEFAULT false;
ALTER TABLE public.awcr_tracking ADD COLUMN IF NOT EXISTS auto_filled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.category_staff_user_ids(_category_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT DISTINCT target_user_id FROM (
      SELECT cl.user_id AS target_user_id
      FROM public.categories c
      JOIN public.clubs cl ON cl.id = c.club_id
      WHERE c.id = _category_id
      UNION
      SELECT cm.user_id
      FROM public.category_members cm
      WHERE cm.category_id = _category_id
        AND cm.role IN ('admin','coach','prepa_physique','administratif')
      UNION
      SELECT clubm.user_id
      FROM public.categories c
      JOIN public.club_members clubm ON clubm.club_id = c.club_id
      WHERE c.id = _category_id
        AND clubm.role IN ('admin','coach','administratif')
        AND (clubm.assigned_categories IS NULL OR _category_id = ANY(clubm.assigned_categories))
    ) r
    WHERE target_user_id IS NOT NULL
  );
$$;

-- Wellness submitted by athlete -> notify staff
CREATE OR REPLACE FUNCTION public.notify_staff_athlete_wellness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_name text;
  v_actor_user_id uuid;
  v_targets uuid[];
  v_user_id uuid;
BEGIN
  IF NEW.auto_filled THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.first_name,''),' ',COALESCE(p.name,''))),''), p.name, 'Athlète'), p.user_id
  INTO v_player_name, v_actor_user_id
  FROM public.players p WHERE p.id = NEW.player_id;

  -- Staff entering data on behalf of an athlete should not trigger the alert
  IF auth.uid() IS NOT NULL AND v_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  v_targets := public.category_staff_user_ids(NEW.category_id);
  IF v_targets IS NULL OR array_length(v_targets,1) IS NULL THEN RETURN NEW; END IF;

  FOREACH v_user_id IN ARRAY v_targets LOOP
    IF v_actor_user_id IS NULL OR v_user_id <> v_actor_user_id THEN
      INSERT INTO public.notifications (user_id, category_id, notification_type, notification_subtype, title, message, is_read, priority, metadata)
      VALUES (
        v_user_id, NEW.category_id, 'wellness_submitted', NULL,
        'Wellness renseigné',
        format('%s a renseigné son wellness du %s.', v_player_name, to_char(NEW.tracking_date,'DD/MM/YYYY')),
        false,
        CASE WHEN NEW.has_specific_pain THEN 'high' ELSE 'normal' END,
        jsonb_build_object('player_id', NEW.player_id, 'tracking_date', NEW.tracking_date, 'has_specific_pain', NEW.has_specific_pain)
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_staff_athlete_wellness ON public.wellness_tracking;
CREATE TRIGGER trg_notify_staff_athlete_wellness
AFTER INSERT ON public.wellness_tracking
FOR EACH ROW EXECUTE FUNCTION public.notify_staff_athlete_wellness();

-- Test result submitted by athlete -> notify staff
CREATE OR REPLACE FUNCTION public.notify_staff_athlete_test_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_name text;
  v_actor_user_id uuid;
  v_targets uuid[];
  v_user_id uuid;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.first_name,''),' ',COALESCE(p.name,''))),''), p.name, 'Athlète'), p.user_id
  INTO v_player_name, v_actor_user_id
  FROM public.players p WHERE p.id = NEW.player_id;

  v_targets := public.category_staff_user_ids(NEW.category_id);
  IF v_targets IS NULL OR array_length(v_targets,1) IS NULL THEN RETURN NEW; END IF;

  FOREACH v_user_id IN ARRAY v_targets LOOP
    IF v_actor_user_id IS NULL OR v_user_id <> v_actor_user_id THEN
      INSERT INTO public.notifications (user_id, category_id, notification_type, notification_subtype, title, message, is_read, priority, metadata)
      VALUES (
        v_user_id, NEW.category_id, 'test_result_submitted', NEW.test_category,
        'Résultat de test à valider',
        format('%s a enregistré un résultat (%s%s) le %s.', v_player_name, COALESCE(NEW.test_type,'test'),
               CASE WHEN NEW.result_value IS NOT NULL THEN ' : ' || NEW.result_value::text || COALESCE(' ' || NEW.result_unit,'') ELSE '' END,
               to_char(NEW.test_date,'DD/MM/YYYY')),
        false, 'normal',
        jsonb_build_object('player_id', NEW.player_id, 'pending_test_id', NEW.id, 'test_type', NEW.test_type, 'test_date', NEW.test_date)
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_staff_athlete_test_result ON public.pending_test_results;
CREATE TRIGGER trg_notify_staff_athlete_test_result
AFTER INSERT ON public.pending_test_results
FOR EACH ROW EXECUTE FUNCTION public.notify_staff_athlete_test_result();

-- Avoid false "session feedback" notifications from the 23h auto-fill
CREATE OR REPLACE FUNCTION public.notify_staff_athlete_session_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_player_name text;
  v_training_type text;
  v_session_date date;
  v_actor_user_id uuid;
  v_target_user_ids uuid[];
  v_user_id uuid;
BEGIN
  IF NEW.training_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.auto_filled THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.rpe IS NOT DISTINCT FROM OLD.rpe
     AND NEW.duration_minutes IS NOT DISTINCT FROM OLD.duration_minutes
     AND NEW.post_session_feeling IS NOT DISTINCT FROM OLD.post_session_feeling
     AND NEW.post_session_notes IS NOT DISTINCT FROM OLD.post_session_notes THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.name, ''))), ''), p.name, 'Athlète'),
    p.user_id
  INTO v_player_name, v_actor_user_id
  FROM public.players p
  WHERE p.id = NEW.player_id;

  IF auth.uid() IS NOT NULL AND v_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  SELECT ts.training_type, ts.session_date
  INTO v_training_type, v_session_date
  FROM public.training_sessions ts
  WHERE ts.id = NEW.training_session_id;

  SELECT ARRAY(
    SELECT unnest(public.category_staff_user_ids(NEW.category_id))
    EXCEPT
    SELECT v_actor_user_id WHERE v_actor_user_id IS NOT NULL
  ) INTO v_target_user_ids;

  IF v_target_user_ids IS NULL OR array_length(v_target_user_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH v_user_id IN ARRAY v_target_user_ids LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = v_user_id
        AND n.category_id = NEW.category_id
        AND n.notification_type = 'session_feedback'
        AND n.is_read = false
        AND n.metadata->>'session_id' = NEW.training_session_id::text
        AND n.metadata->>'player_id' = NEW.player_id::text
    ) THEN
      INSERT INTO public.notifications (
        user_id, category_id, notification_type, notification_subtype,
        title, message, is_read, priority, metadata
      ) VALUES (
        v_user_id, NEW.category_id, 'session_feedback', COALESCE(v_training_type, 'session'),
        'Retour séance reçu',
        format('%s a renseigné son retour de séance%s.', v_player_name, CASE WHEN v_session_date IS NOT NULL THEN ' du ' || to_char(v_session_date, 'DD/MM/YYYY') ELSE '' END),
        false, 'normal',
        jsonb_build_object(
          'session_id', NEW.training_session_id,
          'player_id', NEW.player_id,
          'rpe', NEW.rpe,
          'duration_minutes', NEW.duration_minutes,
          'post_session_feeling', NEW.post_session_feeling,
          'training_type', v_training_type,
          'session_date', v_session_date
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;
