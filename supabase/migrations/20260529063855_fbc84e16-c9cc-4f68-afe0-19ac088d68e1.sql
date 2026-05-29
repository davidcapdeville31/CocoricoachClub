
-- ============================================================
-- BOWLING TRAINING REFONTE — new structured data model
-- ============================================================

-- 1. bowling_training_blocks
CREATE TABLE IF NOT EXISTS public.bowling_training_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  athlete_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'coach' CHECK (source IN ('coach','athlete')),
  block_type text NOT NULL CHECK (block_type IN ('warmup','technical','tactical','games')),
  title text NOT NULL,
  duration_min integer,
  planned_throws integer,
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  coach_instruction text,
  internal_note text,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  success_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  pattern_id uuid REFERENCES public.bowling_oil_patterns(id) ON DELETE SET NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('draft','planned','in_progress','completed')),
  order_index integer NOT NULL DEFAULT 0,
  debrief jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bowling_training_blocks TO authenticated;
GRANT ALL ON public.bowling_training_blocks TO service_role;

ALTER TABLE public.bowling_training_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "btb_staff_select" ON public.bowling_training_blocks FOR SELECT TO authenticated
  USING (public.can_access_category(auth.uid(), category_id));
CREATE POLICY "btb_staff_insert" ON public.bowling_training_blocks FOR INSERT TO authenticated
  WITH CHECK (public.can_access_category(auth.uid(), category_id));
CREATE POLICY "btb_staff_update" ON public.bowling_training_blocks FOR UPDATE TO authenticated
  USING (public.can_access_category(auth.uid(), category_id));
CREATE POLICY "btb_staff_delete" ON public.bowling_training_blocks FOR DELETE TO authenticated
  USING (public.can_access_category(auth.uid(), category_id));
CREATE POLICY "btb_athlete_select" ON public.bowling_training_blocks FOR SELECT TO authenticated
  USING (
    athlete_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.players p WHERE p.id = bowling_training_blocks.athlete_id AND p.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_bowling_blocks_session ON public.bowling_training_blocks(session_id);
CREATE INDEX IF NOT EXISTS idx_bowling_blocks_athlete ON public.bowling_training_blocks(athlete_id);
CREATE INDEX IF NOT EXISTS idx_bowling_blocks_category ON public.bowling_training_blocks(category_id);


-- 2. bowling_throw_results
CREATE TABLE IF NOT EXISTS public.bowling_throw_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES public.bowling_training_blocks(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  exercise_index integer NOT NULL DEFAULT 0,
  throw_number integer NOT NULL,
  ball_arsenal_id uuid REFERENCES public.player_bowling_arsenal(id) ON DELETE SET NULL,
  foot_board numeric,
  breakpoint_board numeric,
  target_arrow text,
  target_zone text,
  actual_zone text,
  speed_kmh numeric,
  axis_success boolean,
  speed_success boolean,
  release_success boolean,
  breakpoint_success boolean,
  pocket_success boolean,
  strike_success boolean,
  spare_success boolean,
  pin_hit smallint[],
  success_global boolean,
  comment text,
  foot_delta numeric,
  breakpoint_delta numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bowling_throw_results TO authenticated;
GRANT ALL ON public.bowling_throw_results TO service_role;

ALTER TABLE public.bowling_throw_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "btr_staff_select" ON public.bowling_throw_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bowling_training_blocks b
    WHERE b.id = bowling_throw_results.block_id AND public.can_access_category(auth.uid(), b.category_id)
  ));
CREATE POLICY "btr_staff_insert" ON public.bowling_throw_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bowling_training_blocks b
    WHERE b.id = bowling_throw_results.block_id AND public.can_access_category(auth.uid(), b.category_id)
  ));
CREATE POLICY "btr_staff_update" ON public.bowling_throw_results FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bowling_training_blocks b
    WHERE b.id = bowling_throw_results.block_id AND public.can_access_category(auth.uid(), b.category_id)
  ));
CREATE POLICY "btr_staff_delete" ON public.bowling_throw_results FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bowling_training_blocks b
    WHERE b.id = bowling_throw_results.block_id AND public.can_access_category(auth.uid(), b.category_id)
  ));
