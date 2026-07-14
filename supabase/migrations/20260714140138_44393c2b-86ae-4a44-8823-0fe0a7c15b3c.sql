
CREATE OR REPLACE FUNCTION public.auto_enroll_player_in_future_tests(_player_id uuid, _category_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.event_participants (training_session_id, player_id, attendance_status)
  SELECT ts.id, _player_id, 'no_response'
  FROM public.training_sessions ts
  WHERE ts.category_id = _category_id
    AND ts.training_type = 'test'
    AND ts.session_date >= CURRENT_DATE
  ON CONFLICT (training_session_id, player_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_auto_enroll_player_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
    PERFORM public.auto_enroll_player_in_future_tests(NEW.player_id, NEW.category_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_enroll_tests_on_player_categories ON public.player_categories;
CREATE TRIGGER auto_enroll_tests_on_player_categories
AFTER INSERT OR UPDATE OF status ON public.player_categories
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_enroll_player_categories();

CREATE OR REPLACE FUNCTION public.trg_auto_enroll_players_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.category_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.category_id IS DISTINCT FROM NEW.category_id) THEN
    PERFORM public.auto_enroll_player_in_future_tests(NEW.id, NEW.category_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_enroll_tests_on_players ON public.players;
CREATE TRIGGER auto_enroll_tests_on_players
AFTER INSERT OR UPDATE OF category_id ON public.players
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_enroll_players_category();
