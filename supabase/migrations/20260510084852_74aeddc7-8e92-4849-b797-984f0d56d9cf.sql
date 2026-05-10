ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS tournament_level text;

CREATE INDEX IF NOT EXISTS idx_matches_tournament_level
  ON public.matches (category_id, tournament_level);
