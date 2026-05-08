ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_round_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.athletics_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.athletics_sprint_attempts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.athletics_throwing_attempts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_type
ON public.notifications(user_id, is_read, notification_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_athletics_record_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_player_name TEXT;
  v_event_label TEXT;
  v_has_pb BOOLEAN := false;
  v_has_sb BOOLEAN := false;
  v_subtype TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  SELECT p.user_id, COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.name, ''))), ''), p.name, 'Athlète')
  INTO v_user_id, v_player_name
  FROM public.players p
  WHERE p.id = NEW.player_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_event_label := COALESCE(NEW.specialty, NEW.discipline, 'performance');

  IF TG_OP = 'INSERT' THEN
    v_has_pb := NEW.personal_best IS NOT NULL;
    v_has_sb := NEW.season_best IS NOT NULL;
  ELSE
    v_has_pb := NEW.personal_best IS DISTINCT FROM OLD.personal_best
      AND NEW.personal_best IS NOT NULL
      AND (
        OLD.personal_best IS NULL
        OR (NEW.lower_is_better AND NEW.personal_best < OLD.personal_best)
        OR (NOT NEW.lower_is_better AND NEW.personal_best > OLD.personal_best)
      );

    v_has_sb := NEW.season_best IS DISTINCT FROM OLD.season_best
      AND NEW.season_best IS NOT NULL
      AND (
        OLD.season_best IS NULL
        OR (NEW.lower_is_better AND NEW.season_best < OLD.season_best)
        OR (NOT NEW.lower_is_better AND NEW.season_best > OLD.season_best)
      );
  END IF;

  IF NOT v_has_pb AND NOT v_has_sb THEN
    RETURN NEW;
  END IF;

  v_subtype := CASE
    WHEN v_has_pb AND v_has_sb THEN 'personal_and_season_best'
    WHEN v_has_pb THEN 'personal_best'
    ELSE 'season_best'
  END;

  v_title := CASE
    WHEN v_has_pb AND v_has_sb THEN '🏆 Nouveau record personnel et de saison'
    WHEN v_has_pb THEN '🏆 Nouveau record personnel'
    ELSE '⭐ Nouveau record de saison'
  END;

  v_message := CASE
    WHEN v_has_pb AND v_has_sb THEN format('%s a battu ses records sur %s.', v_player_name, v_event_label)
    WHEN v_has_pb THEN format('%s a battu son record personnel sur %s.', v_player_name, v_event_label)
    ELSE format('%s a battu son record de saison sur %s.', v_player_name, v_event_label)
  END;

  INSERT INTO public.notifications (
    user_id,
    category_id,
    notification_type,
    notification_subtype,
    title,
    message,
    priority,
    metadata
  ) VALUES (
    v_user_id,
    NEW.category_id,
    'athlete_record',
    v_subtype,
    v_title,
    v_message,
    'high',
    jsonb_build_object(
      'player_id', NEW.player_id,
      'record_id', NEW.id,
      'discipline', NEW.discipline,
      'specialty', NEW.specialty,
      'personal_best', NEW.personal_best,
      'season_best', NEW.season_best,
      'unit', NEW.unit,
      'season_year', NEW.season_year,
      'is_personal_best', v_has_pb,
      'is_season_best', v_has_sb
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_athletics_record_update ON public.athletics_records;
CREATE TRIGGER trg_notify_athletics_record_update
AFTER INSERT OR UPDATE OF personal_best, season_best
ON public.athletics_records
FOR EACH ROW
EXECUTE FUNCTION public.notify_athletics_record_update();