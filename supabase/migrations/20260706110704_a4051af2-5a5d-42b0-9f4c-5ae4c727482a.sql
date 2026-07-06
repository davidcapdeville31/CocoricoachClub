
-- training_session_blocks: allow staff of any category the session's creator player belongs to
CREATE POLICY "Staff can view shared session blocks across structures"
  ON public.training_session_blocks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.training_sessions ts
      JOIN public.player_categories pc ON pc.player_id = ts.created_by_player_id
      JOIN public.category_members cm ON cm.category_id = pc.category_id
      WHERE ts.id = training_session_blocks.training_session_id
        AND ts.created_by_player_id IS NOT NULL
        AND pc.status = 'accepted'
        AND cm.user_id = auth.uid()
        AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role, 'administratif'::app_role, 'doctor'::app_role])
    )
  );

-- gym_session_exercises: same rule
CREATE POLICY "Staff can view shared session exercises across structures"
  ON public.gym_session_exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.training_sessions ts
      JOIN public.player_categories pc ON pc.player_id = ts.created_by_player_id
      JOIN public.category_members cm ON cm.category_id = pc.category_id
      WHERE ts.id = gym_session_exercises.training_session_id
        AND ts.created_by_player_id IS NOT NULL
        AND pc.status = 'accepted'
        AND cm.user_id = auth.uid()
        AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role, 'administratif'::app_role, 'doctor'::app_role])
    )
  );

-- awcr_tracking: same rule (RPE/durée saisis par l'athlète)
CREATE POLICY "Staff can view shared session awcr across structures"
  ON public.awcr_tracking
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.training_sessions ts
      JOIN public.player_categories pc ON pc.player_id = ts.created_by_player_id
      JOIN public.category_members cm ON cm.category_id = pc.category_id
      WHERE ts.id = awcr_tracking.training_session_id
        AND ts.created_by_player_id IS NOT NULL
        AND pc.status = 'accepted'
        AND cm.user_id = auth.uid()
        AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role, 'administratif'::app_role, 'doctor'::app_role])
    )
  );

-- training_attendance: same rule
CREATE POLICY "Staff can view shared session attendance across structures"
  ON public.training_attendance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.training_sessions ts
      JOIN public.player_categories pc ON pc.player_id = ts.created_by_player_id
      JOIN public.category_members cm ON cm.category_id = pc.category_id
      WHERE ts.id = training_attendance.training_session_id
        AND ts.created_by_player_id IS NOT NULL
        AND pc.status = 'accepted'
        AND cm.user_id = auth.uid()
        AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role, 'administratif'::app_role, 'doctor'::app_role])
    )
  );

-- players: allow staff to view players linked to their category via player_categories (multi-structure)
CREATE POLICY "Staff can view players linked via player_categories"
  ON public.players
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.player_categories pc
      JOIN public.category_members cm ON cm.category_id = pc.category_id
      WHERE pc.player_id = players.id
        AND pc.status = 'accepted'
        AND cm.user_id = auth.uid()
        AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role, 'administratif'::app_role, 'doctor'::app_role])
    )
  );
