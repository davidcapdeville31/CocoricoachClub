-- Add DELETE policy for injury_protocols
CREATE POLICY "Delete category protocols" 
ON public.injury_protocols 
FOR DELETE 
USING (
  category_id IN (
    SELECT category_id FROM category_members WHERE user_id = auth.uid()
  )
  OR category_id IN (
    SELECT c.id FROM categories c
    JOIN clubs cl ON c.club_id = cl.id
    WHERE cl.user_id = auth.uid()
  )
);