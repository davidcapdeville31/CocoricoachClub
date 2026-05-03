ALTER TABLE public.test_reminders 
  ADD COLUMN IF NOT EXISTS test_metadata jsonb,
  ALTER COLUMN test_type DROP NOT NULL;

COMMENT ON COLUMN public.test_reminders.test_metadata IS 'Optional array of tests [{test_category, test_type, result_unit, label}] for multi-test reminders. When set, takes precedence over the single test_type field.';