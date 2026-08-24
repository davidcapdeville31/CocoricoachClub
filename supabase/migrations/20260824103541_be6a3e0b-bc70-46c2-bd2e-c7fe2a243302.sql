
CREATE POLICY "Users upload exercise images in own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exercise-images' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Users update exercise images in own folder"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'exercise-images' AND (storage.foldername(name))[1] = (auth.uid())::text)
WITH CHECK (bucket_id = 'exercise-images' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Users delete exercise images in own folder"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'exercise-images' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Super admin manage all exercise images insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exercise-images' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin manage all exercise images update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'exercise-images' AND public.is_super_admin(auth.uid()))
WITH CHECK (bucket_id = 'exercise-images' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin manage all exercise images delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'exercise-images' AND public.is_super_admin(auth.uid()));
