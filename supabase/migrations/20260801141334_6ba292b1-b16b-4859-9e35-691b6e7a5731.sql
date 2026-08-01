DROP POLICY IF EXISTS "Club owners can upload player avatars" ON storage.objects;
DROP POLICY IF EXISTS "Club owners can update player avatars" ON storage.objects;
DROP POLICY IF EXISTS "Club owners can delete player avatars" ON storage.objects;

CREATE POLICY "Staff can upload player avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'player-avatars'
  AND (
    public.is_staff_for_player_multi(((storage.foldername(name))[1])::uuid)
    OR public.player_belongs_to_user(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

CREATE POLICY "Staff can update player avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'player-avatars'
  AND (
    public.is_staff_for_player_multi(((storage.foldername(name))[1])::uuid)
    OR public.player_belongs_to_user(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

CREATE POLICY "Staff can delete player avatars"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'player-avatars'
  AND (
    public.is_staff_for_player_multi(((storage.foldername(name))[1])::uuid)
    OR public.player_belongs_to_user(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);