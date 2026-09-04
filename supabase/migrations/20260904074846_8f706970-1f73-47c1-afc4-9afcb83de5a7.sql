CREATE OR REPLACE FUNCTION public.compute_ewma_loads()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_prev_acute numeric;
  v_prev_chronic numeric;
  v_prev_date date;
  v_gap integer;
  v_acute numeric;
  v_chronic numeric;
  v_lambda_acute numeric := 2.0 / (7 + 1);
  v_lambda_chronic numeric := 2.0 / (28 + 1);
  v_day_load numeric;
  v_other_load numeric;
BEGIN
  v_day_load := COALESCE(NEW.training_load, COALESCE(NEW.rpe,0) * COALESCE(NEW.duration_minutes,0));

  -- Agrège les autres séances du même athlète le même jour
  SELECT COALESCE(SUM(COALESCE(t.training_load, COALESCE(t.rpe,0) * COALESCE(t.duration_minutes,0))), 0)
  INTO v_other_load
  FROM public.awcr_tracking t
  WHERE t.player_id = NEW.player_id
    AND t.session_date = NEW.session_date
    AND (NEW.id IS NULL OR t.id <> NEW.id);

  v_day_load := v_day_load + v_other_load;

  SELECT t.acute_load, t.chronic_load, t.session_date
  INTO v_prev_acute, v_prev_chronic, v_prev_date
  FROM public.awcr_tracking t
  WHERE t.player_id = NEW.player_id
    AND t.session_date < NEW.session_date
    AND t.acute_load IS NOT NULL
    AND t.chronic_load IS NOT NULL
  ORDER BY t.session_date DESC
  LIMIT 1;

  IF v_prev_acute IS NULL THEN
    v_acute := v_day_load;
    v_chronic := v_day_load;
  ELSE
    v_gap := GREATEST((NEW.session_date - v_prev_date) - 1, 0);
    -- Décroissance sur les jours de repos (charge nulle)
    v_acute := v_prev_acute * POWER(1 - v_lambda_acute, v_gap);
    v_chronic := v_prev_chronic * POWER(1 - v_lambda_chronic, v_gap);
    v_acute := v_lambda_acute * v_day_load + (1 - v_lambda_acute) * v_acute;
    v_chronic := v_lambda_chronic * v_day_load + (1 - v_lambda_chronic) * v_chronic;
  END IF;

  NEW.acute_load := ROUND(v_acute::numeric, 2);
  NEW.chronic_load := ROUND(v_chronic::numeric, 2);
  NEW.awcr := CASE WHEN v_chronic > 0 THEN ROUND((v_acute / v_chronic)::numeric, 4) ELSE NULL END;

  RETURN NEW;
END;
$$;