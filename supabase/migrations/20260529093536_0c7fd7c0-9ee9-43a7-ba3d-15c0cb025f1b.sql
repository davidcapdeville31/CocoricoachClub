ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS bowling_axe_deg smallint,
  ADD COLUMN IF NOT EXISTS bowling_tilt_deg smallint,
  ADD COLUMN IF NOT EXISTS bowling_ball_speed numeric(4,1);

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_bowling_axe_range,
  ADD CONSTRAINT players_bowling_axe_range CHECK (bowling_axe_deg IS NULL OR (bowling_axe_deg >= 0 AND bowling_axe_deg <= 90));

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_bowling_tilt_range,
  ADD CONSTRAINT players_bowling_tilt_range CHECK (bowling_tilt_deg IS NULL OR (bowling_tilt_deg >= -30 AND bowling_tilt_deg <= 30));