
-- Helper: is _player_id owned by _user_id?
CREATE OR REPLACE FUNCTION public.player_belongs_to_user(_player_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = _player_id AND p.user_id = _user_id
  );
$$;

-- bowling_training_blocks: athlete self-manage own blocks
DROP POLICY IF EXISTS "btb_athlete_insert" ON public.bowling_training_blocks;
CREATE POLICY "btb_athlete_insert" ON public.bowling_training_blocks
  FOR INSERT TO authenticated
  WITH CHECK (public.player_belongs_to_user(athlete_id, auth.uid()));
DROP POLICY IF EXISTS "btb_athlete_update" ON public.bowling_training_blocks;
CREATE POLICY "btb_athlete_update" ON public.bowling_training_blocks
  FOR UPDATE TO authenticated
  USING (public.player_belongs_to_user(athlete_id, auth.uid()))
  WITH CHECK (public.player_belongs_to_user(athlete_id, auth.uid()));
DROP POLICY IF EXISTS "btb_athlete_delete" ON public.bowling_training_blocks;
CREATE POLICY "btb_athlete_delete" ON public.bowling_training_blocks
  FOR DELETE TO authenticated
  USING (public.player_belongs_to_user(athlete_id, auth.uid()));

-- training_attendance: athlete self-manage own attendance
DROP POLICY IF EXISTS "ta_athlete_insert_self" ON public.training_attendance;
CREATE POLICY "ta_athlete_insert_self" ON public.training_attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.player_belongs_to_user(player_id, auth.uid()));
DROP POLICY IF EXISTS "ta_athlete_update_self" ON public.training_attendance;
CREATE POLICY "ta_athlete_update_self" ON public.training_attendance
  FOR UPDATE TO authenticated
  USING (public.player_belongs_to_user(player_id, auth.uid()))
  WITH CHECK (public.player_belongs_to_user(player_id, auth.uid()));
DROP POLICY IF EXISTS "ta_athlete_delete_self" ON public.training_attendance;
CREATE POLICY "ta_athlete_delete_self" ON public.training_attendance
  FOR DELETE TO authenticated
  USING (public.player_belongs_to_user(player_id, auth.uid()));
DROP POLICY IF EXISTS "ta_athlete_select_self" ON public.training_attendance;
CREATE POLICY "ta_athlete_select_self" ON public.training_attendance
  FOR SELECT TO authenticated
  USING (public.player_belongs_to_user(player_id, auth.uid()));

-- bowling_spare_training: athlete self-manage own rows
DROP POLICY IF EXISTS "bst_athlete_insert_self" ON public.bowling_spare_training;
CREATE POLICY "bst_athlete_insert_self" ON public.bowling_spare_training
  FOR INSERT TO authenticated
  WITH CHECK (public.player_belongs_to_user(player_id, auth.uid()));
DROP POLICY IF EXISTS "bst_athlete_update_self" ON public.bowling_spare_training;
CREATE POLICY "bst_athlete_update_self" ON public.bowling_spare_training
  FOR UPDATE TO authenticated
  USING (public.player_belongs_to_user(player_id, auth.uid()))
  WITH CHECK (public.player_belongs_to_user(player_id, auth.uid()));
DROP POLICY IF EXISTS "bst_athlete_delete_self" ON public.bowling_spare_training;
CREATE POLICY "bst_athlete_delete_self" ON public.bowling_spare_training
  FOR DELETE TO authenticated
  USING (public.player_belongs_to_user(player_id, auth.uid()));

-- competition_rounds: athlete self-manage own rows
DROP POLICY IF EXISTS "cr_athlete_insert_self" ON public.competition_rounds;
CREATE POLICY "cr_athlete_insert_self" ON public.competition_rounds
  FOR INSERT TO authenticated
  WITH CHECK (public.player_belongs_to_user(player_id, auth.uid()));
DROP POLICY IF EXISTS "cr_athlete_update_self" ON public.competition_rounds;
CREATE POLICY "cr_athlete_update_self" ON public.competition_rounds
  FOR UPDATE TO authenticated
  USING (public.player_belongs_to_user(player_id, auth.uid()))
  WITH CHECK (public.player_belongs_to_user(player_id, auth.uid()));
