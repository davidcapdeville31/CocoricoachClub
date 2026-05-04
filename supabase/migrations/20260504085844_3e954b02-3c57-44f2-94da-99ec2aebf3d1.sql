ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS cover_image_position text NOT NULL DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS header_background_url text;