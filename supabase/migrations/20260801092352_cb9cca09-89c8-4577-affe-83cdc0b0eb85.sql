DROP POLICY IF EXISTS "Staff can upload category cover images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update category cover images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete category cover images" ON storage.objects;

CREATE POLICY "Staff can upload category cover images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'category-covers' AND EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id::text = (storage.foldername(objects.name))[1]
      AND (public.can_modify_club_data(auth.uid(), c.club_id) OR public.is_super_admin(auth.uid()))
  )
);

CREATE POLICY "Staff can update category cover images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'category-covers' AND EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id::text = (storage.foldername(objects.name))[1]
      AND (public.can_modify_club_data(auth.uid(), c.club_id) OR public.is_super_admin(auth.uid()))
  )
)
WITH CHECK (
  bucket_id = 'category-covers' AND EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id::text = (storage.foldername(objects.name))[1]
      AND (public.can_modify_club_data(auth.uid(), c.club_id) OR public.is_super_admin(auth.uid()))
  )
);

CREATE POLICY "Staff can delete category cover images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'category-covers' AND EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id::text = (storage.foldername(objects.name))[1]
      AND (public.can_modify_club_data(auth.uid(), c.club_id) OR public.is_super_admin(auth.uid()))
  )
);