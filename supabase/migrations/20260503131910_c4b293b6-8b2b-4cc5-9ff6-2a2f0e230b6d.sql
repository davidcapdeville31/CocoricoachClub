-- Add validation workflow to athlete_exercise_logs (tonnage)
ALTER TABLE public.athlete_exercise_logs
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_via text NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'validated',
  ADD COLUMN IF NOT EXISTS validated_by uuid,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Constraint: status values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'athlete_exercise_logs_validation_status_check') THEN
    ALTER TABLE public.athlete_exercise_logs
      ADD CONSTRAINT athlete_exercise_logs_validation_status_check
      CHECK (validation_status IN ('pending','validated','rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'athlete_exercise_logs_submitted_via_check') THEN
    ALTER TABLE public.athlete_exercise_logs
      ADD CONSTRAINT athlete_exercise_logs_submitted_via_check
      CHECK (submitted_via IN ('staff','athlete'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_athlete_exercise_logs_pending
  ON public.athlete_exercise_logs (category_id, validation_status)
  WHERE validation_status = 'pending';
