-- Add is_finalized column to matches table
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.matches.is_finalized IS 'Indicates if the match/competition has been finalized and stats are complete';