-- Personal vs Club competition flagging
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_matches_is_personal ON public.matches (category_id, is_personal);
CREATE INDEX IF NOT EXISTS idx_matches_created_by_player ON public.matches (created_by_player_id);

-- Replace SELECT policy so personal competitions are private to their owner + coaches/staff
DROP POLICY IF EXISTS "Club members can view matches" ON public.matches;

CREATE POLICY "Club members can view matches"
ON public.matches
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.categories c
    JOIN public.clubs cl ON cl.id = c.club_id
    WHERE c.id = matches.category_id
      AND (cl.user_id = auth.uid() OR can_access_club(auth.uid(), cl.id))
      AND (
        matches.is_personal = false
        OR can_modify_club_data(auth.uid(), cl.id)
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = matches.created_by_player_id
      AND p.user_id = auth.uid()
  )
);