DROP POLICY IF EXISTS "cr_athlete_delete_self" ON public.competition_rounds;
CREATE POLICY "cr_athlete_delete_self" ON public.competition_rounds
  FOR DELETE TO authenticated
  USING (public.player_belongs_to_user(player_id, auth.uid()));

-- competition_round_stats: athlete via round ownership
DROP POLICY IF EXISTS "crs_athlete_insert_self" ON public.competition_round_stats;
CREATE POLICY "crs_athlete_insert_self" ON public.competition_round_stats
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.competition_rounds r
    WHERE r.id = competition_round_stats.round_id
      AND public.player_belongs_to_user(r.player_id, auth.uid())
  ));
DROP POLICY IF EXISTS "crs_athlete_update_self" ON public.competition_round_stats;
CREATE POLICY "crs_athlete_update_self" ON public.competition_round_stats
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.competition_rounds r
    WHERE r.id = competition_round_stats.round_id
      AND public.player_belongs_to_user(r.player_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.competition_rounds r
    WHERE r.id = competition_round_stats.round_id
      AND public.player_belongs_to_user(r.player_id, auth.uid())
  ));
DROP POLICY IF EXISTS "crs_athlete_delete_self" ON public.competition_round_stats;
CREATE POLICY "crs_athlete_delete_self" ON public.competition_round_stats
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.competition_rounds r
    WHERE r.id = competition_round_stats.round_id
      AND public.player_belongs_to_user(r.player_id, auth.uid())
  ));

-- matches: athletes can create/update training matches in their category
DROP POLICY IF EXISTS "matches_athlete_training_insert" ON public.matches;
CREATE POLICY "matches_athlete_training_insert" ON public.matches
  FOR INSERT TO authenticated
  WITH CHECK (
    event_type = 'training'
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.user_id = auth.uid()
        AND (p.category_id = matches.category_id
             OR EXISTS (
               SELECT 1 FROM public.player_categories pc
               WHERE pc.player_id = p.id
                 AND pc.category_id = matches.category_id
                 AND pc.status = 'accepted'
             ))
    )
  );
DROP POLICY IF EXISTS "matches_athlete_training_update" ON public.matches;
CREATE POLICY "matches_athlete_training_update" ON public.matches
  FOR UPDATE TO authenticated
  USING (
    event_type = 'training'
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.user_id = auth.uid()
        AND (p.category_id = matches.category_id
             OR EXISTS (
               SELECT 1 FROM public.player_categories pc
               WHERE pc.player_id = p.id
                 AND pc.category_id = matches.category_id
                 AND pc.status = 'accepted'
             ))
    )
  );

-- bowling_oil_patterns: athletes can insert/update patterns for training matches in their category
DROP POLICY IF EXISTS "bop_athlete_training_insert" ON public.bowling_oil_patterns;
CREATE POLICY "bop_athlete_training_insert" ON public.bowling_oil_patterns
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.players p ON p.user_id = auth.uid()
      WHERE m.id = bowling_oil_patterns.match_id
        AND m.event_type = 'training'
        AND (p.category_id = m.category_id
             OR EXISTS (
               SELECT 1 FROM public.player_categories pc
               WHERE pc.player_id = p.id
                 AND pc.category_id = m.category_id
                 AND pc.status = 'accepted'
             ))
    )
  );
DROP POLICY IF EXISTS "bop_athlete_training_update" ON public.bowling_oil_patterns;
CREATE POLICY "bop_athlete_training_update" ON public.bowling_oil_patterns
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.players p ON p.user_id = auth.uid()
      WHERE m.id = bowling_oil_patterns.match_id
        AND m.event_type = 'training'
        AND (p.category_id = m.category_id
             OR EXISTS (
               SELECT 1 FROM public.player_categories pc
               WHERE pc.player_id = p.id
                 AND pc.category_id = m.category_id
                 AND pc.status = 'accepted'
             ))
    )
  );

-- event_participants: athletes can insert participant row for themselves
DROP POLICY IF EXISTS "ep_athlete_insert_self" ON public.event_participants;
CREATE POLICY "ep_athlete_insert_self" ON public.event_participants
  FOR INSERT TO authenticated
  WITH CHECK (public.player_belongs_to_user(player_id, auth.uid()));
