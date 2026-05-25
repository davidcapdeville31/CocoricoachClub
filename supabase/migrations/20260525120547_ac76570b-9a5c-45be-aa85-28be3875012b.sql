
-- 1) admin-documents storage: scope by category folder
DROP POLICY IF EXISTS "Authenticated users can read admin documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload admin documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete admin documents" ON storage.objects;

CREATE POLICY "Admin documents readable by category members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'admin-documents'
  AND public.can_access_category(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Admin documents uploadable by category staff"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'admin-documents'
  AND public.can_access_category(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Admin documents deletable by category staff"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'admin-documents'
  AND public.can_access_category(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 2) ambassador_invitations: remove public broad SELECT; expose token lookup via SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.ambassador_invitations;
DROP POLICY IF EXISTS "Token-based ambassador invitation lookup" ON public.ambassador_invitations;

CREATE OR REPLACE FUNCTION public.get_ambassador_invitation_by_token(invitation_token text)
RETURNS TABLE(email text, name text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email, name, status
  FROM public.ambassador_invitations
  WHERE token = invitation_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_ambassador_invitation_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ambassador_invitation_by_token(text) TO anon, authenticated;

-- 3) bowling_oil_pattern_players: scope by category of the parent oil pattern
DROP POLICY IF EXISTS "Authenticated users can manage oil pattern assignments" ON public.bowling_oil_pattern_players;
DROP POLICY IF EXISTS "Authenticated users can delete oil pattern assignments" ON public.bowling_oil_pattern_players;
DROP POLICY IF EXISTS "Authenticated users can view oil pattern assignments" ON public.bowling_oil_pattern_players;

CREATE POLICY "Oil pattern assignments view by category access"
ON public.bowling_oil_pattern_players FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.bowling_oil_patterns p
  WHERE p.id = bowling_oil_pattern_players.oil_pattern_id
    AND (p.category_id IS NULL OR public.can_access_category(auth.uid(), p.category_id))
));

CREATE POLICY "Oil pattern assignments insert by category access"
ON public.bowling_oil_pattern_players FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.bowling_oil_patterns p
  WHERE p.id = bowling_oil_pattern_players.oil_pattern_id
    AND p.category_id IS NOT NULL
    AND public.can_access_category(auth.uid(), p.category_id)
));

CREATE POLICY "Oil pattern assignments delete by category access"
ON public.bowling_oil_pattern_players FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.bowling_oil_patterns p
  WHERE p.id = bowling_oil_pattern_players.oil_pattern_id
    AND p.category_id IS NOT NULL
    AND public.can_access_category(auth.uid(), p.category_id)
));

-- 4) match_events: remove anonymous read
DROP POLICY IF EXISTS "match_events_select_public" ON public.match_events;

-- 5) periodization_saved_colors: scope by category
DROP POLICY IF EXISTS "Authenticated users can view saved colors" ON public.periodization_saved_colors;
DROP POLICY IF EXISTS "Authenticated users can insert saved colors" ON public.periodization_saved_colors;
DROP POLICY IF EXISTS "Authenticated users can delete saved colors" ON public.periodization_saved_colors;

CREATE POLICY "Saved colors viewable by category access"
ON public.periodization_saved_colors FOR SELECT TO authenticated
USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Saved colors insert by category access"
ON public.periodization_saved_colors FOR INSERT TO authenticated
WITH CHECK (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Saved colors delete by category access"
ON public.periodization_saved_colors FOR DELETE TO authenticated
USING (public.can_access_category(auth.uid(), category_id));

-- 6) players: remove coach/prepa_physique/administratif from direct full-row SELECT (must use players_safe)
DROP POLICY IF EXISTS "Players viewable by category staff" ON public.players;
