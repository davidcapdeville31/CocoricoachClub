
CREATE POLICY "Players can insert own pending test results"
ON public.pending_test_results FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = pending_test_results.player_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Players can view own pending test results"
ON public.pending_test_results FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = pending_test_results.player_id AND p.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = pending_test_results.category_id AND can_modify_club_data(auth.uid(), cl.id)
  )
);
