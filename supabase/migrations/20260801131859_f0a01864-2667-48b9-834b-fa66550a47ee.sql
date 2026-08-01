CREATE OR REPLACE FUNCTION public.preserve_arsenal_on_catalog_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.player_bowling_arsenal a
     SET custom_ball_name = COALESCE(a.custom_ball_name, OLD.name),
         custom_ball_brand = COALESCE(a.custom_ball_brand, OLD.brand),
         custom_rg = COALESCE(a.custom_rg, OLD.rg),
         custom_differential = COALESCE(a.custom_differential, OLD.differential),
         custom_intermediate_diff = COALESCE(a.custom_intermediate_diff, OLD.intermediate_diff),
         updated_at = now()
   WHERE a.ball_catalog_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_arsenal_on_catalog_delete ON public.bowling_ball_catalog;
CREATE TRIGGER trg_preserve_arsenal_on_catalog_delete
BEFORE DELETE ON public.bowling_ball_catalog
FOR EACH ROW EXECUTE FUNCTION public.preserve_arsenal_on_catalog_delete();

ALTER TABLE public.player_bowling_arsenal
  DROP CONSTRAINT player_bowling_arsenal_ball_catalog_id_fkey,
  ADD CONSTRAINT player_bowling_arsenal_ball_catalog_id_fkey
    FOREIGN KEY (ball_catalog_id) REFERENCES public.bowling_ball_catalog(id) ON DELETE SET NULL;