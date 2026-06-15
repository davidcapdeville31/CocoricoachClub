DROP POLICY IF EXISTS "Authenticated admins can view academic tracking" ON public.player_academic_tracking;
DROP POLICY IF EXISTS "Authenticated admins can insert academic tracking" ON public.player_academic_tracking;
DROP POLICY IF EXISTS "Authenticated admins can update academic tracking" ON public.player_academic_tracking;
DROP POLICY IF EXISTS "Authenticated admins can delete academic tracking" ON public.player_academic_tracking;

CREATE POLICY "Authorized category members can view academic tracking"
ON public.player_academic_tracking
FOR SELECT
TO authenticated
USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Authorized category members can insert academic tracking"
ON public.player_academic_tracking
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_category(auth.uid(), category_id)
  AND EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = player_academic_tracking.player_id
      AND p.category_id = player_academic_tracking.category_id
  )
);

CREATE POLICY "Authorized category members can update academic tracking"
ON public.player_academic_tracking
FOR UPDATE
TO authenticated
USING (public.can_access_category(auth.uid(), category_id))
WITH CHECK (
  public.can_access_category(auth.uid(), category_id)
  AND EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = player_academic_tracking.player_id
      AND p.category_id = player_academic_tracking.category_id
  )
);

CREATE POLICY "Authorized category members can delete academic tracking"
ON public.player_academic_tracking
FOR DELETE
TO authenticated
USING (public.can_access_category(auth.uid(), category_id));