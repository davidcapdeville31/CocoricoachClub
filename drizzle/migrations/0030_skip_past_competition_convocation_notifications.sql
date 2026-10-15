CREATE OR REPLACE FUNCTION public.notify_match_participant_convocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_match record;
BEGIN
  SELECT user_id INTO v_user_id FROM public.players WHERE id = NEW.player_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT m.id, m.category_id, m.opponent, m.match_date, m.match_time, m.end_date
    INTO v_match FROM public.matches m WHERE m.id = NEW.match_id;
  IF v_match IS NULL THEN RETURN NEW; END IF;

  -- No attendance request for competitions that are already over
  -- (e.g. recording past participants after the event).
  IF COALESCE(v_match.end_date, v_match.match_date) < current_date THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, category_id, notification_type, notification_subtype, title, message, metadata, priority)
  VALUES (
    v_user_id,
    v_match.category_id,
    'match_convocation',
    'convocation',
    'Convocation compétition',
    'Tu es convoqué(e) pour ' || COALESCE(NULLIF(v_match.opponent, ''), 'une compétition')
      || ' le ' || to_char(v_match.match_date, 'DD/MM/YYYY')
      || COALESCE(' à ' || to_char(v_match.match_time, 'HH24:MI'), '')
      || '. Merci d''indiquer ta présence.',
    jsonb_build_object('match_id', v_match.id, 'player_id', NEW.player_id),
    'high'
  );
  RETURN NEW;
END;
$function$;