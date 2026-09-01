CREATE TABLE public.periodization_cycle_players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id uuid NOT NULL REFERENCES public.periodization_cycles(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, player_id)
);

CREATE INDEX idx_pcp_cycle ON public.periodization_cycle_players(cycle_id);
CREATE INDEX idx_pcp_player ON public.periodization_cycle_players(player_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.periodization_cycle_players TO authenticated;
GRANT ALL ON public.periodization_cycle_players TO service_role;

ALTER TABLE public.periodization_cycle_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage cycle players"
ON public.periodization_cycle_players FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.periodization_cycles pc
    JOIN public.categories c ON c.id = pc.category_id
    JOIN public.clubs cl ON cl.id = c.club_id
    WHERE pc.id = cycle_id
      AND public.can_modify_club_data(auth.uid(), cl.id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.periodization_cycles pc
    JOIN public.categories c ON c.id = pc.category_id
    JOIN public.clubs cl ON cl.id = c.club_id
    WHERE pc.id = cycle_id
      AND public.can_modify_club_data(auth.uid(), cl.id)
  )
);

CREATE POLICY "Users can view cycle players"
ON public.periodization_cycle_players FOR SELECT
TO authenticated
USING (
  public.player_belongs_to_user(player_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.periodization_cycles pc
    JOIN public.categories c ON c.id = pc.category_id
    WHERE pc.id = cycle_id
      AND public.can_access_category(auth.uid(), c.id)
  )
);