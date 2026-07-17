ALTER TABLE public.benchmarks
  ADD COLUMN IF NOT EXISTS gender_filter text NULL;

COMMENT ON COLUMN public.benchmarks.gender_filter IS
  'Filtre sexe: male, female, ou NULL (tous). Combinable avec filter_type=position.';