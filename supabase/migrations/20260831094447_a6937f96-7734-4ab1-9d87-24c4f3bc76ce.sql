CREATE POLICY "Athletes can log their own body composition"
ON public.body_composition
FOR INSERT
TO authenticated
WITH CHECK (public.player_belongs_to_user(player_id, auth.uid()));

CREATE POLICY "Athletes can view their own body composition"
ON public.body_composition
FOR SELECT
TO authenticated
USING (public.player_belongs_to_user(player_id, auth.uid()));