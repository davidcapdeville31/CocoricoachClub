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
  v_planned_rpe integer;
  v_actor_user_id uuid;
  v_target_user_ids uuid[];
  v_user_id uuid;
BEGIN
  IF NEW.training_session_id IS NULL OR NEW.auto_filled THEN
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

  SELECT ts.training_type, ts.session_date, COALESCE(ts.planned_intensity, ts.intensity)
  INTO v_training_type, v_session_date, v_planned_rpe
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
        'Nouveau RPE athlète',
        format(
          '%s · RPE saisi : %s/10 · Objectif : %s%s',
          v_player_name,
          NEW.rpe,
          CASE WHEN v_planned_rpe IS NULL THEN 'non défini' ELSE v_planned_rpe::text || '/10' END,
          CASE WHEN v_session_date IS NOT NULL THEN ' · ' || to_char(v_session_date, 'DD/MM/YYYY') ELSE '' END
        ),
        false, 'normal',
        jsonb_build_object(
          'session_id', NEW.training_session_id,
          'player_id', NEW.player_id,
          'rpe', NEW.rpe,
          'planned_rpe', v_planned_rpe,
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