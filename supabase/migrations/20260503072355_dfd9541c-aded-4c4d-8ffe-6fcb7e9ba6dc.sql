
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON public.categories(deleted_at) WHERE deleted_at IS NULL;
