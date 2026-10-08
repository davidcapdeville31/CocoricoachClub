CREATE OR REPLACE FUNCTION public.notify_event_participant_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid; v_s record; v_label text;
BEGIN
  SELECT user_id INTO v_user FROM public.players WHERE id = NEW.player_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  SELECT id, category_id, session_date, session_start_time, training_type, created_by_player_id
    INTO v_s FROM public.training_sessions WHERE id = NEW.training_session_id;
  IF v_s IS NULL OR v_s.session_date < current_date OR v_s.created_by_player_id = NEW.player_id THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.notifications WHERE user_id = v_user AND notification_type = 'session_assignment'
             AND metadata->>'session_id' = v_s.id::text) THEN RETURN NEW; END IF;
  v_label := CASE v_s.training_type WHEN 'gym' THEN 'Musculation' WHEN 'physical' THEN 'Préparation physique'
    WHEN 'video' THEN 'Analyse vidéo' WHEN 'technical' THEN 'Technique' WHEN 'tactical' THEN 'Tactique'
    WHEN 'collective' THEN 'Collectif' WHEN 'recovery' THEN 'Récupération' ELSE 'Séance' END;
  INSERT INTO public.notifications (user_id, category_id, notification_type, notification_subtype, title, message, metadata, priority)
  VALUES (v_user, v_s.category_id, 'session_assignment', v_s.training_type, 'Nouvel événement 📅',
    'Tu es convoqué(e) : ' || v_label || ' le ' || to_char(v_s.session_date, 'DD/MM/YYYY')
      || COALESCE(' à ' || to_char(v_s.session_start_time, 'HH24:MI'), '') || '.',
    jsonb_build_object('session_id', v_s.id, 'player_id', NEW.player_id), 'normal');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_event_participant_assignment ON public.event_participants;
CREATE TRIGGER trg_notify_event_participant_assignment AFTER INSERT ON public.event_participants
FOR EACH ROW EXECUTE FUNCTION public.notify_event_participant_assignment();

CREATE OR REPLACE FUNCTION public.push_assignment_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_token text;
BEGIN
  SELECT token INTO v_token FROM public.cron_tokens LIMIT 1;
  IF v_token IS NULL THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := 'https://mbloebaovvvgfwxsdzgo.supabase.co/functions/v1/push-from-notification',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', v_token),
    body := jsonb_build_object('notification_id', NEW.id));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_push_assignment_notification ON public.notifications;
CREATE TRIGGER trg_push_assignment_notification AFTER INSERT ON public.notifications
FOR EACH ROW WHEN (NEW.notification_type IN ('session_assignment','match_convocation'))
EXECUTE FUNCTION public.push_assignment_notification();