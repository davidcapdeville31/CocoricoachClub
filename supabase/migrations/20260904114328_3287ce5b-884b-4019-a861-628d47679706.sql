DELETE FROM public.awcr_tracking a
WHERE a.training_session_id IS NULL
  AND COALESCE(a.rpe, 0) = 0
  AND EXISTS (
    SELECT 1 FROM public.awcr_tracking b
    WHERE b.player_id = a.player_id
      AND b.session_date = a.session_date
      AND b.id <> a.id
      AND (COALESCE(b.rpe, 0) > 0 OR b.training_session_id IS NOT NULL)
  );