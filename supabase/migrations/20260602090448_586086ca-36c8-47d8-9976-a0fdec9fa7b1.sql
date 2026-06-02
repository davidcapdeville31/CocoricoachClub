
-- 1) Helper: is the user a staff manager (owner / admin / coach) for this conversation's category/club?
CREATE OR REPLACE FUNCTION public.user_is_chat_manager(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations conv
    JOIN public.categories cat ON cat.id = conv.category_id
    JOIN public.clubs cl ON cl.id = cat.club_id
    WHERE conv.id = _conversation_id
      AND (
        cl.user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.club_members cm
          WHERE cm.club_id = cl.id
            AND cm.user_id = _user_id
            AND cm.role IN ('admin'::app_role, 'coach'::app_role)
        )
        OR EXISTS (
          SELECT 1 FROM public.category_members catm
          WHERE catm.category_id = cat.id
            AND catm.user_id = _user_id
            AND catm.role IN ('admin'::app_role, 'coach'::app_role)
        )
      )
  )
$$;

-- 2) Replace permissive is_admin-based policies on conversation_participants
DROP POLICY IF EXISTS "Admins can delete participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Conversation admins can manage participants" ON public.conversation_participants;

-- Staff (owner/admin/coach) can fully manage participants
CREATE POLICY "Staff can manage chat participants"
ON public.conversation_participants
FOR ALL
USING (public.user_is_chat_manager(auth.uid(), conversation_id))
WITH CHECK (public.user_is_chat_manager(auth.uid(), conversation_id));

-- Any user can remove themselves from a conversation (keep existing self-management policy)
-- "Users can manage their own participation" already covers that.

-- 3) Auto-remove user from category's conversations when removed from the roster
CREATE OR REPLACE FUNCTION public.auto_remove_user_from_category_conversations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.conversation_participants cp
  USING public.conversations c
  WHERE cp.conversation_id = c.id
    AND c.category_id = OLD.category_id
    AND cp.user_id = OLD.user_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS auto_remove_user_from_category_conversations ON public.category_members;
CREATE TRIGGER auto_remove_user_from_category_conversations
AFTER DELETE ON public.category_members
FOR EACH ROW
EXECUTE FUNCTION public.auto_remove_user_from_category_conversations();
