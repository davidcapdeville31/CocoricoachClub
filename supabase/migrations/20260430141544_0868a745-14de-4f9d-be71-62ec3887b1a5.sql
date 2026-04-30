
-- Table pour stocker les catégories thématiques de tests (indépendantes des tests)
CREATE TABLE IF NOT EXISTS public.test_theme_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (category_id, value)
);

ALTER TABLE public.test_theme_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view test theme categories"
ON public.test_theme_categories FOR SELECT
TO authenticated
USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Admins can manage test theme categories"
ON public.test_theme_categories FOR ALL
TO authenticated
USING (public.can_modify_club_data(auth.uid(), club_id))
WITH CHECK (public.can_modify_club_data(auth.uid(), club_id));

-- Ajouter le champ "objectives" sur custom_tests
ALTER TABLE public.custom_tests ADD COLUMN IF NOT EXISTS objectives TEXT;
