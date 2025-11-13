-- Update RLS policies to allow modifications only to club owners

-- Categories: only owners can insert/update/delete
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
CREATE POLICY "Club owners can insert categories"
  ON public.categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE clubs.id = categories.club_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Club owners can update categories"
  ON public.categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE clubs.id = categories.club_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Club owners can delete categories"
  ON public.categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE clubs.id = categories.club_id
      AND clubs.user_id = auth.uid()
    )
  );

-- Players: only owners can insert/update/delete
DROP POLICY IF EXISTS "Users can insert own players" ON public.players;
CREATE POLICY "Club owners can insert players"
  ON public.players
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = players.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own players" ON public.players;
CREATE POLICY "Club owners can update players"
  ON public.players
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = players.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own players" ON public.players;
CREATE POLICY "Club owners can delete players"
  ON public.players
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = players.category_id
      AND clubs.user_id = auth.uid()
    )
  );

-- AWCR Tracking: only owners can insert/update/delete
DROP POLICY IF EXISTS "Users can insert own awcr tracking" ON public.awcr_tracking;
CREATE POLICY "Club owners can insert awcr tracking"
  ON public.awcr_tracking
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = awcr_tracking.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own awcr tracking" ON public.awcr_tracking;
CREATE POLICY "Club owners can update awcr tracking"
  ON public.awcr_tracking
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = awcr_tracking.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own awcr tracking" ON public.awcr_tracking;
CREATE POLICY "Club owners can delete awcr tracking"
  ON public.awcr_tracking
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = awcr_tracking.category_id
      AND clubs.user_id = auth.uid()
    )
  );

-- Speed Tests: only owners can insert/update/delete
DROP POLICY IF EXISTS "Users can insert own speed tests" ON public.speed_tests;
CREATE POLICY "Club owners can insert speed tests"
  ON public.speed_tests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = speed_tests.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own speed tests" ON public.speed_tests;
CREATE POLICY "Club owners can update speed tests"
  ON public.speed_tests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = speed_tests.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own speed tests" ON public.speed_tests;
CREATE POLICY "Club owners can delete speed tests"
  ON public.speed_tests
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = speed_tests.category_id
      AND clubs.user_id = auth.uid()
    )
  );

-- Strength Tests: only owners can insert/update/delete
DROP POLICY IF EXISTS "Users can insert own strength tests" ON public.strength_tests;
CREATE POLICY "Club owners can insert strength tests"
  ON public.strength_tests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = strength_tests.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own strength tests" ON public.strength_tests;
CREATE POLICY "Club owners can update strength tests"
  ON public.strength_tests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = strength_tests.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own strength tests" ON public.strength_tests;
CREATE POLICY "Club owners can delete strength tests"
  ON public.strength_tests
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = strength_tests.category_id
      AND clubs.user_id = auth.uid()
    )
  );

-- Injuries: only owners can insert/update/delete
DROP POLICY IF EXISTS "Users can insert own injuries" ON public.injuries;
CREATE POLICY "Club owners can insert injuries"
  ON public.injuries
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = injuries.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own injuries" ON public.injuries;
CREATE POLICY "Club owners can update injuries"
  ON public.injuries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = injuries.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own injuries" ON public.injuries;
CREATE POLICY "Club owners can delete injuries"
  ON public.injuries
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = injuries.category_id
      AND clubs.user_id = auth.uid()
    )
  );

-- Training Sessions: only owners can insert/update/delete
DROP POLICY IF EXISTS "Users can insert own training sessions" ON public.training_sessions;
CREATE POLICY "Club owners can insert training sessions"
  ON public.training_sessions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_sessions.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own training sessions" ON public.training_sessions;
CREATE POLICY "Club owners can update training sessions"
  ON public.training_sessions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_sessions.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own training sessions" ON public.training_sessions;
CREATE POLICY "Club owners can delete training sessions"
  ON public.training_sessions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_sessions.category_id
      AND clubs.user_id = auth.uid()
    )
  );

-- Training Periods: only owners can insert/update/delete
DROP POLICY IF EXISTS "Users can insert own training periods" ON public.training_periods;
CREATE POLICY "Club owners can insert training periods"
  ON public.training_periods
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_periods.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own training periods" ON public.training_periods;
CREATE POLICY "Club owners can update training periods"
  ON public.training_periods
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_periods.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own training periods" ON public.training_periods;
CREATE POLICY "Club owners can delete training periods"
  ON public.training_periods
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_periods.category_id
      AND clubs.user_id = auth.uid()
    )
  );

-- Training Cycles: only owners can insert/update/delete
DROP POLICY IF EXISTS "Users can insert own training cycles" ON public.training_cycles;
CREATE POLICY "Club owners can insert training cycles"
  ON public.training_cycles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_cycles.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own training cycles" ON public.training_cycles;
CREATE POLICY "Club owners can update training cycles"
  ON public.training_cycles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_cycles.category_id
      AND clubs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own training cycles" ON public.training_cycles;
CREATE POLICY "Club owners can delete training cycles"
  ON public.training_cycles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_cycles.category_id
      AND clubs.user_id = auth.uid()
    )
  );