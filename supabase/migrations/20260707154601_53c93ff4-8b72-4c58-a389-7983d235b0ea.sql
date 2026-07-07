
-- ============ BOWLING BALL IMAGES ============
DROP POLICY IF EXISTS "Authenticated users can upload bowling ball images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update bowling ball images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete bowling ball images" ON storage.objects;

CREATE POLICY "Bowling ball images write - scoped"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bowling-ball-images'
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.bowling_ball_catalog bc
      WHERE bc.id::text = split_part(split_part(name, '/', 2), '.', 1)
        AND bc.club_id IS NOT NULL
        AND public.can_modify_club_data(auth.uid(), bc.club_id)
    )
  )
);

CREATE POLICY "Bowling ball images update - scoped"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'bowling-ball-images'
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.bowling_ball_catalog bc
      WHERE bc.id::text = split_part(split_part(name, '/', 2), '.', 1)
        AND bc.club_id IS NOT NULL
        AND public.can_modify_club_data(auth.uid(), bc.club_id)
    )
  )
);

CREATE POLICY "Bowling ball images delete - scoped"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'bowling-ball-images'
  AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.bowling_ball_catalog bc
      WHERE bc.id::text = split_part(split_part(name, '/', 2), '.', 1)
        AND bc.club_id IS NOT NULL
        AND public.can_modify_club_data(auth.uid(), bc.club_id)
    )
  )
);

-- ============ CATEGORY PHOTOS ============
DROP POLICY IF EXISTS "Authenticated users can upload category photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own category photos" ON storage.objects;

CREATE POLICY "Category photos upload - scoped"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'category-photos'
  AND public.can_access_category(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Category photos update - scoped"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'category-photos'
  AND public.can_access_category(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Category photos delete - scoped"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'category-photos'
  AND public.can_access_category(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- ============ CLUB LOGOS ============
DROP POLICY IF EXISTS "Authenticated users can upload club logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update club logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete club logos" ON storage.objects;
DROP POLICY IF EXISTS "Club owners can upload their club logo" ON storage.objects;
DROP POLICY IF EXISTS "Club owners can update their club logo" ON storage.objects;
DROP POLICY IF EXISTS "Club owners can delete their club logo" ON storage.objects;

CREATE POLICY "Club logos upload - scoped"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'club-logos'
  AND public.can_modify_club_data(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Club logos update - scoped"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'club-logos'
  AND public.can_modify_club_data(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Club logos delete - scoped"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'club-logos'
  AND public.can_modify_club_data(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- ============ EXERCISE IMAGES (remove unscoped duplicates) ============
DROP POLICY IF EXISTS "Users can delete own exercise images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own exercise images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload exercise images" ON storage.objects;

-- ============ OPPONENT PHOTOS ============
DROP POLICY IF EXISTS "Authenticated users can upload opponent photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update opponent photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete opponent photos" ON storage.objects;

CREATE POLICY "Opponent photos upload - scoped"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'opponent-photos'
  AND public.can_modify_club_data(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Opponent photos update - scoped"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'opponent-photos'
  AND public.can_modify_club_data(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Opponent photos delete - scoped"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'opponent-photos'
  AND public.can_modify_club_data(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- ============ TEST IMAGES ============
DROP POLICY IF EXISTS "Authenticated users can upload test images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update test images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete test images" ON storage.objects;

-- System test images (path: system-tests/...): super admin only
CREATE POLICY "Test images system write - super admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'test-images'
  AND (storage.foldername(name))[1] = 'system-tests'
  AND public.is_super_admin(auth.uid())
);
CREATE POLICY "Test images system update - super admin"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'test-images'
  AND (storage.foldername(name))[1] = 'system-tests'
  AND public.is_super_admin(auth.uid())
);
CREATE POLICY "Test images system delete - super admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'test-images'
  AND (storage.foldername(name))[1] = 'system-tests'
  AND public.is_super_admin(auth.uid())
);

-- Custom test images (path: custom-tests/{categoryId}/... OR {categoryId}/...)
CREATE POLICY "Test images custom write - category member"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'test-images'
  AND (
    (
      (storage.foldername(name))[1] = 'custom-tests'
      AND public.can_access_category(auth.uid(), ((storage.foldername(name))[2])::uuid)
    )
    OR (
      (storage.foldername(name))[1] <> 'system-tests'
      AND (storage.foldername(name))[1] <> 'custom-tests'
      AND public.can_access_category(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);
CREATE POLICY "Test images custom update - category member"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'test-images'
  AND (
    (
      (storage.foldername(name))[1] = 'custom-tests'
      AND public.can_access_category(auth.uid(), ((storage.foldername(name))[2])::uuid)
    )
    OR (
      (storage.foldername(name))[1] <> 'system-tests'
      AND (storage.foldername(name))[1] <> 'custom-tests'
      AND public.can_access_category(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);
CREATE POLICY "Test images custom delete - category member"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'test-images'
  AND (
    (
      (storage.foldername(name))[1] = 'custom-tests'
      AND public.can_access_category(auth.uid(), ((storage.foldername(name))[2])::uuid)
    )
    OR (
      (storage.foldername(name))[1] <> 'system-tests'
      AND (storage.foldername(name))[1] <> 'custom-tests'
      AND public.can_access_category(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);

-- ============ REVOKE ANON EXECUTE ON INTERNAL SECURITY DEFINER HELPERS ============
REVOKE EXECUTE ON FUNCTION public.has_valid_athlete_token_for_player(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff_for_player_multi(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_user_consent(consent_type, boolean, text, jsonb) FROM anon, PUBLIC;
