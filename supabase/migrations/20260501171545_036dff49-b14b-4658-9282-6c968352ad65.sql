ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS method_config jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS coach_precision text;