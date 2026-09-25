CREATE POLICY "Club staff can create notifications for category users"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.categories c
    JOIN public.club_members m ON m.club_id = c.club_id
    WHERE c.id = notifications.category_id
      AND m.user_id = auth.uid()
      AND m.role = ANY (ARRAY['admin','coach','prepa_physique','administratif','doctor','physio','mental_coach']::public.app_role[])
  )
);