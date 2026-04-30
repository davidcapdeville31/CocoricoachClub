-- Add scoring scale + structured unit fields to custom_tests
ALTER TABLE public.custom_tests
  ADD COLUMN IF NOT EXISTS unit_kind text,
  ADD COLUMN IF NOT EXISTS scoring_scale jsonb,
  ADD COLUMN IF NOT EXISTS max_points numeric;

-- Test batteries (réutilisables)
CREATE TABLE IF NOT EXISTS public.test_batteries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  levels jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tests inclus dans une batterie (référence un custom_test OU un test standard via test_type)
CREATE TABLE IF NOT EXISTS public.test_battery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battery_id uuid NOT NULL REFERENCES public.test_batteries(id) ON DELETE CASCADE,
  custom_test_id uuid REFERENCES public.custom_tests(id) ON DELETE CASCADE,
  test_category text,
  test_type text,
  test_name text,
  unit text,
  unit_kind text,
  scoring_scale jsonb,
  max_points numeric,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_batteries_club ON public.test_batteries(club_id);
CREATE INDEX IF NOT EXISTS idx_test_batteries_category ON public.test_batteries(category_id);
CREATE INDEX IF NOT EXISTS idx_test_battery_items_battery ON public.test_battery_items(battery_id);

ALTER TABLE public.test_batteries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_battery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view test batteries"
  ON public.test_batteries FOR SELECT TO authenticated
  USING (public.can_access_club(auth.uid(), club_id));

CREATE POLICY "Club admins can manage test batteries"
  ON public.test_batteries FOR ALL TO authenticated
  USING (public.can_modify_club_data(auth.uid(), club_id))
  WITH CHECK (public.can_modify_club_data(auth.uid(), club_id));

CREATE POLICY "Members can view battery items"
  ON public.test_battery_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.test_batteries b
    WHERE b.id = battery_id AND public.can_access_club(auth.uid(), b.club_id)
  ));

CREATE POLICY "Admins can manage battery items"
  ON public.test_battery_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.test_batteries b
    WHERE b.id = battery_id AND public.can_modify_club_data(auth.uid(), b.club_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.test_batteries b
    WHERE b.id = battery_id AND public.can_modify_club_data(auth.uid(), b.club_id)
  ));

CREATE TRIGGER set_test_batteries_updated_at
  BEFORE UPDATE ON public.test_batteries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();