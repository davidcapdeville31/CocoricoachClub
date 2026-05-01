CREATE TABLE public.player_coaches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_player_coaches_player ON public.player_coaches(player_id);
CREATE INDEX idx_player_coaches_category ON public.player_coaches(category_id);

ALTER TABLE public.player_coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view player coaches"
ON public.player_coaches FOR SELECT
USING (
  public.can_access_category(auth.uid(), category_id)
  OR EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = player_coaches.player_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can insert player coaches"
ON public.player_coaches FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = player_coaches.category_id
    AND public.can_modify_club_data(auth.uid(), c.club_id)
  )
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Staff can update player coaches"
ON public.player_coaches FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = player_coaches.category_id
    AND public.can_modify_club_data(auth.uid(), c.club_id)
  )
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Staff can delete player coaches"
ON public.player_coaches FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = player_coaches.category_id
    AND public.can_modify_club_data(auth.uid(), c.club_id)
  )
  OR public.is_super_admin(auth.uid())
);

CREATE TRIGGER update_player_coaches_updated_at
BEFORE UPDATE ON public.player_coaches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();