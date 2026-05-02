-- Tighten direct SELECT on public.players
DROP POLICY IF EXISTS "Players viewable by category members" ON public.players;

CREATE POLICY "Players direct access for owners admins medical and self"
ON public.players
FOR SELECT
TO authenticated
USING (
  -- The athlete themselves
  user_id = auth.uid()
  -- Owners, admins, medical staff, super admin via dedicated helper
  OR public.can_view_player_sensitive_data(auth.uid(), category_id)
);
