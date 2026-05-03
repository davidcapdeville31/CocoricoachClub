-- 1. Add location to training_sessions
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS location TEXT;

-- 2. Add theme + duration to training_session_blocks
ALTER TABLE public.training_session_blocks
  ADD COLUMN IF NOT EXISTS theme TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- 3. Per-athlete per-block RPE table
CREATE TABLE IF NOT EXISTS public.session_block_athlete_rpe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES public.training_session_blocks(id) ON DELETE CASCADE,
  training_session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  rpe INTEGER NOT NULL CHECK (rpe BETWEEN 1 AND 10),
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (block_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_sbar_session ON public.session_block_athlete_rpe(training_session_id);
CREATE INDEX IF NOT EXISTS idx_sbar_player ON public.session_block_athlete_rpe(player_id);
CREATE INDEX IF NOT EXISTS idx_sbar_category ON public.session_block_athlete_rpe(category_id);

ALTER TABLE public.session_block_athlete_rpe ENABLE ROW LEVEL SECURITY;

-- Athletes can manage their own RPE
CREATE POLICY "Athletes manage their own block RPE"
ON public.session_block_athlete_rpe
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = session_block_athlete_rpe.player_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = session_block_athlete_rpe.player_id
      AND p.user_id = auth.uid()
  )
);

-- Staff with category access can read/manage
CREATE POLICY "Staff can read block RPE"
ON public.session_block_athlete_rpe
FOR SELECT
TO authenticated
USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Staff can manage block RPE"
ON public.session_block_athlete_rpe
FOR ALL
TO authenticated
USING (public.can_access_category(auth.uid(), category_id))
WITH CHECK (public.can_access_category(auth.uid(), category_id));

CREATE TRIGGER trg_sbar_updated_at
  BEFORE UPDATE ON public.session_block_athlete_rpe
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();