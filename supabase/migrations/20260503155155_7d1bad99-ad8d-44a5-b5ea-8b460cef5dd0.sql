ALTER TABLE public.precision_training
  ADD COLUMN IF NOT EXISTS validated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_precision_training_validated
  ON public.precision_training(validated, session_date);

CREATE OR REPLACE FUNCTION public.auto_validate_precision_training()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.precision_training pt
    SET validated = true,
        validated_at = now()
    FROM public.categories c
    LEFT JOIN public.clubs cl ON cl.id = c.club_id
    WHERE pt.category_id = c.id
      AND pt.validated = false
      AND pt.session_date <= (now() AT TIME ZONE COALESCE(cl.timezone, 'Europe/Paris'))::date
    RETURNING pt.id
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;