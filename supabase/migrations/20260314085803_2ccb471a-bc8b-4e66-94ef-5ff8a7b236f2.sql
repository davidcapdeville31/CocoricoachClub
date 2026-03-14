-- Allow super admins to manage categories (insert/update/delete)
CREATE POLICY "Super admins can insert categories"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update categories"
ON public.categories
FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete categories"
ON public.categories
FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));