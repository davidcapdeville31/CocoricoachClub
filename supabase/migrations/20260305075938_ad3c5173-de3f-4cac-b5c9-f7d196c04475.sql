-- Add optional club_id to pdf_settings for club-level PDF configuration
ALTER TABLE public.pdf_settings ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE;

-- Make category_id nullable since club-level settings won't have one
ALTER TABLE public.pdf_settings ALTER COLUMN category_id DROP NOT NULL;

-- Add a unique constraint for club-level settings
CREATE UNIQUE INDEX IF NOT EXISTS pdf_settings_club_id_unique ON public.pdf_settings(club_id) WHERE club_id IS NOT NULL AND category_id IS NULL;