CREATE POLICY "ins_arsenal_anon" ON public.player_bowling_arsenal FOR INSERT TO anon WITH CHECK (has_valid_athlete_token_for_player(player_id));
CREATE POLICY "upd_arsenal_anon" ON public.player_bowling_arsenal FOR UPDATE TO anon USING (has_valid_athlete_token_for_player(player_id));
CREATE POLICY "del_arsenal_anon" ON public.player_bowling_arsenal FOR DELETE TO anon USING (has_valid_athlete_token_for_player(player_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_bowling_arsenal TO anon;