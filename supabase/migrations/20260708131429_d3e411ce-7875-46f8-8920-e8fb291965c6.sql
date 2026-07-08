CREATE OR REPLACE FUNCTION public.notify_staff_on_athlete_attendance_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_club_id uuid;
  v_category_name text;
  v_player_name text;
  v_session_label text;
  v_date_label text;
  v_title text;
  v_message text;
  v_subtype text;
BEGIN
  IF NEW.attendance_status = 'no_response' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.attendance_status = OLD.attendance_status
     AND COALESCE(NEW.absence_comment, '') = COALESCE(OLD.absence_comment, '') THEN
    RETURN NEW;
  END IF;

  SELECT ts.id, ts.category_id, ts.session_date, ts.session_start_time,
         COALESCE(NULLIF(ts.training_type, ''), 'Séance') AS training_type
    INTO v_session
  FROM public.training_sessions ts
  WHERE ts.id = NEW.training_session_id;

  IF v_session.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.club_id, c.name INTO v_club_id, v_category_name
  FROM public.categories c WHERE c.id = v_session.category_id;

  SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, name)), ''), 'Un athlète')
    INTO v_player_name
  FROM public.players WHERE id = NEW.player_id;

  v_session_label := COALESCE(NULLIF(v_session.training_type, ''), 'Séance');
  v_date_label := to_char(v_session.session_date, 'DD/MM/YYYY');

  IF NEW.attendance_status = 'present' THEN
    v_subtype := 'attendance_present';
    v_title := 'Présence confirmée';
    v_message := v_player_name || ' a confirmé sa présence à la séance ' || v_session_label || ' du ' || v_date_label || '.';
  ELSE
    v_subtype := 'attendance_absent';
    v_title := 'Absence signalée';
    v_message := v_player_name || ' a indiqué être absent à la séance ' || v_session_label || ' du ' || v_date_label || '.';
    IF NEW.absence_comment IS NOT NULL AND LENGTH(TRIM(NEW.absence_comment)) > 0 THEN
      v_message := v_message || ' Motif : ' || NEW.absence_comment;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, category_id, notification_type, notification_subtype, title, message, priority, metadata)
  SELECT cl.user_id, v_session.category_id, 'athlete_attendance_response', v_subtype,
         v_title, v_message, 'normal',
         jsonb_build_object(
           'player_id', NEW.player_id,
           'training_session_id', v_session.id,
           'session_date', v_session.session_date,
           'attendance_status', NEW.attendance_status,
           'absence_comment', NEW.absence_comment
         )
  FROM public.clubs cl
  WHERE cl.id = v_club_id
    AND cl.user_id IS NOT NULL;

  INSERT INTO public.notifications (user_id, category_id, notification_type, notification_subtype, title, message, priority, metadata)
  SELECT DISTINCT cm.user_id, v_session.category_id, 'athlete_attendance_response', v_subtype,
         v_title, v_message, 'normal',
         jsonb_build_object(
           'player_id', NEW.player_id,
           'training_session_id', v_session.id,
           'session_date', v_session.session_date,
           'attendance_status', NEW.attendance_status,
           'absence_comment', NEW.absence_comment
         )
  FROM public.club_members cm
  WHERE cm.club_id = v_club_id
    AND cm.role IN ('admin','coach','physio','doctor')
    AND cm.user_id IS NOT NULL;

  RETURN NEW;
END;
$$;