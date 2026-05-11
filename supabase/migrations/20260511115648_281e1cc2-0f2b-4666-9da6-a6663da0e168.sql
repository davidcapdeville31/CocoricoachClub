
-- ============================================================================
-- Live Match Tracker — match_events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.match_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_side TEXT NOT NULL CHECK (team_side IN ('home','away')),
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  minute INT NOT NULL DEFAULT 0,
  second INT NOT NULL DEFAULT 0,
  period TEXT NOT NULL DEFAULT 'H1' CHECK (period IN ('H1','HT','H2','ET')),
  event_type TEXT NOT NULL,
  event_subtype TEXT,
  outcome TEXT,
  points INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_events_match ON public.match_events(match_id, minute, second);
CREATE INDEX IF NOT EXISTS idx_match_events_player ON public.match_events(player_id);

-- Auto-compute points & touch updated_at
CREATE OR REPLACE FUNCTION public.match_events_set_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.outcome = 'success' THEN
    IF NEW.event_type = 'try' THEN
      NEW.points := 5;
    ELSIF NEW.event_type = 'penalty_try' THEN
      NEW.points := 7;
    ELSIF NEW.event_type = 'conversion' THEN
      NEW.points := 2;
    ELSIF NEW.event_type IN ('penalty_kick','drop') THEN
      NEW.points := 3;
    ELSE
      NEW.points := 0;
    END IF;
  ELSE
    -- Try is always 5 even without explicit outcome (try is a scored event)
    IF NEW.event_type = 'try' THEN
      NEW.points := 5;
    ELSIF NEW.event_type = 'penalty_try' THEN
      NEW.points := 7;
    ELSE
      NEW.points := 0;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_match_events_points ON public.match_events;
CREATE TRIGGER trg_match_events_points
BEFORE INSERT OR UPDATE ON public.match_events
FOR EACH ROW EXECUTE FUNCTION public.match_events_set_points();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

-- Helper-style policy using existing matches/categories chain.
-- Read: any authenticated user who can read the related match (mirror matches RLS heuristic).
CREATE POLICY "match_events_select_staff"
ON public.match_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_events.match_id
  )
);

-- Public read via match public token (if matches has public_token mechanism elsewhere)
CREATE POLICY "match_events_select_public"
ON public.match_events FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_events.match_id
  )
);

CREATE POLICY "match_events_insert_staff"
ON public.match_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_events.match_id)
);

CREATE POLICY "match_events_update_staff"
ON public.match_events FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_events.match_id)
);

CREATE POLICY "match_events_delete_staff"
ON public.match_events FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_events.match_id)
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;
