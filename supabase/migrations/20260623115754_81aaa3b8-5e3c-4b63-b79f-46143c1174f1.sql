DROP POLICY IF EXISTS "Athletes can update own RPE" ON public.awcr_tracking;
CREATE POLICY "Athletes can update own RPE"
ON public.awcr_tracking
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = awcr_tracking.player_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = awcr_tracking.player_id
      AND p.user_id = auth.uid()
  )
);