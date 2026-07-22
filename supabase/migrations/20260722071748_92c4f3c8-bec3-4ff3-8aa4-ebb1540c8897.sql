
DROP POLICY IF EXISTS "Staff can insert blocks for their sessions" ON public.training_session_blocks;
DROP POLICY IF EXISTS "Staff can update blocks for their sessions" ON public.training_session_blocks;
DROP POLICY IF EXISTS "Staff can delete blocks for their sessions" ON public.training_session_blocks;

CREATE POLICY "Staff can insert blocks for their sessions"
ON public.training_session_blocks FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.training_sessions ts
    JOIN public.categories c ON c.id = ts.category_id
    JOIN public.clubs cl ON cl.id = c.club_id
    WHERE ts.id = training_session_blocks.training_session_id
      AND public.can_modify_club_data(auth.uid(), cl.id)
  )
  OR EXISTS (
    SELECT 1 FROM public.training_sessions ts
    JOIN public.category_members cm ON cm.category_id = ts.category_id
    WHERE ts.id = training_session_blocks.training_session_id
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role,'administratif'::app_role,'prepa_physique'::app_role,'doctor'::app_role])
  )
);

CREATE POLICY "Staff can update blocks for their sessions"
ON public.training_session_blocks FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.training_sessions ts
    JOIN public.categories c ON c.id = ts.category_id
    JOIN public.clubs cl ON cl.id = c.club_id
    WHERE ts.id = training_session_blocks.training_session_id
      AND public.can_modify_club_data(auth.uid(), cl.id)
  )
  OR EXISTS (
    SELECT 1 FROM public.training_sessions ts
    JOIN public.category_members cm ON cm.category_id = ts.category_id
    WHERE ts.id = training_session_blocks.training_session_id
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role,'administratif'::app_role,'prepa_physique'::app_role,'doctor'::app_role])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.training_sessions ts
    JOIN public.categories c ON c.id = ts.category_id
    JOIN public.clubs cl ON cl.id = c.club_id
    WHERE ts.id = training_session_blocks.training_session_id
      AND public.can_modify_club_data(auth.uid(), cl.id)
  )
  OR EXISTS (
    SELECT 1 FROM public.training_sessions ts
    JOIN public.category_members cm ON cm.category_id = ts.category_id
    WHERE ts.id = training_session_blocks.training_session_id
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role,'administratif'::app_role,'prepa_physique'::app_role,'doctor'::app_role])
  )
);

CREATE POLICY "Staff can delete blocks for their sessions"
ON public.training_session_blocks FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.training_sessions ts
    JOIN public.categories c ON c.id = ts.category_id
    JOIN public.clubs cl ON cl.id = c.club_id
    WHERE ts.id = training_session_blocks.training_session_id
      AND public.can_modify_club_data(auth.uid(), cl.id)
  )
  OR EXISTS (
    SELECT 1 FROM public.training_sessions ts
    JOIN public.category_members cm ON cm.category_id = ts.category_id
    WHERE ts.id = training_session_blocks.training_session_id
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role,'administratif'::app_role,'prepa_physique'::app_role,'doctor'::app_role])
  )
);
