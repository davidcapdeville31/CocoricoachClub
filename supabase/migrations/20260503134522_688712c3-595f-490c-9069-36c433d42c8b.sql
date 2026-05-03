
CREATE TABLE IF NOT EXISTS public.pending_test_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  training_session_id UUID REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  test_category TEXT NOT NULL,
  test_type TEXT NOT NULL,
  result_value NUMERIC NOT NULL,
  result_unit TEXT,
  notes TEXT,
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending','validated','rejected')),
  submitted_via TEXT NOT NULL DEFAULT 'athlete',
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_test_results_category ON public.pending_test_results(category_id, validation_status);
CREATE INDEX IF NOT EXISTS idx_pending_test_results_player ON public.pending_test_results(player_id);

ALTER TABLE public.pending_test_results ENABLE ROW LEVEL SECURITY;

-- Staff (club members) full access
CREATE POLICY "Club members can view pending test results"
ON public.pending_test_results FOR SELECT
USING (EXISTS (
  SELECT 1 FROM categories c
  JOIN clubs cl ON cl.id = c.club_id
  WHERE c.id = pending_test_results.category_id AND can_modify_club_data(auth.uid(), cl.id)
));

CREATE POLICY "Club members can update pending test results"
ON public.pending_test_results FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM categories c
  JOIN clubs cl ON cl.id = c.club_id
  WHERE c.id = pending_test_results.category_id AND can_modify_club_data(auth.uid(), cl.id)
));

CREATE POLICY "Club members can delete pending test results"
ON public.pending_test_results FOR DELETE
USING (EXISTS (
  SELECT 1 FROM categories c
  JOIN clubs cl ON cl.id = c.club_id
  WHERE c.id = pending_test_results.category_id AND can_modify_club_data(auth.uid(), cl.id)
));

-- Trigger updated_at
CREATE TRIGGER update_pending_test_results_updated_at
BEFORE UPDATE ON public.pending_test_results
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
