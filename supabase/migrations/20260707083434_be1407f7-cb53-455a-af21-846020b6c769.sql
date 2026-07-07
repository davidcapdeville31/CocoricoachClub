
-- Allow staff of any category the player is linked to (via player_categories accepted)
-- to view awcr_tracking rows regardless of the row's category_id, so training load
-- is unified per athlete across multi-structure memberships.

DROP POLICY IF EXISTS "Staff can view awcr for shared multi-structure players" ON public.awcr_tracking;

CREATE POLICY "Staff can view awcr for shared multi-structure players"
ON public.awcr_tracking
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.player_categories pc
    JOIN public.category_members cm ON cm.category_id = pc.category_id
    WHERE pc.player_id = awcr_tracking.player_id
      AND pc.status = 'accepted'
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role, 'administratif'::app_role, 'doctor'::app_role])
  )
);
