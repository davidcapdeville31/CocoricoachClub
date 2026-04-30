-- Add scheduling fields to test_reminders
ALTER TABLE public.test_reminders
  ADD COLUMN IF NOT EXISTS session_start_time time,
  ADD COLUMN IF NOT EXISTS session_end_time time,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS auto_assign_athletes boolean NOT NULL DEFAULT true;

-- Drop overly restrictive check constraint (test types managed in UI now)
ALTER TABLE public.test_reminders
  DROP CONSTRAINT IF EXISTS test_reminders_test_type_check;