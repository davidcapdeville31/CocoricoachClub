-- Allow existing participants of a group conversation to add new participants
CREATE POLICY "Participants can add members to groups"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_participates_in_conversation(auth.uid(), conversation_id)
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND c.conversation_type <> 'direct'
  )
);