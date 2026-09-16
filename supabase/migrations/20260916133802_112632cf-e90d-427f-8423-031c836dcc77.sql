CREATE TABLE public.player_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX player_groups_category_name_uniq
  ON public.player_groups (category_id, lower(name));

CREATE TABLE public.player_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.player_groups(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, player_id)
);

CREATE INDEX player_group_members_group_idx ON public.player_group_members (group_id);
CREATE INDEX player_group_members_player_idx ON public.player_group_members (player_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_groups TO authenticated;
GRANT ALL ON public.player_groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_group_members TO authenticated;
GRANT ALL ON public.player_group_members TO service_role;

ALTER TABLE public.player_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View groups of accessible categories"
ON public.player_groups FOR SELECT TO authenticated
USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Staff manage groups"
ON public.player_groups FOR ALL TO authenticated
USING (public.can_access_category(auth.uid(), category_id) AND NOT public.is_category_athlete(auth.uid(), category_id))
WITH CHECK (public.can_access_category(auth.uid(), category_id) AND NOT public.is_category_athlete(auth.uid(), category_id));

CREATE POLICY "View group members of accessible categories"
ON public.player_group_members FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.player_groups g
  WHERE g.id = group_id AND public.can_access_category(auth.uid(), g.category_id)
));

CREATE POLICY "Staff manage group members"
ON public.player_group_members FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.player_groups g
  WHERE g.id = group_id AND public.can_access_category(auth.uid(), g.category_id)
    AND NOT public.is_category_athlete(auth.uid(), g.category_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.player_groups g
  WHERE g.id = group_id AND public.can_access_category(auth.uid(), g.category_id)
    AND NOT public.is_category_athlete(auth.uid(), g.category_id)
));

CREATE TRIGGER update_player_groups_updated_at
BEFORE UPDATE ON public.player_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();