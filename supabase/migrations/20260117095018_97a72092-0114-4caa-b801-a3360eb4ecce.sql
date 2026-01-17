-- Mettre à jour les politiques pour injuries
DROP POLICY IF EXISTS "Club owners can insert injuries" ON public.injuries;
DROP POLICY IF EXISTS "Club owners can update injuries" ON public.injuries;
DROP POLICY IF EXISTS "Club owners can delete injuries" ON public.injuries;

CREATE POLICY "Club members with access can insert injuries" ON public.injuries
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = injuries.category_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);

CREATE POLICY "Club members with access can update injuries" ON public.injuries
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = injuries.category_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);

CREATE POLICY "Club members with access can delete injuries" ON public.injuries
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = injuries.category_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);

-- Mettre à jour les politiques pour body_composition
DROP POLICY IF EXISTS "Club owners can insert body composition" ON public.body_composition;
DROP POLICY IF EXISTS "Club owners can update body composition" ON public.body_composition;
DROP POLICY IF EXISTS "Club owners can delete body composition" ON public.body_composition;

CREATE POLICY "Club members with access can insert body_composition" ON public.body_composition
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = body_composition.category_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);

CREATE POLICY "Club members with access can update body_composition" ON public.body_composition
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = body_composition.category_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);

CREATE POLICY "Club members with access can delete body_composition" ON public.body_composition
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = body_composition.category_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);

-- Mettre à jour les politiques pour gps_sessions
DROP POLICY IF EXISTS "Club owners can insert gps sessions" ON public.gps_sessions;
DROP POLICY IF EXISTS "Club owners can update gps sessions" ON public.gps_sessions;
DROP POLICY IF EXISTS "Club owners can delete gps sessions" ON public.gps_sessions;

CREATE POLICY "Club members with access can insert gps_sessions" ON public.gps_sessions
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = gps_sessions.category_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);

CREATE POLICY "Club members with access can update gps_sessions" ON public.gps_sessions
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = gps_sessions.category_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);

CREATE POLICY "Club members with access can delete gps_sessions" ON public.gps_sessions
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = gps_sessions.category_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);

-- Mettre à jour les politiques pour gym_session_exercises
DROP POLICY IF EXISTS "Club owners can insert gym exercises" ON public.gym_session_exercises;
DROP POLICY IF EXISTS "Club owners can update gym exercises" ON public.gym_session_exercises;
DROP POLICY IF EXISTS "Club owners can delete gym exercises" ON public.gym_session_exercises;

CREATE POLICY "Club members with access can insert gym_session_exercises" ON public.gym_session_exercises
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = gym_session_exercises.category_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);

CREATE POLICY "Club members with access can update gym_session_exercises" ON public.gym_session_exercises
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = gym_session_exercises.category_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);

CREATE POLICY "Club members with access can delete gym_session_exercises" ON public.gym_session_exercises
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = gym_session_exercises.category_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);

-- Mettre à jour les politiques pour match_lineups
DROP POLICY IF EXISTS "Club owners can insert match lineups" ON public.match_lineups;
DROP POLICY IF EXISTS "Club owners can update match lineups" ON public.match_lineups;
DROP POLICY IF EXISTS "Club owners can delete match lineups" ON public.match_lineups;

CREATE POLICY "Club members with access can insert match_lineups" ON public.match_lineups
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM matches m
    JOIN categories c ON c.id = m.category_id
    JOIN clubs cl ON cl.id = c.club_id
    WHERE m.id = match_lineups.match_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);

CREATE POLICY "Club members with access can update match_lineups" ON public.match_lineups
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM matches m
    JOIN categories c ON c.id = m.category_id
    JOIN clubs cl ON cl.id = c.club_id
    WHERE m.id = match_lineups.match_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);

CREATE POLICY "Club members with access can delete match_lineups" ON public.match_lineups
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM matches m
    JOIN categories c ON c.id = m.category_id
    JOIN clubs cl ON cl.id = c.club_id
    WHERE m.id = match_lineups.match_id
    AND can_modify_club_data(auth.uid(), cl.id)
  )
);