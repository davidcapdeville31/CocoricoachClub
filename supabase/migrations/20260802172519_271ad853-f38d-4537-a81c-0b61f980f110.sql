CREATE OR REPLACE FUNCTION public.set_player_gender_from_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_gender text;
BEGIN
  IF NEW.gender IS NULL OR NEW.gender = '' THEN
    SELECT lower(coalesce(gender, '')) INTO cat_gender FROM public.categories WHERE id = NEW.category_id;
    IF cat_gender IN ('male', 'masculine', 'homme', 'hommes', 'm') THEN
      NEW.gender := 'male';
    ELSIF cat_gender IN ('female', 'feminine', 'femme', 'femmes', 'f') THEN
      NEW.gender := 'female';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_player_gender_from_category ON public.players;
CREATE TRIGGER trg_set_player_gender_from_category
BEFORE INSERT ON public.players
FOR EACH ROW EXECUTE FUNCTION public.set_player_gender_from_category();