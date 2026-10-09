CREATE TABLE public.player_manual_medals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  medal_type text NOT NULL,
  rank integer,
  custom_title text,
  competition_name text NOT NULL,
  location text,
  team_label text,
  notes text,
  awarded_date date NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_manual_medals TO authenticated;
GRANT ALL ON public.player_manual_medals TO service_role;
ALTER TABLE public.player_manual_medals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View manual medals" ON public.player_manual_medals FOR SELECT TO authenticated
  USING (public.can_access_category(auth.uid(), category_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Create manual medals" ON public.player_manual_medals FOR INSERT TO authenticated
  WITH CHECK (public.can_access_category(auth.uid(), category_id) AND auth.uid() = created_by);
CREATE POLICY "Update manual medals" ON public.player_manual_medals FOR UPDATE TO authenticated
  USING (public.can_access_category(auth.uid(), category_id));
CREATE POLICY "Delete manual medals" ON public.player_manual_medals FOR DELETE TO authenticated
  USING (public.can_access_category(auth.uid(), category_id));
CREATE INDEX ON public.player_manual_medals(player_id);