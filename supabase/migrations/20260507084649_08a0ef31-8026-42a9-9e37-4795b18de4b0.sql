-- Add flag to know when an athlete created the precision entry (used for staff notifications)
ALTER TABLE public.precision_training
  ADD COLUMN IF NOT EXISTS created_by_athlete BOOLEAN NOT NULL DEFAULT false;

-- Trigger function: notify staff of the category when an athlete logs a precision exercise
CREATE OR REPLACE FUNCTION public.notify_staff_on_athlete_precision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_name text;
  v_club_id uuid;
  v_category_name text;
BEGIN
  IF NEW.created_by_athlete IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, name)), ''), 'Un athlète')
    INTO v_player_name
  FROM public.players WHERE id = NEW.player_id;

  SELECT c.club_id, c.name INTO v_club_id, v_category_name
  FROM public.categories c WHERE c.id = NEW.category_id;

  -- Owner of the club
  INSERT INTO public.notifications (user_id, category_id, notification_type, notification_subtype, title, message, priority, metadata)
  SELECT cl.user_id, NEW.category_id, 'athlete_self_session', 'precision_training',
         'Nouvelle séance de précision',
         v_player_name || ' a enregistré un exercice de précision (' || NEW.exercise_label || ') le ' || NEW.session_date::text,
         'normal',
         jsonb_build_object('player_id', NEW.player_id, 'precision_id', NEW.id, 'exercise_label', NEW.exercise_label, 'session_date', NEW.session_date)
  FROM public.clubs cl WHERE cl.id = v_club_id AND cl.user_id IS NOT NULL;

  -- Staff members of the category (admin, coach, physio, doctor)
  INSERT INTO public.notifications (user_id, category_id, notification_type, notification_subtype, title, message, priority, metadata)
  SELECT cm.user_id, NEW.category_id, 'athlete_self_session', 'precision_training',
         'Nouvelle séance de précision',
         v_player_name || ' a enregistré un exercice de précision (' || NEW.exercise_label || ') le ' || NEW.session_date::text,
         'normal',
         jsonb_build_object('player_id', NEW.player_id, 'precision_id', NEW.id, 'exercise_label', NEW.exercise_label, 'session_date', NEW.session_date)
  FROM public.club_members cm
  WHERE cm.club_id = v_club_id
    AND cm.role IN ('admin','coach','physio','doctor');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_staff_athlete_precision ON public.precision_training;
CREATE TRIGGER trg_notify_staff_athlete_precision
AFTER INSERT ON public.precision_training
FOR EACH ROW
EXECUTE FUNCTION public.notify_staff_on_athlete_precision();