-- Allow coach, prepa_physique, administratif to view players in their categories
-- (currently only owners/admins/medical staff could SELECT players, blocking coach/prepa UI lists)

CREATE POLICY "Category staff can view players"
  ON public.players
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.category_members cm
      WHERE cm.category_id = players.category_id
        AND cm.user_id = auth.uid()
        AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role, 'administratif'::app_role, 'doctor'::app_role, 'physio'::app_role])
    )
  );

CREATE POLICY "Club staff can view players"
  ON public.players
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.categories c
      JOIN public.club_members cm ON cm.club_id = c.club_id
      WHERE c.id = players.category_id
        AND cm.user_id = auth.uid()
        AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role, 'administratif'::app_role, 'doctor'::app_role, 'physio'::app_role])
    )
  );