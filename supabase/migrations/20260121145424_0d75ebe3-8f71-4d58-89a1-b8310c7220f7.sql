-- Add discipline column to players table for athletics discipline selection
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS discipline TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN public.players.discipline IS 'Athletics discipline for athletes in athletics categories (e.g., athletisme_sprints, athletisme_lancers)';