
DROP POLICY IF EXISTS "Users can insert blocks for their sessions" ON public.training_session_blocks;
DROP POLICY IF EXISTS "Users can update blocks for their sessions" ON public.training_session_blocks;
DROP POLICY IF EXISTS "Users can delete blocks for their sessions" ON public.training_session_blocks;

CREATE POLICY "Staff can insert blocks for their sessions"
ON public.training_session_blocks
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM training_sessions ts
  JOIN category_members cm ON cm.category_id = ts.category_id
  WHERE ts.id = training_session_blocks.training_session_id
    AND cm.user_id = auth.uid()
    AND cm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role,'administratif'::app_role,'prepa_physique'::app_role,'doctor'::app_role])
));

CREATE POLICY "Staff can update blocks for their sessions"
ON public.training_session_blocks
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM training_sessions ts
  JOIN category_members cm ON cm.category_id = ts.category_id
  WHERE ts.id = training_session_blocks.training_session_id
    AND cm.user_id = auth.uid()
    AND cm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role,'administratif'::app_role,'prepa_physique'::app_role,'doctor'::app_role])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM training_sessions ts
  JOIN category_members cm ON cm.category_id = ts.category_id
  WHERE ts.id = training_session_blocks.training_session_id
    AND cm.user_id = auth.uid()
    AND cm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role,'administratif'::app_role,'prepa_physique'::app_role,'doctor'::app_role])
));

CREATE POLICY "Staff can delete blocks for their sessions"
ON public.training_session_blocks
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM training_sessions ts
  JOIN category_members cm ON cm.category_id = ts.category_id
  WHERE ts.id = training_session_blocks.training_session_id
    AND cm.user_id = auth.uid()
    AND cm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role,'administratif'::app_role,'prepa_physique'::app_role,'doctor'::app_role])
));
