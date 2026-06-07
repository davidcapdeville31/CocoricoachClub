DELETE FROM public.wellness_tracking wt
USING public.categories c
WHERE wt.category_id = c.id
  AND lower(c.rugby_type) LIKE 'bowling%'
  AND (
    (EXTRACT(hour FROM wt.created_at AT TIME ZONE 'UTC') = 21 AND EXTRACT(minute FROM wt.created_at AT TIME ZONE 'UTC') BETWEEN 54 AND 57)
    OR
    (EXTRACT(hour FROM wt.created_at AT TIME ZONE 'UTC') = 22 AND EXTRACT(minute FROM wt.created_at AT TIME ZONE 'UTC') BETWEEN 54 AND 57)
    OR
    (EXTRACT(hour FROM wt.created_at AT TIME ZONE 'UTC') = 23 AND EXTRACT(minute FROM wt.created_at AT TIME ZONE 'UTC') BETWEEN 58 AND 59)
  );