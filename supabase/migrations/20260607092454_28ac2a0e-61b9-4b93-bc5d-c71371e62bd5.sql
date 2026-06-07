
-- Helper: check if a match is the personal match of the current user
CREATE OR REPLACE FUNCTION public.is_own_personal_match(_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.players p ON p.id = m.created_by_player_id
    WHERE m.id = _match_id
      AND m.is_personal = true
      AND p.user_id = auth.uid()
  )
$$;

-- competition_rounds: athlete owner of personal match can manage
CREATE POLICY "Personal match owner can select competition_rounds"
  ON public.competition_rounds FOR SELECT TO authenticated
  USING (public.is_own_personal_match(match_id));

CREATE POLICY "Personal match owner can insert competition_rounds"
  ON public.competition_rounds FOR INSERT TO authenticated
  WITH CHECK (public.is_own_personal_match(match_id));

CREATE POLICY "Personal match owner can update competition_rounds"
  ON public.competition_rounds FOR UPDATE TO authenticated
  USING (public.is_own_personal_match(match_id))
  WITH CHECK (public.is_own_personal_match(match_id));

CREATE POLICY "Personal match owner can delete competition_rounds"
  ON public.competition_rounds FOR DELETE TO authenticated
  USING (public.is_own_personal_match(match_id));

-- competition_round_stats: same via round → match
CREATE POLICY "Personal match owner can select round_stats"
  ON public.competition_round_stats FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.competition_rounds r
    WHERE r.id = competition_round_stats.round_id
      AND public.is_own_personal_match(r.match_id)
  ));

CREATE POLICY "Personal match owner can insert round_stats"
  ON public.competition_round_stats FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.competition_rounds r
    WHERE r.id = competition_round_stats.round_id
      AND public.is_own_personal_match(r.match_id)
  ));

CREATE POLICY "Personal match owner can update round_stats"
  ON public.competition_round_stats FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.competition_rounds r
    WHERE r.id = competition_round_stats.round_id
      AND public.is_own_personal_match(r.match_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.competition_rounds r
    WHERE r.id = competition_round_stats.round_id
      AND public.is_own_personal_match(r.match_id)
  ));

CREATE POLICY "Personal match owner can delete round_stats"
  ON public.competition_round_stats FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.competition_rounds r
    WHERE r.id = competition_round_stats.round_id
      AND public.is_own_personal_match(r.match_id)
  ));

-- bowling_oil_patterns: when attached to a personal match owned by the athlete
CREATE POLICY "Personal match owner can select oil_patterns"
  ON public.bowling_oil_patterns FOR SELECT TO authenticated
  USING (match_id IS NOT NULL AND public.is_own_personal_match(match_id));

CREATE POLICY "Personal match owner can insert oil_patterns"
  ON public.bowling_oil_patterns FOR INSERT TO authenticated
  WITH CHECK (match_id IS NOT NULL AND public.is_own_personal_match(match_id));

CREATE POLICY "Personal match owner can update oil_patterns"
  ON public.bowling_oil_patterns FOR UPDATE TO authenticated
  USING (match_id IS NOT NULL AND public.is_own_personal_match(match_id))
  WITH CHECK (match_id IS NOT NULL AND public.is_own_personal_match(match_id));

CREATE POLICY "Personal match owner can delete oil_patterns"
  ON public.bowling_oil_patterns FOR DELETE TO authenticated
  USING (match_id IS NOT NULL AND public.is_own_personal_match(match_id));

-- bowling_oil_pattern_players: via pattern → match
CREATE POLICY "Personal match owner can select oil_pattern_players"
  ON public.bowling_oil_pattern_players FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bowling_oil_patterns p
    WHERE p.id = bowling_oil_pattern_players.oil_pattern_id
      AND p.match_id IS NOT NULL
      AND public.is_own_personal_match(p.match_id)
  ));

CREATE POLICY "Personal match owner can insert oil_pattern_players"
  ON public.bowling_oil_pattern_players FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bowling_oil_patterns p
    WHERE p.id = bowling_oil_pattern_players.oil_pattern_id
      AND p.match_id IS NOT NULL
      AND public.is_own_personal_match(p.match_id)
  ));

CREATE POLICY "Personal match owner can delete oil_pattern_players"
  ON public.bowling_oil_pattern_players FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bowling_oil_patterns p
    WHERE p.id = bowling_oil_pattern_players.oil_pattern_id
      AND p.match_id IS NOT NULL
      AND public.is_own_personal_match(p.match_id)
  ));
