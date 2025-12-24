-- Remove the old check constraint on test_type
ALTER TABLE public.speed_tests DROP CONSTRAINT IF EXISTS speed_tests_test_type_check;

-- Add new check constraint with more test types for "Course" category
ALTER TABLE public.speed_tests ADD CONSTRAINT speed_tests_test_type_check 
CHECK (test_type IN ('40m_sprint', '1600m_run', '10m_sprint', '20m_sprint', '30m_sprint', '60m_sprint', '100m_sprint', 'cooper_test', 'beep_test', 'yo_yo_test', 'custom'));