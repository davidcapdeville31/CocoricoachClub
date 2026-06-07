
-- Athletes can update their own player row
CREATE POLICY "Athletes can update their own player row"
ON public.players FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Protect structural columns from being changed by the athlete themselves
CREATE OR REPLACE FUNCTION public.prevent_athlete_self_structural_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when the actor is the athlete themselves (and not staff)
  IF OLD.user_id IS NOT NULL AND OLD.user_id = auth.uid() THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.category_id IS DISTINCT FROM OLD.category_id
       OR NEW.club_id IS DISTINCT FROM OLD.club_id THEN
      RAISE EXCEPTION 'Athletes cannot change their category, club, or user link';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_athlete_self_structural_changes ON public.players;
CREATE TRIGGER trg_prevent_athlete_self_structural_changes
BEFORE UPDATE ON public.players
FOR EACH ROW EXECUTE FUNCTION public.prevent_athlete_self_structural_changes();

-- Athletes can manage their own athlete_attributes (identité athlète)
CREATE POLICY "Athletes can manage their own attributes"
ON public.athlete_attributes FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.players pl
  WHERE pl.id = athlete_attributes.player_id
    AND pl.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.players pl
  WHERE pl.id = athlete_attributes.player_id
    AND pl.user_id = auth.uid()
));
