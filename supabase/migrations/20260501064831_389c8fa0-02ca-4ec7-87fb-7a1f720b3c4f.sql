ALTER TABLE public.players ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.players ADD CONSTRAINT players_gender_check CHECK (gender IS NULL OR gender IN ('male','female','other'));