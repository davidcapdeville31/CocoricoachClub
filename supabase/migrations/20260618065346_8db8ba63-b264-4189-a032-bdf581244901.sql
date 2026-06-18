WITH target_rounds AS (
  SELECT r.id
  FROM public.competition_rounds r
  JOIN public.competition_round_stats s ON s.round_id = r.id
  WHERE r.match_id = 'ae80f638-8bdb-48e9-a046-004d7b13a6ce'::uuid
    AND r.player_id = '8b45d05f-caea-4e35-853b-f5063c7eed97'::uuid
    AND s.stat_data ->> 'blockId' = 'block_1781764433645_8b45d05f-caea-4e35-853b-f5063c7eed97'
    AND s.stat_data ->> 'bowlingCategory' = 'equipe_5'
)
DELETE FROM public.competition_round_stats s
USING target_rounds tr
WHERE s.round_id = tr.id;

WITH target_rounds AS (
  SELECT r.id
  FROM public.competition_rounds r
  WHERE r.match_id = 'ae80f638-8bdb-48e9-a046-004d7b13a6ce'::uuid
    AND r.player_id = '8b45d05f-caea-4e35-853b-f5063c7eed97'::uuid
    AND r.round_number IN (19, 20, 21)
    AND NOT EXISTS (
      SELECT 1
      FROM public.competition_round_stats s
      WHERE s.round_id = r.id
    )
)
DELETE FROM public.competition_rounds r
USING target_rounds tr
WHERE r.id = tr.id;