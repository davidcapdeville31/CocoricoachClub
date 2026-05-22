
CREATE TABLE public.illnesses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid NOT NULL,
  category_id uuid NOT NULL,
  illness_type text NOT NULL,
  illness_date date NOT NULL DEFAULT CURRENT_DATE,
  severity text NOT NULL DEFAULT 'légère',
  status text NOT NULL DEFAULT 'active',
  estimated_return_date date,
  actual_return_date date,
  description text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_illnesses_category ON public.illnesses(category_id);
CREATE INDEX idx_illnesses_player ON public.illnesses(player_id);

ALTER TABLE public.illnesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated staff can view illnesses"
ON public.illnesses FOR SELECT
USING (EXISTS (
  SELECT 1 FROM categories c JOIN clubs cl ON cl.id = c.club_id
  WHERE c.id = illnesses.category_id
    AND (cl.user_id = auth.uid() OR has_medical_or_coaching_access(auth.uid(), cl.id))
));

CREATE POLICY "Authenticated medical staff can insert illnesses"
ON public.illnesses FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM categories c JOIN clubs cl ON cl.id = c.club_id
  WHERE c.id = illnesses.category_id
    AND (cl.user_id = auth.uid() OR has_medical_or_coaching_access(auth.uid(), cl.id))
));

CREATE POLICY "Authenticated medical staff can update illnesses"
ON public.illnesses FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM categories c JOIN clubs cl ON cl.id = c.club_id
  WHERE c.id = illnesses.category_id
    AND (cl.user_id = auth.uid() OR has_medical_or_coaching_access(auth.uid(), cl.id))
));

CREATE POLICY "Authenticated medical staff can delete illnesses"
ON public.illnesses FOR DELETE
USING (EXISTS (
  SELECT 1 FROM categories c JOIN clubs cl ON cl.id = c.club_id
  WHERE c.id = illnesses.category_id
    AND (cl.user_id = auth.uid() OR has_medical_or_coaching_access(auth.uid(), cl.id))
));

CREATE POLICY "Club members with access can insert illnesses"
ON public.illnesses FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM categories c JOIN clubs cl ON cl.id = c.club_id
  WHERE c.id = illnesses.category_id AND can_modify_club_data(auth.uid(), cl.id)
));

CREATE POLICY "Club members with access can update illnesses"
ON public.illnesses FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM categories c JOIN clubs cl ON cl.id = c.club_id
  WHERE c.id = illnesses.category_id AND can_modify_club_data(auth.uid(), cl.id)
));

CREATE POLICY "Club members with access can delete illnesses"
ON public.illnesses FOR DELETE
USING (EXISTS (
  SELECT 1 FROM categories c JOIN clubs cl ON cl.id = c.club_id
  WHERE c.id = illnesses.category_id AND can_modify_club_data(auth.uid(), cl.id)
));

CREATE TRIGGER update_illnesses_updated_at
BEFORE UPDATE ON public.illnesses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
