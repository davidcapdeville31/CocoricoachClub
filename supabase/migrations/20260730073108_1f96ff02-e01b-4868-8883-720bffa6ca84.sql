CREATE TABLE IF NOT EXISTS public.match_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  attendance_status text NOT NULL DEFAULT 'no_response',
  absence_comment text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_participants_status_check CHECK (attendance_status IN ('present','absent','no_response')),
  CONSTRAINT match_participants_unique UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_participants_match ON public.match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_player ON public.match_participants(player_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_participants TO authenticated;
GRANT ALL ON public.match_participants TO service_role;

ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_staff_select" ON public.match_participants FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_participants.match_id AND public.can_access_category(auth.uid(), m.category_id)));

CREATE POLICY "mp_staff_insert" ON public.match_participants FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_participants.match_id AND public.can_access_category(auth.uid(), m.category_id)));

CREATE POLICY "mp_staff_update" ON public.match_participants FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_participants.match_id AND public.can_access_category(auth.uid(), m.category_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_participants.match_id AND public.can_access_category(auth.uid(), m.category_id)));

CREATE POLICY "mp_staff_delete" ON public.match_participants FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_participants.match_id AND public.can_access_category(auth.uid(), m.category_id)));

CREATE POLICY "mp_athlete_select_self" ON public.match_participants FOR SELECT TO authenticated
USING (public.player_belongs_to_user(player_id, auth.uid()));

CREATE POLICY "mp_athlete_update_self" ON public.match_participants FOR UPDATE TO authenticated
USING (
  public.player_belongs_to_user(player_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_participants.match_id
      AND (m.match_date::timestamp + COALESCE(m.match_time, '00:00:00'::time)::interval) > ((now() AT TIME ZONE 'UTC') + interval '30 minutes')
  )
)
WITH CHECK (
  public.player_belongs_to_user(player_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_participants.match_id
      AND (m.match_date::timestamp + COALESCE(m.match_time, '00:00:00'::time)::interval) > ((now() AT TIME ZONE 'UTC') + interval '30 minutes')
  )
);

CREATE POLICY "mp_athlete_insert_self" ON public.match_participants FOR INSERT TO authenticated
WITH CHECK (public.player_belongs_to_user(player_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.set_match_participant_responded_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.attendance_status IS DISTINCT FROM COALESCE(OLD.attendance_status, 'no_response')
     AND NEW.attendance_status <> 'no_response' THEN
    NEW.responded_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_match_participant_responded_at ON public.match_participants;
CREATE TRIGGER trg_match_participant_responded_at
BEFORE UPDATE ON public.match_participants
FOR EACH ROW EXECUTE FUNCTION public.set_match_participant_responded_at();

CREATE OR REPLACE FUNCTION public.notify_match_participant_convocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_match record;
BEGIN
  SELECT user_id INTO v_user_id FROM public.players WHERE id = NEW.player_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT m.id, m.category_id, m.opponent, m.match_date, m.match_time
    INTO v_match FROM public.matches m WHERE m.id = NEW.match_id;
  IF v_match IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, category_id, notification_type, notification_subtype, title, message, metadata, priority)
  VALUES (
    v_user_id,
    v_match.category_id,
    'match_convocation',
    'convocation',
    'Convocation compétition',
    'Tu es convoqué(e) pour ' || COALESCE(NULLIF(v_match.opponent, ''), 'une compétition')
      || ' le ' || to_char(v_match.match_date, 'DD/MM/YYYY')
      || COALESCE(' à ' || to_char(v_match.match_time, 'HH24:MI'), '')
      || '. Merci d''indiquer ta présence.',
    jsonb_build_object('match_id', v_match.id, 'player_id', NEW.player_id),
    'high'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_match_convocation ON public.match_participants;
CREATE TRIGGER trg_notify_match_convocation
AFTER INSERT ON public.match_participants
FOR EACH ROW EXECUTE FUNCTION public.notify_match_participant_convocation();