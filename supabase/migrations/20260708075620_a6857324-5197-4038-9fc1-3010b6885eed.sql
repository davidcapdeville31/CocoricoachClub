
-- 1. Add response columns to event_participants
ALTER TABLE public.event_participants
  ADD COLUMN IF NOT EXISTS attendance_status text NOT NULL DEFAULT 'no_response'
    CHECK (attendance_status IN ('present','absent','no_response')),
  ADD COLUMN IF NOT EXISTS absence_comment text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_event_participants_player_status
  ON public.event_participants(player_id, attendance_status);

-- 2. UPDATE policies
-- Athlete can update their OWN row, only while > 30 min before session start
DROP POLICY IF EXISTS "ep_athlete_update_self" ON public.event_participants;
CREATE POLICY "ep_athlete_update_self"
  ON public.event_participants
  FOR UPDATE
  USING (
    public.player_belongs_to_user(player_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.training_sessions ts
      WHERE ts.id = event_participants.training_session_id
        AND (
          (ts.session_date::timestamp + COALESCE(ts.session_start_time, '00:00'::time))
          > (now() AT TIME ZONE 'UTC' + interval '30 minutes')
        )
    )
  )
  WITH CHECK (
    public.player_belongs_to_user(player_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.training_sessions ts
      WHERE ts.id = event_participants.training_session_id
        AND (
          (ts.session_date::timestamp + COALESCE(ts.session_start_time, '00:00'::time))
          > (now() AT TIME ZONE 'UTC' + interval '30 minutes')
        )
    )
  );

-- Staff can update participants of their accessible categories
DROP POLICY IF EXISTS "ep_staff_update" ON public.event_participants;
CREATE POLICY "ep_staff_update"
  ON public.event_participants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      WHERE ts.id = event_participants.training_session_id
        AND public.can_access_category(auth.uid(), ts.category_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      WHERE ts.id = event_participants.training_session_id
        AND public.can_access_category(auth.uid(), ts.category_id)
    )
  );

-- 3. Trigger: set responded_at automatically when status changes
CREATE OR REPLACE FUNCTION public.set_event_participant_responded_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.attendance_status IS DISTINCT FROM COALESCE(OLD.attendance_status, 'no_response')
     AND NEW.attendance_status <> 'no_response' THEN
    NEW.responded_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_participant_responded_at ON public.event_participants;
CREATE TRIGGER trg_event_participant_responded_at
  BEFORE UPDATE ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.set_event_participant_responded_at();

-- 4. Sync trigger: mirror response into training_attendance
CREATE OR REPLACE FUNCTION public.sync_event_participant_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_status text;
BEGIN
  IF NEW.attendance_status = 'no_response' THEN
    RETURN NEW;
  END IF;

  SELECT id, category_id, session_date
    INTO v_session
  FROM public.training_sessions
  WHERE id = NEW.training_session_id;

  IF v_session.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_status := CASE NEW.attendance_status
    WHEN 'present' THEN 'present'
    WHEN 'absent' THEN 'absent'
    ELSE 'present'
  END;

  INSERT INTO public.training_attendance (
    player_id, category_id, training_session_id,
    attendance_date, status, absence_reason
  )
  VALUES (
    NEW.player_id, v_session.category_id, v_session.id,
    v_session.session_date, v_status, NEW.absence_comment
  )
  ON CONFLICT (player_id, training_session_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    absence_reason = EXCLUDED.absence_reason,
    attendance_date = EXCLUDED.attendance_date;

  RETURN NEW;
END;
$$;

-- Ensure unique constraint exists to support ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'training_attendance_player_session_uidx'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX training_attendance_player_session_uidx
        ON public.training_attendance(player_id, training_session_id)
        WHERE training_session_id IS NOT NULL;
    EXCEPTION WHEN duplicate_table THEN NULL;
    END;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_sync_event_participant_attendance ON public.event_participants;
CREATE TRIGGER trg_sync_event_participant_attendance
  AFTER INSERT OR UPDATE OF attendance_status, absence_comment
  ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_participant_attendance();
