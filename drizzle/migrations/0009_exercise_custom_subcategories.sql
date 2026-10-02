CREATE TABLE public.exercise_custom_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  exercise_category text NOT NULL,
  name text NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, exercise_category, name)
);
GRANT SELECT, INSERT, DELETE ON public.exercise_custom_subcategories TO authenticated;
GRANT ALL ON public.exercise_custom_subcategories TO service_role;
ALTER TABLE public.exercise_custom_subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View custom subcategories of accessible categories" ON public.exercise_custom_subcategories
  FOR SELECT TO authenticated USING (public.can_access_category(auth.uid(), category_id));
CREATE POLICY "Create custom subcategories in accessible categories" ON public.exercise_custom_subcategories
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.can_access_category(auth.uid(), category_id));
CREATE POLICY "Delete own custom subcategories" ON public.exercise_custom_subcategories
  FOR DELETE TO authenticated USING (created_by = auth.uid());