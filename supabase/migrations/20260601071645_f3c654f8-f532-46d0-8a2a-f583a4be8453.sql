-- Restrict category-level INSERT/DELETE on players to admin and coach only.
-- Préparateur physique, administratif, doctor, physio can no longer add or remove athletes.
-- Club-level policies (owner/admin/coach via can_modify_club_data) remain unchanged.

DROP POLICY IF EXISTS "Category admins and coaches can delete players" ON public.players;
CREATE POLICY "Category admins and coaches can delete players"
ON public.players
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = players.category_id
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role])
  )
);

DROP POLICY IF EXISTS "Category members with access can insert players" ON public.players;
CREATE POLICY "Category admins and coaches can insert players"
ON public.players
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = players.category_id
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role])
  )
);