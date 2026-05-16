-- Allow athletes (players linked to auth.uid()) to view opponent profiles in their club
CREATE POLICY "Athletes can view opponent profiles in their club"
ON public.opponent_profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.players p
    JOIN public.categories c ON c.id = p.category_id
    WHERE p.user_id = auth.uid()
      AND c.club_id = opponent_profiles.club_id
  )
);

-- Allow athletes to insert opponent profiles only for their own category
CREATE POLICY "Athletes can insert opponent profiles in their category"
ON public.opponent_profiles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.players p
    JOIN public.categories c ON c.id = p.category_id
    WHERE p.user_id = auth.uid()
      AND c.club_id = opponent_profiles.club_id
      AND p.category_id = opponent_profiles.category_id
  )
);