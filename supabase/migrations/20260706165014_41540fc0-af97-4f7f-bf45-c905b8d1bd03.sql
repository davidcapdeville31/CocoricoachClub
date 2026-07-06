CREATE OR REPLACE FUNCTION public.is_player_owner(_user_id uuid, _player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = _player_id
      AND p.user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "Athletes can view own player_categories" ON public.player_categories;

CREATE POLICY "Athletes can view own player_categories"
ON public.player_categories
FOR SELECT
TO authenticated
USING (public.is_player_owner(auth.uid(), player_id));