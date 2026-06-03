ALTER TABLE public.wellness_tracking DROP CONSTRAINT IF EXISTS wellness_tracking_soreness_upper_body_check;
ALTER TABLE public.wellness_tracking DROP CONSTRAINT IF EXISTS wellness_tracking_soreness_lower_body_check;
ALTER TABLE public.wellness_tracking ADD CONSTRAINT wellness_tracking_soreness_upper_body_check CHECK (soreness_upper_body >= 0 AND soreness_upper_body <= 5);
ALTER TABLE public.wellness_tracking ADD CONSTRAINT wellness_tracking_soreness_lower_body_check CHECK (soreness_lower_body >= 0 AND soreness_lower_body <= 5);