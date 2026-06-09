DROP POLICY IF EXISTS "Athletes can insert own training sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "Athletes can update own training sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "Athletes can delete own training sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "Athletes can view own personal training sessions" ON public.training_sessions;

CREATE POLICY "Athletes can insert own training sessions"
ON public.training_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  created_by_player_id IS NOT NULL
  AND public.player_belongs_to_user(created_by_player_id, auth.uid())
);

CREATE POLICY "Athletes can update own training sessions"
ON public.training_sessions
FOR UPDATE
TO authenticated
USING (
  created_by_player_id IS NOT NULL
  AND public.player_belongs_to_user(created_by_player_id, auth.uid())
)
WITH CHECK (
  created_by_player_id IS NOT NULL
  AND public.player_belongs_to_user(created_by_player_id, auth.uid())
);

CREATE POLICY "Athletes can delete own training sessions"
ON public.training_sessions
FOR DELETE
TO authenticated
USING (
  created_by_player_id IS NOT NULL
  AND public.player_belongs_to_user(created_by_player_id, auth.uid())
);

CREATE POLICY "Athletes can view own personal training sessions"
ON public.training_sessions
FOR SELECT
TO authenticated
USING (
  created_by_player_id IS NOT NULL
  AND public.player_belongs_to_user(created_by_player_id, auth.uid())
);