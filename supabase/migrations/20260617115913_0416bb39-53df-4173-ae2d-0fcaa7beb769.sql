
-- competition_rounds: add 'administratif' to INSERT and DELETE
DROP POLICY IF EXISTS "Users can insert competition rounds for their categories" ON public.competition_rounds;
CREATE POLICY "Users can insert competition rounds for their categories"
ON public.competition_rounds
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM matches m
    JOIN categories c ON m.category_id = c.id
    JOIN clubs cl ON c.club_id = cl.id
    WHERE m.id = competition_rounds.match_id
      AND (
        cl.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM club_members cm WHERE cm.club_id = cl.id AND cm.user_id = auth.uid() AND cm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role,'administratif'::app_role]))
        OR EXISTS (SELECT 1 FROM category_members catm WHERE catm.category_id = c.id AND catm.user_id = auth.uid() AND catm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role,'administratif'::app_role]))
      )
  )
);

-- competition_round_stats: add 'administratif' to INSERT
DROP POLICY IF EXISTS "Users can insert competition round stats" ON public.competition_round_stats;
CREATE POLICY "Users can insert competition round stats"
ON public.competition_round_stats
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM competition_rounds cr
    JOIN matches m ON cr.match_id = m.id
    JOIN categories c ON m.category_id = c.id
    JOIN clubs cl ON c.club_id = cl.id
    WHERE cr.id = competition_round_stats.round_id
      AND (
        cl.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM club_members cm WHERE cm.club_id = cl.id AND cm.user_id = auth.uid() AND cm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role,'administratif'::app_role]))
        OR EXISTS (SELECT 1 FROM category_members catm WHERE catm.category_id = c.id AND catm.user_id = auth.uid() AND catm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role,'administratif'::app_role]))
      )
  )
);
