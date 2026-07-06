
-- Allow staff members of any category the player is linked to (multi-structure)
-- to update the player row. Without this, updates silently affect 0 rows (RLS
-- filters them out) while the client sees no error.

DROP POLICY IF EXISTS "Staff can update players linked via player_categories" ON public.players;

CREATE POLICY "Staff can update players linked via player_categories"
ON public.players
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.player_categories pc
    JOIN public.category_members cm ON cm.category_id = pc.category_id
    WHERE pc.player_id = players.id
      AND pc.status = 'accepted'
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin','coach','prepa_physique','administratif','doctor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.player_categories pc
    JOIN public.category_members cm ON cm.category_id = pc.category_id
    WHERE pc.player_id = players.id
      AND pc.status = 'accepted'
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin','coach','prepa_physique','administratif','doctor')
  )
);
