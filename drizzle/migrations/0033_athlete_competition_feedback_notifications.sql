ALTER TABLE public.player_match_stats ADD COLUMN athlete_feedback text;
COMMENT ON COLUMN public.player_match_stats.athlete_feedback IS 'Personal competition feedback authored by the athlete and readable through existing staff access.';
CREATE OR REPLACE FUNCTION public.notify_staff_athlete_match_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_category uuid; v_name text; v_opponent text; v_target uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_player_owner(auth.uid(), NEW.player_id) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'id' - 'created_at') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'id' - 'created_at') THEN RETURN NEW; END IF;
  SELECT m.category_id, m.opponent INTO v_category, v_opponent FROM public.matches m WHERE m.id = NEW.match_id;
  SELECT COALESCE(NULLIF(trim(concat(p.first_name, ' ', p.name)), ''), 'Athlète') INTO v_name FROM public.players p WHERE p.id = NEW.player_id;
  FOREACH v_target IN ARRAY public.category_staff_user_ids(v_category) LOOP
    IF v_target = auth.uid() THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = v_target AND n.category_id = v_category AND n.notification_type = 'match_stats_submission' AND n.is_read = false AND n.metadata->>'match_id' = NEW.match_id::text AND n.metadata->>'player_id' = NEW.player_id::text) THEN
      INSERT INTO public.notifications(user_id, category_id, notification_type, title, message, is_read, metadata)
      VALUES (v_target, v_category, 'match_stats_submission', 'Nouvelles statistiques athlète', format('%s a renseigné ses statistiques et son retour de compétition · %s', v_name, COALESCE(v_opponent, 'Compétition')), false, jsonb_build_object('match_id', NEW.match_id, 'player_id', NEW.player_id));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_staff_athlete_match_stats() FROM PUBLIC;
CREATE TRIGGER trg_notify_staff_athlete_match_stats AFTER INSERT OR UPDATE ON public.player_match_stats FOR EACH ROW EXECUTE FUNCTION public.notify_staff_athlete_match_stats();