-- Helper function: tells whether a category's sport is a "team / collective" sport
-- where each athlete must have exactly one position.
CREATE OR REPLACE FUNCTION public.is_team_sport_category(_category_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.categories c
    WHERE c.id = _category_id
      AND (
        c.rugby_type IN (
          'XV','7','XIII','15','touch','academie','national_team',
          'football','handball','volleyball','basketball',
          'football_club','football_academie','football_national',
          'handball_club','handball_academie','handball_national',
          'volleyball_club','volleyball_academie','volleyball_national',
          'basketball_club','basketball_academie','basketball_national',
          'basketball_3x3','basketball_pro','basketball_jeunes'
        )
      )
  );
$$;

-- 1) Data cleanup : keep only ONE position per player whose primary category is a team sport.
WITH team_players AS (
  SELECT DISTINCT p.id AS player_id, p.category_id
  FROM public.players p
  WHERE public.is_team_sport_category(p.category_id)
),
ranked AS (
  SELECT
    aa.id,
    aa.player_id,
    ROW_NUMBER() OVER (
      PARTITION BY aa.player_id
      ORDER BY aa.is_primary DESC, aa.weight DESC NULLS LAST, aa.updated_at DESC NULLS LAST, aa.created_at DESC
    ) AS rn
  FROM public.athlete_attributes aa
  JOIN team_players tp ON tp.player_id = aa.player_id
  WHERE aa.dimension = 'position'
)
DELETE FROM public.athlete_attributes
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Make sure remaining single rows are flagged primary (cosmetic but coherent).
WITH team_players AS (
  SELECT DISTINCT p.id AS player_id
  FROM public.players p
  WHERE public.is_team_sport_category(p.category_id)
)
UPDATE public.athlete_attributes aa
SET is_primary = true, weight = NULL
FROM team_players tp
WHERE aa.player_id = tp.player_id
  AND aa.dimension = 'position'
  AND aa.is_primary = false;

-- 2) Trigger : enforce single-position rule for team sports going forward.
CREATE OR REPLACE FUNCTION public.enforce_single_position_team_sport()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id uuid;
  v_existing_count integer;
BEGIN
  IF NEW.dimension <> 'position' THEN
    RETURN NEW;
  END IF;

  SELECT category_id INTO v_category_id
  FROM public.players
  WHERE id = NEW.player_id;

  IF v_category_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_team_sport_category(v_category_id) THEN
    RETURN NEW;
  END IF;

  -- Count other position rows for this athlete (excluding the row being upserted).
  SELECT COUNT(*) INTO v_existing_count
  FROM public.athlete_attributes
  WHERE player_id = NEW.player_id
    AND dimension = 'position'
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_existing_count >= 1 THEN
    RAISE EXCEPTION 'Un athlète d''un sport collectif ne peut avoir qu''un seul poste. Modifie ou supprime le poste existant avant d''en ajouter un nouveau.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Force the single position to be marked primary.
  NEW.is_primary := true;
  NEW.weight := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_position_team_sport ON public.athlete_attributes;
CREATE TRIGGER trg_enforce_single_position_team_sport
BEFORE INSERT OR UPDATE ON public.athlete_attributes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_position_team_sport();