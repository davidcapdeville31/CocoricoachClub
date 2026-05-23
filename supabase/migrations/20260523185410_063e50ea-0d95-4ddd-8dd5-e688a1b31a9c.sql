-- Wellness schedule per category: which days of the week wellness must be filled
CREATE TABLE IF NOT EXISTS public.wellness_schedules (
  category_id UUID PRIMARY KEY REFERENCES public.categories(id) ON DELETE CASCADE,
  days_of_week SMALLINT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}'::smallint[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wellness_schedules_days_valid CHECK (
    array_length(days_of_week, 1) IS NULL
    OR (days_of_week <@ ARRAY[0,1,2,3,4,5,6]::smallint[])
  )
);

ALTER TABLE public.wellness_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view wellness schedule"
ON public.wellness_schedules FOR SELECT
USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Staff can insert wellness schedule"
ON public.wellness_schedules FOR INSERT
WITH CHECK (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Staff can update wellness schedule"
ON public.wellness_schedules FOR UPDATE
USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Staff can delete wellness schedule"
ON public.wellness_schedules FOR DELETE
USING (public.can_access_category(auth.uid(), category_id));

CREATE TRIGGER update_wellness_schedules_updated_at
BEFORE UPDATE ON public.wellness_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();