CREATE POLICY "Staff can view shared athlete sessions across structures"
  ON public.training_sessions
  FOR SELECT
  TO authenticated
  USING (
    training_sessions.created_by_player_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.player_categories pc
      JOIN public.category_members cm ON cm.category_id = pc.category_id
      WHERE pc.player_id = training_sessions.created_by_player_id
        AND cm.user_id = auth.uid()
        AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role, 'administratif'::app_role, 'doctor'::app_role])
    )
  );
