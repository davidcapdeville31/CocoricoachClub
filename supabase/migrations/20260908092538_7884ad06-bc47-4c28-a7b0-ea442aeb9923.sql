CREATE POLICY "Athletes can update their own recent body composition"
ON public.body_composition
FOR UPDATE
TO authenticated
USING (player_belongs_to_user(player_id, auth.uid()) AND created_at > now() - interval '24 hours')
WITH CHECK (player_belongs_to_user(player_id, auth.uid()));