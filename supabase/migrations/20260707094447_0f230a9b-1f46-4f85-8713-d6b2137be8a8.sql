
-- ============================================================
-- Multi-structure access for injuries + illnesses
-- Allow staff (admin, coach, prepa_physique, administratif, doctor, physio, mental_coach)
-- of ANY category linked to the player via player_categories (status=accepted)
-- to SELECT / INSERT / UPDATE / DELETE injuries and illnesses.
-- ============================================================

-- Helper: check whether current user is authorized staff for any category
-- linked to the given player via player_categories (status=accepted).
CREATE OR REPLACE FUNCTION public.is_staff_for_player_multi(_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.player_categories pc
    JOIN public.category_members cm ON cm.category_id = pc.category_id
    WHERE pc.player_id = _player_id
      AND pc.status = 'accepted'
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin','coach','prepa_physique','administratif','doctor','physio','mental_coach')
  )
$$;

-- ---------- INJURIES ----------
DROP POLICY IF EXISTS "Multi-structure staff can view injuries" ON public.injuries;
CREATE POLICY "Multi-structure staff can view injuries"
ON public.injuries FOR SELECT
TO authenticated
USING (public.is_staff_for_player_multi(injuries.player_id));

DROP POLICY IF EXISTS "Multi-structure staff can insert injuries" ON public.injuries;
CREATE POLICY "Multi-structure staff can insert injuries"
ON public.injuries FOR INSERT
TO authenticated
WITH CHECK (public.is_staff_for_player_multi(injuries.player_id));

DROP POLICY IF EXISTS "Multi-structure staff can update injuries" ON public.injuries;
CREATE POLICY "Multi-structure staff can update injuries"
ON public.injuries FOR UPDATE
TO authenticated
USING (public.is_staff_for_player_multi(injuries.player_id))
WITH CHECK (public.is_staff_for_player_multi(injuries.player_id));

DROP POLICY IF EXISTS "Multi-structure staff can delete injuries" ON public.injuries;
CREATE POLICY "Multi-structure staff can delete injuries"
ON public.injuries FOR DELETE
TO authenticated
USING (public.is_staff_for_player_multi(injuries.player_id));

-- ---------- ILLNESSES ----------
DROP POLICY IF EXISTS "Multi-structure staff can view illnesses" ON public.illnesses;
CREATE POLICY "Multi-structure staff can view illnesses"
ON public.illnesses FOR SELECT
TO authenticated
USING (public.is_staff_for_player_multi(illnesses.player_id));

DROP POLICY IF EXISTS "Multi-structure staff can insert illnesses" ON public.illnesses;
CREATE POLICY "Multi-structure staff can insert illnesses"
ON public.illnesses FOR INSERT
TO authenticated
WITH CHECK (public.is_staff_for_player_multi(illnesses.player_id));

DROP POLICY IF EXISTS "Multi-structure staff can update illnesses" ON public.illnesses;
CREATE POLICY "Multi-structure staff can update illnesses"
ON public.illnesses FOR UPDATE
TO authenticated
USING (public.is_staff_for_player_multi(illnesses.player_id))
WITH CHECK (public.is_staff_for_player_multi(illnesses.player_id));

DROP POLICY IF EXISTS "Multi-structure staff can delete illnesses" ON public.illnesses;
CREATE POLICY "Multi-structure staff can delete illnesses"
ON public.illnesses FOR DELETE
TO authenticated
USING (public.is_staff_for_player_multi(illnesses.player_id));
