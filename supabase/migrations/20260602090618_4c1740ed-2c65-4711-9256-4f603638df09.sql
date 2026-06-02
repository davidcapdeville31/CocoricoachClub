
-- Backfill: remove stale participants from group/channel chats whose users
-- are no longer in the category's staff or athletes.
DELETE FROM public.conversation_participants cp
USING public.conversations c
JOIN public.categories cat ON cat.id = c.category_id
WHERE cp.conversation_id = c.id
  AND c.conversation_type <> 'direct'
  AND c.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = cat.id AND cm.user_id = cp.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.club_members clm
    WHERE clm.club_id = cat.club_id AND clm.user_id = cp.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.clubs cl
    WHERE cl.id = cat.club_id AND cl.user_id = cp.user_id
  );
