
-- Extend opponent_profiles with tactical & rich profile fields
ALTER TABLE public.opponent_profiles
  ADD COLUMN IF NOT EXISTS combat_profile smallint
    CHECK (combat_profile IS NULL OR combat_profile BETWEEN 1 AND 6),
  ADD COLUMN IF NOT EXISTS style_mask integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ground_standing_pref smallint
    CHECK (ground_standing_pref IS NULL OR ground_standing_pref BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS palmares text,
  ADD COLUMN IF NOT EXISTS age_category text;

-- Drop restrictive policies (only admins/coaches could write)
DROP POLICY IF EXISTS "Club admins/coaches can insert opponent profiles" ON public.opponent_profiles;
DROP POLICY IF EXISTS "Club admins/coaches can update opponent profiles" ON public.opponent_profiles;
DROP POLICY IF EXISTS "Club admins/coaches can delete opponent profiles" ON public.opponent_profiles;

-- New permissive policies: any club member (incl. athletes) can manage opponents
CREATE POLICY "Club members can insert opponent profiles"
ON public.opponent_profiles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clubs cl
    WHERE cl.id = opponent_profiles.club_id
      AND (
        cl.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members cm
          WHERE cm.club_id = cl.id AND cm.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Club members can update opponent profiles"
ON public.opponent_profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.clubs cl
    WHERE cl.id = opponent_profiles.club_id
      AND (
        cl.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members cm
          WHERE cm.club_id = cl.id AND cm.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Club members can delete opponent profiles"
ON public.opponent_profiles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.clubs cl
    WHERE cl.id = opponent_profiles.club_id
      AND (
        cl.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members cm
          WHERE cm.club_id = cl.id AND cm.user_id = auth.uid()
        )
      )
  )
);

-- Public storage bucket for opponent photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('opponent-photos', 'opponent-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Opponent photos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'opponent-photos');

CREATE POLICY "Authenticated users can upload opponent photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'opponent-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update opponent photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'opponent-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete opponent photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'opponent-photos' AND auth.uid() IS NOT NULL);
