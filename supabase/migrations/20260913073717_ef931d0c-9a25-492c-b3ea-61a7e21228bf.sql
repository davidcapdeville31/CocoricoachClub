
CREATE POLICY "ml_athlete_select_self" ON public.match_lineups
FOR SELECT TO authenticated
USING (public.player_belongs_to_user(player_id, auth.uid()));

CREATE POLICY "cr_athlete_select_self" ON public.competition_rounds
FOR SELECT TO authenticated
USING (public.player_belongs_to_user(player_id, auth.uid()));

CREATE POLICY "crs_athlete_select_self" ON public.competition_round_stats
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.competition_rounds r
  WHERE r.id = competition_round_stats.round_id
    AND public.player_belongs_to_user(r.player_id, auth.uid())
));
