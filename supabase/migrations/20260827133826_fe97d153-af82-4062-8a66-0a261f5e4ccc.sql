DELETE FROM public.pending_test_results WHERE test_type = 'probe_rls_test';

CREATE POLICY "Club staff can insert pending test results"
ON public.pending_test_results
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.categories c
    JOIN public.clubs cl ON cl.id = c.club_id
    WHERE c.id = pending_test_results.category_id
      AND public.can_modify_club_data(auth.uid(), cl.id)
  )
);