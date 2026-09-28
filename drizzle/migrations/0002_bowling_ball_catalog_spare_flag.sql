ALTER TABLE public.bowling_ball_catalog ADD COLUMN is_spare boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_bowling_ball_catalog_is_spare ON public.bowling_ball_catalog (is_spare) WHERE is_spare;
COMMENT ON COLUMN public.bowling_ball_catalog.is_spare IS 'True for generic spare balls (no brand)';