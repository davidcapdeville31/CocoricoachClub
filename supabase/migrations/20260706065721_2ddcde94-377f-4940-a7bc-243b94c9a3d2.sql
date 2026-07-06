
-- ============================================================
-- Security hardening: match_events RLS, players RLS, search_path
-- ============================================================

-- 1) match_events: require category/club access, not just row existence
DROP POLICY IF EXISTS "match_events_select_staff" ON public.match_events;
DROP POLICY IF EXISTS "match_events_insert_staff" ON public.match_events;
DROP POLICY IF EXISTS "match_events_update_staff" ON public.match_events;
DROP POLICY IF EXISTS "match_events_delete_staff" ON public.match_events;

CREATE POLICY "match_events_select_authorized"
ON public.match_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_events.match_id
      AND public.can_access_category(auth.uid(), m.category_id)
  )
);

CREATE POLICY "match_events_insert_authorized"
ON public.match_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.categories c ON c.id = m.category_id
    WHERE m.id = match_events.match_id
      AND public.can_modify_club_data(auth.uid(), c.club_id)
  )
);

CREATE POLICY "match_events_update_authorized"
ON public.match_events FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.categories c ON c.id = m.category_id
    WHERE m.id = match_events.match_id
      AND public.can_modify_club_data(auth.uid(), c.club_id)
  )
);

CREATE POLICY "match_events_delete_authorized"
ON public.match_events FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.categories c ON c.id = m.category_id
    WHERE m.id = match_events.match_id
      AND public.can_modify_club_data(auth.uid(), c.club_id)
  )
);

-- 2) players: remove the two policies that leak sensitive columns to
--    coach / prepa_physique / administratif via direct SELECT on public.players.
--    These roles must go through the public.players_safe view. Direct raw
--    access remains via the "Players direct access for owners admins medical
--    and self" policy (owner, admin, doctor, physio, self, super_admin).
DROP POLICY IF EXISTS "Category staff can view players" ON public.players;
DROP POLICY IF EXISTS "Club staff can view players" ON public.players;

-- 3) Set immutable search_path on the four flagged functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- 4) Lock down SECURITY DEFINER helper functions that should NEVER be
--    callable from client SDKs (they're used only by triggers / server code).
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- 5) Storage: block anonymous LISTING of public buckets while keeping
--    per-object public GET (URL-based reads still work). Anonymous
--    LIST attempts on these buckets will be rejected; authenticated
--    users may still list.
DO $$
DECLARE
  bucket_ids text[] := ARRAY[
    'category-covers','player-avatars','club-logos','videos',
    'exercise-images','bowling-ball-images','category-photos',
    'email-assets','test-images','exercise-videos','opponent-photos'
  ];
BEGIN
  -- Best-effort cleanup of any pre-existing anon list policy
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Block anon listing of public buckets" ON storage.objects';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Restrictive policy: anon cannot LIST objects in these buckets.
-- Because this is RESTRICTIVE, it AND's with any existing permissive policy.
CREATE POLICY "Block anon listing of public buckets"
ON storage.objects
AS RESTRICTIVE
FOR SELECT
TO anon
USING (
  bucket_id NOT IN (
    'category-covers','player-avatars','club-logos','videos',
    'exercise-images','bowling-ball-images','category-photos',
    'email-assets','test-images','exercise-videos','opponent-photos'
  )
);
