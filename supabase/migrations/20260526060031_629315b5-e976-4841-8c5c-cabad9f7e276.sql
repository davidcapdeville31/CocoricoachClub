
ALTER TABLE public.wellness_question_configs
  ADD COLUMN IF NOT EXISTS pain_config jsonb;

ALTER TABLE public.wellness_tracking
  ADD COLUMN IF NOT EXISTS pain_nature text,
  ADD COLUMN IF NOT EXISTS pain_intensity integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wellness_tracking_pain_intensity_check'
  ) THEN
    ALTER TABLE public.wellness_tracking
      ADD CONSTRAINT wellness_tracking_pain_intensity_check
      CHECK (pain_intensity IS NULL OR (pain_intensity >= 1 AND pain_intensity <= 5));
  END IF;
END $$;
