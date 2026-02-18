-- Allow category members to view their categories
CREATE POLICY "Category members can view their categories"
ON public.categories
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.category_members
    WHERE category_members.category_id = categories.id
    AND category_members.user_id = auth.uid()
  )
);

-- Allow category members to view the club of their category
CREATE POLICY "Category members can view related clubs"
ON public.clubs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.categories c
    JOIN public.category_members cm ON cm.category_id = c.id
    WHERE c.club_id = clubs.id
    AND cm.user_id = auth.uid()
  )
);