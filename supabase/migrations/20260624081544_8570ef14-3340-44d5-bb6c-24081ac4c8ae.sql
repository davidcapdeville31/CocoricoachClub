DROP POLICY IF EXISTS "Admin documents deletable by category staff" ON storage.objects;

CREATE POLICY "Admin documents deletable by category staff"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'admin-documents'
  AND public.can_manage_category_documents(auth.uid(), ((storage.foldername(name))[1])::uuid)
);