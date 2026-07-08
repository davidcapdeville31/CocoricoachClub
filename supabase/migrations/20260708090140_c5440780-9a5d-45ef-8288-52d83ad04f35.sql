-- Deduplicate existing rows before adding unique constraint
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY player_id, training_session_id ORDER BY created_at DESC NULLS LAST, id) rn
  FROM public.training_attendance
  WHERE training_session_id IS NOT NULL
)
DELETE FROM public.training_attendance ta USING ranked r WHERE ta.id = r.id AND r.rn > 1;

ALTER TABLE public.training_attendance
  ADD CONSTRAINT training_attendance_player_session_unique UNIQUE (player_id, training_session_id);