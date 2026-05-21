-- Tighten DELETE policies on players: only owner / admin / coach
DROP POLICY IF EXISTS "Category members with access can delete players" ON public.players;

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