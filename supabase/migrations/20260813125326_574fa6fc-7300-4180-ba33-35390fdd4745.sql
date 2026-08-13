INSERT INTO public.wellness_tracking
  (player_id, category_id, tracking_date, auto_filled,
   sleep_quality, sleep_duration, general_fatigue, stress_level,
   soreness_upper_body, soreness_lower_body, has_specific_pain, custom_answers)
SELECT p.id, p.category_id, DATE '2026-08-12', true,
       5, 5, 0, 0, 0, 0, false, '{"custom_1784191985755": 3}'::jsonb
FROM public.players p
WHERE p.category_id = 'dd51f47c-c291-4f76-a842-15e57a9cbd3a'
  AND NOT EXISTS (
    SELECT 1 FROM public.wellness_tracking w
    WHERE w.player_id = p.id
      AND w.category_id = p.category_id
      AND w.tracking_date = DATE '2026-08-12'
  );