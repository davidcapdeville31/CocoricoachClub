DELETE FROM public.awcr_tracking r
WHERE r.training_session_id IS NULL AND coalesce(r.rpe,0)=0 AND coalesce(r.training_load,0)=0
AND EXISTS (SELECT 1 FROM public.awcr_tracking a WHERE a.player_id=r.player_id AND a.session_date=r.session_date AND a.id<>r.id AND a.training_session_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.awcr_remove_auto_rest_on_real_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.training_session_id IS NOT NULL THEN
    DELETE FROM public.awcr_tracking
    WHERE player_id=NEW.player_id AND session_date=NEW.session_date AND id<>NEW.id
      AND training_session_id IS NULL AND coalesce(rpe,0)=0 AND coalesce(training_load,0)=0;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_awcr_remove_auto_rest ON public.awcr_tracking;
CREATE TRIGGER trg_awcr_remove_auto_rest AFTER INSERT OR UPDATE OF training_session_id ON public.awcr_tracking
FOR EACH ROW EXECUTE FUNCTION public.awcr_remove_auto_rest_on_real_entry();