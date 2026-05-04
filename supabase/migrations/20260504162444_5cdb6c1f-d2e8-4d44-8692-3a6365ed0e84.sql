
-- Add club_id to scope custom balls per client
ALTER TABLE public.bowling_ball_catalog
  ADD COLUMN IF NOT EXISTS club_id UUID NULL REFERENCES public.clubs(id) ON DELETE CASCADE;

-- Add updated_at if not present (used by image upload version)
ALTER TABLE public.bowling_ball_catalog
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Drop old open policies
DROP POLICY IF EXISTS "Anyone can read bowling ball catalog" ON public.bowling_ball_catalog;
DROP POLICY IF EXISTS "Users can insert custom balls" ON public.bowling_ball_catalog;
DROP POLICY IF EXISTS "Authenticated users can update bowling ball catalog" ON public.bowling_ball_catalog;

-- SELECT: system balls visible to all authenticated; club balls visible only to club members
CREATE POLICY "Read system or own club balls"
ON public.bowling_ball_catalog
FOR SELECT
TO authenticated
USING (
  is_system = true
  OR (club_id IS NOT NULL AND public.can_access_club(auth.uid(), club_id))
  OR public.is_super_admin(auth.uid())
);

-- INSERT: super admins can insert system balls; club members can insert balls for their club
CREATE POLICY "Insert system balls (super admin)"
ON public.bowling_ball_catalog
FOR INSERT
TO authenticated
WITH CHECK (
  is_system = true AND public.is_super_admin(auth.uid())
);

CREATE POLICY "Insert club balls"
ON public.bowling_ball_catalog
FOR INSERT
TO authenticated
WITH CHECK (
  is_system = false
  AND created_by = auth.uid()
  AND club_id IS NOT NULL
  AND public.can_modify_club_data(auth.uid(), club_id)
);

-- UPDATE: super admins for system balls; club members for own balls
CREATE POLICY "Update system balls (super admin)"
ON public.bowling_ball_catalog
FOR UPDATE
TO authenticated
USING (is_system = true AND public.is_super_admin(auth.uid()))
WITH CHECK (is_system = true AND public.is_super_admin(auth.uid()));

CREATE POLICY "Update club balls"
ON public.bowling_ball_catalog
FOR UPDATE
TO authenticated
USING (
  is_system = false
  AND club_id IS NOT NULL
  AND public.can_modify_club_data(auth.uid(), club_id)
)
WITH CHECK (
  is_system = false
  AND club_id IS NOT NULL
  AND public.can_modify_club_data(auth.uid(), club_id)
);

-- DELETE: super admins for system; club members for own
CREATE POLICY "Delete system balls (super admin)"
ON public.bowling_ball_catalog
FOR DELETE
TO authenticated
USING (is_system = true AND public.is_super_admin(auth.uid()));

CREATE POLICY "Delete club balls"
ON public.bowling_ball_catalog
FOR DELETE
TO authenticated
USING (
  is_system = false
  AND club_id IS NOT NULL
  AND public.can_modify_club_data(auth.uid(), club_id)
);

-- Trigger to keep updated_at in sync
DROP TRIGGER IF EXISTS bowling_ball_catalog_set_updated_at ON public.bowling_ball_catalog;
CREATE TRIGGER bowling_ball_catalog_set_updated_at
BEFORE UPDATE ON public.bowling_ball_catalog
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
