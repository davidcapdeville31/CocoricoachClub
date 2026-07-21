
CREATE OR REPLACE FUNCTION public.set_player_active_season()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_season_id uuid;
BEGIN
  IF NEW.season_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.club_id INTO v_club_id
  FROM public.categories c
  WHERE c.id = NEW.category_id;

  IF v_club_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.id INTO v_season_id
  FROM public.seasons s
  WHERE s.club_id = v_club_id AND s.is_active = true
  ORDER BY s.start_date DESC NULLS LAST
  LIMIT 1;

  IF v_season_id IS NOT NULL THEN
    NEW.season_id := v_season_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_player_active_season ON public.players;
CREATE TRIGGER trg_set_player_active_season
BEFORE INSERT ON public.players
FOR EACH ROW
EXECUTE FUNCTION public.set_player_active_season();

-- Backfill existing players missing a season
UPDATE public.players p
SET season_id = s.id
FROM public.categories c
JOIN public.seasons s ON s.club_id = c.club_id AND s.is_active = true
WHERE p.season_id IS NULL
  AND p.category_id = c.id;
