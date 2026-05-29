ALTER TABLE public.players DROP COLUMN IF EXISTS bowling_personal_number;
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS bowling_perso_num_left INTEGER,
  ADD COLUMN IF NOT EXISTS bowling_perso_num_center INTEGER,
  ADD COLUMN IF NOT EXISTS bowling_perso_num_right INTEGER;