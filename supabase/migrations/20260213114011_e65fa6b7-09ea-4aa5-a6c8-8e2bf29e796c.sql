-- Fix: Direct/private conversations should only be visible to participants, not all category members
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

CREATE POLICY "Users can view their conversations"
ON public.conversations
FOR SELECT
USING (
  -- User is a participant
  (id IN (
    SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
  ))
  OR
  -- User is a category member BUT only for non-direct conversations (groups/channels)
  (conversation_type != 'direct' AND category_id IN (
    SELECT category_id FROM public.category_members WHERE user_id = auth.uid()
  ))
);