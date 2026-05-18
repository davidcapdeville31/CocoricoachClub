
CREATE POLICY "Category members with access can insert players"
ON public.players
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = players.category_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin','coach','prepa_physique','administratif')
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
      AND cm.role IN ('admin','coach','prepa_physique','administratif')
  )
);

CREATE POLICY "Category members with access can delete players"
ON public.players
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = players.category_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin','coach','prepa_physique','administratif')
  )
);
