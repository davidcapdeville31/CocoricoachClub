DROP POLICY IF EXISTS "Authenticated can add content translations" ON public.content_translations;
DROP POLICY IF EXISTS "Authenticated can update content translations" ON public.content_translations;
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
CREATE POLICY "Authenticated users can upload own videos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Public read access to exercise images" ON storage.objects;
DROP POLICY IF EXISTS "Club logos are publicly readable" ON storage.objects;