ALTER TABLE public.bowling_throw_results
  ADD COLUMN IF NOT EXISTS parameter_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS outcome_results jsonb NOT NULL DEFAULT '{}'::jsonb;