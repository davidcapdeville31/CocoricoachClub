-- Simplify the update policy to allow all users who can access the club
DROP POLICY IF EXISTS "Club owners and staff can update injuries" ON public.injuries;

CREATE POLICY "Club members can update injuries"
ON public.injuries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM categories
    JOIN clubs ON clubs.id = categories.club_id
    WHERE categories.id = injuries.category_id
    AND (
      clubs.user_id = auth.uid()
      OR can_access_club(auth.uid(), clubs.id)
    )
  )
);

-- Simplify delete policy
DROP POLICY IF EXISTS "Club owners and staff can delete injuries" ON public.injuries;

CREATE POLICY "Club members can delete injuries"
ON public.injuries
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM categories
    JOIN clubs ON clubs.id = categories.club_id
    WHERE categories.id = injuries.category_id
    AND (
      clubs.user_id = auth.uid()
      OR can_access_club(auth.uid(), clubs.id)
    )
  )
);

-- Simplify insert policy
DROP POLICY IF EXISTS "Club owners and staff can insert injuries" ON public.injuries;

CREATE POLICY "Club members can insert injuries"
ON public.injuries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM categories
    JOIN clubs ON clubs.id = categories.club_id
    WHERE categories.id = injuries.category_id
    AND (
      clubs.user_id = auth.uid()
      OR can_access_club(auth.uid(), clubs.id)
    )
  )
);