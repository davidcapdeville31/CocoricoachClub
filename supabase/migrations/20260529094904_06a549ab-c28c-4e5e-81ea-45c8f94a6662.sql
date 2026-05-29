ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS bowling_ball_weight_lbs smallint,
  ADD COLUMN IF NOT EXISTS bowling_rpm smallint,
  ADD COLUMN IF NOT EXISTS bowling_pap_h_inch numeric(4,2),
  ADD COLUMN IF NOT EXISTS bowling_pap_v_inch numeric(4,2);

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_bowling_ball_weight_lbs_check;
ALTER TABLE public.players
  ADD CONSTRAINT players_bowling_ball_weight_lbs_check
  CHECK (bowling_ball_weight_lbs IS NULL OR (bowling_ball_weight_lbs >= 12 AND bowling_ball_weight_lbs <= 16));

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_bowling_rpm_check;
ALTER TABLE public.players
  ADD CONSTRAINT players_bowling_rpm_check
  CHECK (bowling_rpm IS NULL OR (bowling_rpm >= 0 AND bowling_rpm <= 1000));

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_bowling_pap_h_inch_check;
ALTER TABLE public.players
  ADD CONSTRAINT players_bowling_pap_h_inch_check
  CHECK (bowling_pap_h_inch IS NULL OR (bowling_pap_h_inch >= -10 AND bowling_pap_h_inch <= 10));

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_bowling_pap_v_inch_check;
ALTER TABLE public.players
  ADD CONSTRAINT players_bowling_pap_v_inch_check
  CHECK (bowling_pap_v_inch IS NULL OR (bowling_pap_v_inch >= -10 AND bowling_pap_v_inch <= 10));