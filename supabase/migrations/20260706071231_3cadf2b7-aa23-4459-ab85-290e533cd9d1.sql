
-- =========================================================
-- 1) profiles: restrict co-member visibility of contact info
-- =========================================================
DROP POLICY IF EXISTS "Club co-members can view profiles" ON public.profiles;

-- Staff-only visibility of other members' full profile (incl. email/phone).
-- Regular members (viewer/athlete/administratif) cannot browse contact info.
CREATE POLICY "Staff can view profiles of shared club/category members"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm_me
    JOIN public.club_members cm_other ON cm_other.club_id = cm_me.club_id
    WHERE cm_me.user_id = auth.uid()
      AND cm_other.user_id = profiles.id
      AND cm_me.role IN ('admin','coach')
  )
  OR EXISTS (
    SELECT 1
    FROM public.clubs c
    JOIN public.club_members cm ON cm.club_id = c.id
    WHERE c.user_id = auth.uid() AND cm.user_id = profiles.id
  )
  OR EXISTS (
    SELECT 1
    FROM public.category_members cm_me
    JOIN public.category_members cm_other ON cm_other.category_id = cm_me.category_id
    WHERE cm_me.user_id = auth.uid()
      AND cm_other.user_id = profiles.id
      AND cm_me.role IN ('admin','coach')
  )
);

-- =========================================================
-- 2) public_access_tokens: hide password/token from co-members
-- =========================================================
DROP POLICY IF EXISTS "Manage category tokens" ON public.public_access_tokens;
DROP POLICY IF EXISTS "Manage club tokens" ON public.public_access_tokens;

-- Creators & admins/coaches can manage tokens they own
CREATE POLICY "Category admins/coaches manage own tokens"
ON public.public_access_tokens
FOR ALL
TO authenticated
USING (
  category_id IS NOT NULL
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = public_access_tokens.category_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin','coach')
  )
)
WITH CHECK (
  category_id IS NOT NULL
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = public_access_tokens.category_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin','coach')
  )
);

CREATE POLICY "Club admins/coaches manage own tokens"
ON public.public_access_tokens
FOR ALL
TO authenticated
USING (
  club_id IS NOT NULL
  AND created_by = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM public.clubs WHERE id = public_access_tokens.club_id AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = public_access_tokens.club_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin','coach')
    )
  )
)
WITH CHECK (
  club_id IS NOT NULL
  AND created_by = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM public.clubs WHERE id = public_access_tokens.club_id AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = public_access_tokens.club_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin','coach')
    )
  )
);

-- =========================================================
-- 3) athlete_access_tokens: restrict mutations to admins/coaches
-- =========================================================
DROP POLICY IF EXISTS "Category members can manage athlete tokens" ON public.athlete_access_tokens;

CREATE POLICY "Category members can read athlete tokens"
ON public.athlete_access_tokens
FOR SELECT
TO authenticated
USING (can_access_category(auth.uid(), category_id));

CREATE POLICY "Only admins/coaches can create athlete tokens"
ON public.athlete_access_tokens
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = athlete_access_tokens.category_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin','coach')
  )
);

CREATE POLICY "Only admins/coaches can update athlete tokens"
ON public.athlete_access_tokens
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = athlete_access_tokens.category_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin','coach')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = athlete_access_tokens.category_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin','coach')
  )
);

CREATE POLICY "Only admins/coaches can delete athlete tokens"
ON public.athlete_access_tokens
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = athlete_access_tokens.category_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin','coach')
  )
);

-- =========================================================
-- 4) Revoke anonymous EXECUTE on SECURITY DEFINER helpers
--    keep only functions actually needed by unauth flows
-- =========================================================
DO $$
DECLARE r record;
  keep text[] := ARRAY[
    'get_maintenance_status',
    'get_invitation_info',
    'get_ambassador_invitation_by_token',
    'validate_athlete_invitation',
    'validate_public_token',
    'accept_athlete_invitation_signup',
    'accept_ambassador_invitation',
    'accept_category_invitation',
    'accept_club_invitation',
    'record_user_consent',
    'has_valid_athlete_token_for_player',
    'has_valid_public_token_for_category',
    'has_valid_public_token_for_club'
  ];
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT (p.proname = ANY(keep))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, PUBLIC;', r.proname, r.args);
  END LOOP;
END $$;
