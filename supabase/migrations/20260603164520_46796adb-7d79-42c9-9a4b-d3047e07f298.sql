ALTER TABLE public.wellness_tracking DROP CONSTRAINT IF EXISTS wellness_tracking_sleep_quality_check;
ALTER TABLE public.wellness_tracking DROP CONSTRAINT IF EXISTS wellness_tracking_general_fatigue_check;
ALTER TABLE public.wellness_tracking DROP CONSTRAINT IF EXISTS wellness_tracking_stress_level_check;
ALTER TABLE public.wellness_tracking ADD CONSTRAINT wellness_tracking_sleep_quality_check CHECK (sleep_quality >= 0 AND sleep_quality <= 5);
ALTER TABLE public.wellness_tracking ADD CONSTRAINT wellness_tracking_general_fatigue_check CHECK (general_fatigue >= 0 AND general_fatigue <= 5);
ALTER TABLE public.wellness_tracking ADD CONSTRAINT wellness_tracking_stress_level_check CHECK (stress_level >= 0 AND stress_level <= 5);