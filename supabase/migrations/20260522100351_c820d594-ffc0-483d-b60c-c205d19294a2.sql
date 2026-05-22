
DROP POLICY IF EXISTS "Category members with access can insert players" ON public.players;
DROP POLICY IF EXISTS "Category members with access can update players" ON public.players;
DROP POLICY IF EXISTS "Category admins and coaches can delete players" ON public.players;

CREATE POLICY "Category members with access can insert players"
ON public.players
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = players.category_id
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role, 'administratif'::app_role, 'doctor'::app_role])
  )
);

CREATE POLICY "Category members with access can update players"
ON public.players
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = players.category_id
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role, 'administratif'::app_role, 'doctor'::app_role])
  )
);

CREATE POLICY "Category admins and coaches can delete players"
ON public.players
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = players.category_id
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role, 'doctor'::app_role])
  )
);
