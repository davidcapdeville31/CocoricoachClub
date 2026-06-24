CREATE OR REPLACE FUNCTION public.notify_staff_athlete_session_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- If a signed-in staff user edits the row, do not notify coaches as if it were athlete feedback.
  -- Service-role/token flows have auth.uid() NULL, so they still notify for athlete portal submissions.
  IF auth.uid() IS NOT NULL AND v_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  SELECT ts.training_type, ts.session_date
  INTO v_training_type, v_session_date
  FROM public.training_sessions ts
  WHERE ts.id = NEW.training_session_id;

  SELECT ARRAY(
    SELECT DISTINCT target_user_id
    FROM (
      SELECT cl.user_id AS target_user_id
      FROM public.categories c
      JOIN public.clubs cl ON cl.id = c.club_id
      WHERE c.id = NEW.category_id

      UNION

      SELECT cm.user_id AS target_user_id
      FROM public.category_members cm
      WHERE cm.category_id = NEW.category_id
        AND cm.role IN ('admin', 'coach', 'prepa_physique', 'administratif')

      UNION

      SELECT clubm.user_id AS target_user_id
      FROM public.categories c
      JOIN public.club_members clubm ON clubm.club_id = c.club_id
      WHERE c.id = NEW.category_id
        AND clubm.role IN ('admin', 'coach', 'administratif')
        AND (clubm.assigned_categories IS NULL OR NEW.category_id = ANY(clubm.assigned_categories))
    ) recipients
    WHERE target_user_id IS NOT NULL
      AND (v_actor_user_id IS NULL OR target_user_id <> v_actor_user_id)
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
        user_id,
        category_id,
        notification_type,
        notification_subtype,
        title,
        message,
        is_read,
        priority,
        metadata
      ) VALUES (
        v_user_id,
        NEW.category_id,
        'session_feedback',
        COALESCE(v_training_type, 'session'),
        'Retour séance reçu',
        format('%s a renseigné son retour de séance%s.', v_player_name, CASE WHEN v_session_date IS NOT NULL THEN ' du ' || to_char(v_session_date, 'DD/MM/YYYY') ELSE '' END),
        false,
        'normal',
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
$$;