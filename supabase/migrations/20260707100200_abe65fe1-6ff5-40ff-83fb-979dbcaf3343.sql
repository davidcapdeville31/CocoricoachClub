CREATE POLICY "Multi-structure staff can view wellness_tracking"
ON public.wellness_tracking
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.player_categories pc
    JOIN public.category_members cm ON cm.category_id = pc.category_id
    WHERE pc.player_id = wellness_tracking.player_id
      AND pc.status = 'accepted'
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin','coach','prepa_physique','administratif','doctor','physio','mental_coach')
  )
);