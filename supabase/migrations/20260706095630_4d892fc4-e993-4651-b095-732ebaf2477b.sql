-- Allow category staff (coach, prepa_physique, administratif) to SELECT players in their category
CREATE POLICY "Category staff can view players"
  ON public.players
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.category_members cm
      WHERE cm.category_id = players.category_id
        AND cm.user_id = auth.uid()
        AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role, 'administratif'::app_role])
    )
  );
