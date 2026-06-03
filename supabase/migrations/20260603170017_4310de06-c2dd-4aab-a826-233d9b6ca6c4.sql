
CREATE POLICY "Athletes can insert own objectives"
ON public.player_objectives
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid()));

CREATE POLICY "Athletes can update own objectives"
ON public.player_objectives
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid()));

CREATE POLICY "Athletes can delete own objectives"
ON public.player_objectives
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid()));

CREATE POLICY "Athletes can view own objectives"
ON public.player_objectives
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid()));
