
CREATE POLICY "Athletes can view own injuries"
ON public.injuries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid()));

CREATE POLICY "Athletes can update own injuries"
ON public.injuries FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid()));

CREATE POLICY "Athletes can delete own injuries"
ON public.injuries FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid()));

CREATE POLICY "Athletes can view own illnesses"
ON public.illnesses FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid()));

CREATE POLICY "Athletes can update own illnesses"
ON public.illnesses FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid()));

CREATE POLICY "Athletes can delete own illnesses"
ON public.illnesses FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid()));
