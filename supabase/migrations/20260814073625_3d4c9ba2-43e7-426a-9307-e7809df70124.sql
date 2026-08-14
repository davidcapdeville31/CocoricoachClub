CREATE OR REPLACE FUNCTION public.sync_injury_from_concussion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_sev injury_severity;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO v_count FROM public.concussion_protocols
      WHERE player_id = NEW.player_id AND incident_date <= NEW.incident_date;
    v_sev := CASE WHEN v_count >= 2 THEN 'grave'::injury_severity ELSE 'modérée'::injury_severity END;

    IF NOT EXISTS (
      SELECT 1 FROM public.injuries
      WHERE player_id = NEW.player_id
        AND injury_type = 'Commotion cérébrale'
        AND injury_date = NEW.incident_date
    ) THEN
      INSERT INTO public.injuries (player_id, category_id, injury_type, injury_date, severity, status, description)
      VALUES (
        NEW.player_id, NEW.category_id, 'Commotion cérébrale', NEW.incident_date, v_sev, 'active',
        COALESCE(NEW.incident_description, '') ||
        CASE WHEN NEW.symptoms IS NOT NULL AND array_length(NEW.symptoms, 1) > 0
          THEN ' [Symptômes : ' || array_to_string(NEW.symptoms, ', ') || ']' ELSE '' END
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.injuries SET
      status = CASE NEW.status
        WHEN 'cleared' THEN 'healed'::injury_status
        WHEN 'recovery' THEN 'recovering'::injury_status
        ELSE 'active'::injury_status END,
      actual_return_date = CASE WHEN NEW.status = 'cleared'
        THEN COALESCE(NEW.clearance_date, CURRENT_DATE) ELSE NULL END,
      updated_at = now()
    WHERE player_id = NEW.player_id
      AND injury_type = 'Commotion cérébrale'
      AND injury_date = OLD.incident_date;
    RETURN NEW;
  END IF;

  DELETE FROM public.injuries
   WHERE player_id = OLD.player_id
     AND injury_type = 'Commotion cérébrale'
     AND injury_date = OLD.incident_date;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_injury_from_concussion ON public.concussion_protocols;
CREATE TRIGGER trg_sync_injury_from_concussion
AFTER INSERT OR UPDATE OR DELETE ON public.concussion_protocols
FOR EACH ROW EXECUTE FUNCTION public.sync_injury_from_concussion();

ALTER TABLE public.injuries DISABLE TRIGGER audit_injuries_trigger;

INSERT INTO public.injuries (player_id, category_id, injury_type, injury_date, severity, status, description)
SELECT cp.player_id, cp.category_id, 'Commotion cérébrale', cp.incident_date, 'modérée'::injury_severity,
  CASE cp.status WHEN 'cleared' THEN 'healed'::injury_status WHEN 'recovery' THEN 'recovering'::injury_status ELSE 'active'::injury_status END,
  COALESCE(cp.incident_description, '')
FROM public.concussion_protocols cp
WHERE NOT EXISTS (
  SELECT 1 FROM public.injuries i
  WHERE i.player_id = cp.player_id AND i.injury_type = 'Commotion cérébrale' AND i.injury_date = cp.incident_date
);

ALTER TABLE public.injuries ENABLE TRIGGER audit_injuries_trigger;