CREATE POLICY "btr_athlete_select" ON public.bowling_throw_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = bowling_throw_results.athlete_id AND p.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_bowling_throws_block ON public.bowling_throw_results(block_id);
CREATE INDEX IF NOT EXISTS idx_bowling_throws_athlete ON public.bowling_throw_results(athlete_id);

CREATE OR REPLACE FUNCTION public.bowling_throw_compute_deltas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev RECORD;
BEGIN
  SELECT foot_board, breakpoint_board INTO prev
  FROM public.bowling_throw_results
  WHERE block_id = NEW.block_id AND exercise_index = NEW.exercise_index AND throw_number < NEW.throw_number
  ORDER BY throw_number DESC LIMIT 1;
  IF FOUND THEN
    IF NEW.foot_board IS NOT NULL AND prev.foot_board IS NOT NULL THEN
      NEW.foot_delta := NEW.foot_board - prev.foot_board;
    END IF;
    IF NEW.breakpoint_board IS NOT NULL AND prev.breakpoint_board IS NOT NULL THEN
      NEW.breakpoint_delta := NEW.breakpoint_board - prev.breakpoint_board;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bowling_throw_deltas ON public.bowling_throw_results;
CREATE TRIGGER trg_bowling_throw_deltas
BEFORE INSERT OR UPDATE ON public.bowling_throw_results
FOR EACH ROW EXECUTE FUNCTION public.bowling_throw_compute_deltas();


-- 3. bowling_training_games
CREATE TABLE IF NOT EXISTS public.bowling_training_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES public.bowling_training_blocks(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  game_number integer NOT NULL,
  score integer,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  frames jsonb,
  pattern_id uuid REFERENCES public.bowling_oil_patterns(id) ON DELETE SET NULL,
  ball_arsenal_id uuid REFERENCES public.player_bowling_arsenal(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bowling_training_games TO authenticated;
GRANT ALL ON public.bowling_training_games TO service_role;

ALTER TABLE public.bowling_training_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "btg_staff_all" ON public.bowling_training_games FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bowling_training_blocks b
    WHERE b.id = bowling_training_games.block_id AND public.can_access_category(auth.uid(), b.category_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bowling_training_blocks b
    WHERE b.id = bowling_training_games.block_id AND public.can_access_category(auth.uid(), b.category_id)
  ));
CREATE POLICY "btg_athlete_select" ON public.bowling_training_games FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = bowling_training_games.athlete_id AND p.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_bowling_games_block ON public.bowling_training_games(block_id);
CREATE INDEX IF NOT EXISTS idx_bowling_games_athlete ON public.bowling_training_games(athlete_id);


-- 4. bowling_exercise_library
CREATE TABLE IF NOT EXISTS public.bowling_exercise_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'user' CHECK (scope IN ('system','club','user')),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  owner_id uuid,
  category text NOT NULL CHECK (category IN ('warmup','technical','tactical','games')),
  name text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bowling_exercise_library TO authenticated;
GRANT ALL ON public.bowling_exercise_library TO service_role;

ALTER TABLE public.bowling_exercise_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bel_select" ON public.bowling_exercise_library FOR SELECT TO authenticated
  USING (
    scope = 'system'
    OR (scope = 'user' AND owner_id = auth.uid())
    OR (scope = 'club' AND club_id IN (SELECT club_id FROM public.club_members WHERE user_id = auth.uid()))
  );
CREATE POLICY "bel_insert" ON public.bowling_exercise_library FOR INSERT TO authenticated
  WITH CHECK (
    (scope = 'user' AND owner_id = auth.uid())
    OR (scope = 'club' AND club_id IN (SELECT club_id FROM public.club_members WHERE user_id = auth.uid()))
  );
CREATE POLICY "bel_update" ON public.bowling_exercise_library FOR UPDATE TO authenticated
  USING (
    (scope = 'user' AND owner_id = auth.uid())
    OR (scope = 'club' AND club_id IN (SELECT club_id FROM public.club_members WHERE user_id = auth.uid()))
  );
CREATE POLICY "bel_delete" ON public.bowling_exercise_library FOR DELETE TO authenticated
  USING (
    (scope = 'user' AND owner_id = auth.uid())
    OR (scope = 'club' AND club_id IN (SELECT club_id FROM public.club_members WHERE user_id = auth.uid()))
  );
