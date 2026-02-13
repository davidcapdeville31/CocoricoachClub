
-- Allow athletes (players linked to a user account) to INSERT their own RPE
CREATE POLICY "Athletes can insert own RPE"
ON public.awcr_tracking
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = awcr_tracking.player_id
      AND p.user_id = auth.uid()
  )
);

-- Allow athletes to SELECT their own RPE data
CREATE POLICY "Athletes can view own RPE"
ON public.awcr_tracking
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = awcr_tracking.player_id
      AND p.user_id = auth.uid()
  )
);

-- Allow athletes to INSERT their own wellness data
CREATE POLICY "Athletes can insert own wellness"
ON public.wellness_tracking
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = wellness_tracking.player_id
      AND p.user_id = auth.uid()
  )
);

-- Allow athletes to SELECT their own wellness data
CREATE POLICY "Athletes can view own wellness"
ON public.wellness_tracking
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = wellness_tracking.player_id
      AND p.user_id = auth.uid()
  )
);

-- Also allow athletes to SELECT today's training sessions for their category
CREATE POLICY "Athletes can view training sessions in their category"
ON public.training_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.category_id = training_sessions.category_id
      AND p.user_id = auth.uid()
  )
);
