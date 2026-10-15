ALTER TABLE public.competition_results ADD COLUMN participation_status text CHECK (participation_status IN ('present','absent','to_verify')), ADD COLUMN participation_updated_by uuid, ADD COLUMN participation_updated_at timestamptz;
COMMENT ON COLUMN public.competition_results.participation_status IS 'Staff correction of effective participation, independent of RSVP and final ranking. NULL permits inference from recorded individual results.';
CREATE OR REPLACE FUNCTION public.can_manage_competition_participation(_match_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS (SELECT 1 FROM public.matches m JOIN public.categories c ON c.id=m.category_id JOIN public.clubs cl ON cl.id=c.club_id WHERE m.id=_match_id AND (cl.user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.club_members cm WHERE cm.club_id=cl.id AND cm.user_id=auth.uid() AND cm.role IN ('admin','coach','administratif') AND (cm.assigned_categories IS NULL OR c.id=ANY(cm.assigned_categories))) OR EXISTS(SELECT 1 FROM public.category_members cm WHERE cm.category_id=c.id AND cm.user_id=auth.uid() AND cm.role IN ('admin','coach','administratif'))));
$$;
REVOKE ALL ON FUNCTION public.can_manage_competition_participation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_competition_participation(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.guard_competition_participation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changed boolean;
BEGIN
IF TG_OP='INSERT' THEN changed := NEW.participation_status IS NOT NULL OR NEW.participation_updated_by IS NOT NULL OR NEW.participation_updated_at IS NOT NULL;
ELSE changed := NEW.participation_status IS DISTINCT FROM OLD.participation_status OR NEW.participation_updated_by IS DISTINCT FROM OLD.participation_updated_by OR NEW.participation_updated_at IS DISTINCT FROM OLD.participation_updated_at;
END IF;
IF changed THEN
IF auth.uid() IS NULL OR NOT public.can_manage_competition_participation(NEW.match_id) THEN RAISE EXCEPTION 'Participation modification requires authorized staff' USING ERRCODE='42501'; END IF;
NEW.participation_updated_by:=auth.uid(); NEW.participation_updated_at:=now();
END IF;
RETURN NEW;
END $$;
CREATE TRIGGER guard_effective_participation BEFORE INSERT OR UPDATE ON public.competition_results FOR EACH ROW EXECUTE FUNCTION public.guard_competition_participation();
CREATE OR REPLACE FUNCTION public.set_competition_participation(_match_id uuid,_player_id uuid,_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF auth.uid() IS NULL OR NOT public.can_manage_competition_participation(_match_id) THEN RAISE EXCEPTION 'Unauthorized participation modification' USING ERRCODE='42501'; END IF;
IF _status IS NULL OR _status NOT IN ('present','absent','to_verify') THEN RAISE EXCEPTION 'Invalid participation status'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.match_participants WHERE match_id=_match_id AND player_id=_player_id) AND NOT EXISTS(SELECT 1 FROM public.match_lineups WHERE match_id=_match_id AND player_id=_player_id) AND NOT EXISTS(SELECT 1 FROM public.competition_rounds WHERE match_id=_match_id AND player_id=_player_id) AND NOT EXISTS(SELECT 1 FROM public.competition_results WHERE match_id=_match_id AND player_id=_player_id) THEN RAISE EXCEPTION 'Athlete is not linked to competition'; END IF;
INSERT INTO public.competition_results(match_id,player_id,participation_status) VALUES(_match_id,_player_id,_status)
ON CONFLICT(match_id,player_id) DO UPDATE SET participation_status=EXCLUDED.participation_status,participation_updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.set_competition_participation(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_competition_participation(uuid,uuid,text) TO authenticated;
