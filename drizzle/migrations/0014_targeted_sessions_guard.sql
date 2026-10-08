CREATE OR REPLACE FUNCTION public.get_targeted_session_ids(_session_ids uuid[])
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT DISTINCT training_session_id FROM public.event_participants WHERE training_session_id = ANY(_session_ids)
$$;
GRANT EXECUTE ON FUNCTION public.get_targeted_session_ids(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_self_join_targeted_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF player_belongs_to_user(NEW.player_id, auth.uid())
     AND EXISTS (SELECT 1 FROM event_participants WHERE training_session_id = NEW.training_session_id AND player_id <> NEW.player_id) THEN
    RAISE EXCEPTION 'Séance réservée aux athlètes convoqués';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_prevent_self_join_targeted ON public.event_participants;
CREATE TRIGGER trg_prevent_self_join_targeted BEFORE INSERT ON public.event_participants
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_join_targeted_session();

DELETE FROM public.event_participants WHERE training_session_id='8a6395e5-5f21-4484-8ebd-720b80f30ebf' AND attendance_status='absent' AND created_at='2026-10-08 14:08:15.385079+00';
DELETE FROM public.training_attendance WHERE training_session_id='8a6395e5-5f21-4484-8ebd-720b80f30ebf' AND created_at='2026-10-08 14:08:15.385079+00';