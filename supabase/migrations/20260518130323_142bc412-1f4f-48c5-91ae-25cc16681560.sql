CREATE POLICY "Category staff can create notifications for category users"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = notifications.category_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'coach', 'prepa_physique', 'administratif', 'doctor', 'physio', 'mental_coach')
  )
  OR EXISTS (
    SELECT 1
    FROM public.categories c
    JOIN public.clubs cl ON cl.id = c.club_id
    WHERE c.id = notifications.category_id
      AND cl.user_id = auth.uid()
  )
);