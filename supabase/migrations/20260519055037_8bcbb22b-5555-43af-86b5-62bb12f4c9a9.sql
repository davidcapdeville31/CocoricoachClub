ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.competition_rounds ADD COLUMN IF NOT EXISTS video_url TEXT;