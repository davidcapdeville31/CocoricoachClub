CREATE OR REPLACE FUNCTION public.guard_competition_participation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changed boolean;
BEGIN
IF TG_OP='DELETE' THEN
IF OLD.participation_status IS NOT NULL AND (auth.uid() IS NULL OR NOT public.can_manage_competition_participation(OLD.match_id)) THEN RAISE EXCEPTION 'Participation correction deletion requires authorized staff' USING ERRCODE='42501'; END IF;
RETURN OLD;
END IF;
IF TG_OP='INSERT' THEN changed := NEW.participation_status IS NOT NULL OR NEW.participation_updated_by IS NOT NULL OR NEW.participation_updated_at IS NOT NULL;
ELSE
changed := NEW.participation_status IS DISTINCT FROM OLD.participation_status OR NEW.participation_updated_by IS DISTINCT FROM OLD.participation_updated_by OR NEW.participation_updated_at IS DISTINCT FROM OLD.participation_updated_at;
IF OLD.participation_status IS NOT NULL AND (NEW.match_id IS DISTINCT FROM OLD.match_id OR NEW.player_id IS DISTINCT FROM OLD.player_id) THEN RAISE EXCEPTION 'Cannot move a participation correction'; END IF;
END IF;
IF changed THEN
IF auth.uid() IS NULL OR NOT public.can_manage_competition_participation(NEW.match_id) THEN RAISE EXCEPTION 'Participation modification requires authorized staff' USING ERRCODE='42501'; END IF;
NEW.participation_updated_by:=auth.uid(); NEW.participation_updated_at:=now();
END IF;
RETURN NEW;
END $$;
CREATE TRIGGER guard_participation_delete BEFORE DELETE ON public.competition_results FOR EACH ROW EXECUTE FUNCTION public.guard_competition_participation();