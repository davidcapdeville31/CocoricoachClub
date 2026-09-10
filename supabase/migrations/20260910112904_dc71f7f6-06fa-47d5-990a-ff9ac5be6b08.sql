DROP POLICY IF EXISTS "ep_athlete_update_self" ON public.event_participants;

CREATE POLICY "ep_athlete_update_self"
ON public.event_participants
FOR UPDATE
TO authenticated
USING (
  public.player_belongs_to_user(player_id, auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.training_sessions ts
    WHERE ts.id = event_participants.training_session_id
      AND ts.session_date >= (CURRENT_DATE - 14)
  )
)
WITH CHECK (
  public.player_belongs_to_user(player_id, auth.uid())
  AND attendance_status IN ('present', 'absent', 'no_response')
  AND EXISTS (
    SELECT 1
    FROM public.training_sessions ts
    WHERE ts.id = event_participants.training_session_id
      AND ts.session_date >= (CURRENT_DATE - 14)
  )
);