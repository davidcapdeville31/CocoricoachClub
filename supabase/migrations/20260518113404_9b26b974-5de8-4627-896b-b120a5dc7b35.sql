CREATE POLICY "Players viewable by category staff"
ON public.players
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = players.category_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin','coach','prepa_physique','administratif')
  )
);