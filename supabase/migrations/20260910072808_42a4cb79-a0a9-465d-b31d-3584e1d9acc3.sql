CREATE POLICY "Athletes can view their own participation"
ON public.event_participants
FOR SELECT
TO authenticated
USING (public.player_belongs_to_user(player_id, auth.uid()));

CREATE POLICY "Athletes can view sessions of their linked categories"
ON public.training_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.player_categories pc
    JOIN public.players p ON p.id = pc.player_id
    WHERE pc.category_id = training_sessions.category_id
      AND pc.status = 'accepted'
      AND p.user_id = auth.uid()
  )
);