CREATE OR REPLACE FUNCTION public.prevent_athlete_self_structural_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.user_id IS NOT NULL AND OLD.user_id = auth.uid() THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.category_id IS DISTINCT FROM OLD.category_id THEN
      RAISE EXCEPTION 'Athletes cannot change their category or user link';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;