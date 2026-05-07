-- Allow recipients (the user the notification is addressed to) to view/update/delete their own notifications,
-- in addition to the existing club-owner policy. This makes the bell + red dot work for ALL staff
-- across ALL categories and disciplines, not only the club owner.

DROP POLICY IF EXISTS "Recipients can view their notifications" ON public.notifications;
CREATE POLICY "Recipients can view their notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Recipients can update their notifications" ON public.notifications;
CREATE POLICY "Recipients can update their notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Recipients can delete their notifications" ON public.notifications;
CREATE POLICY "Recipients can delete their notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());