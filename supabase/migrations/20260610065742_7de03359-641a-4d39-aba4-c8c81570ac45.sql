
CREATE TABLE public.wellness_reminder_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  targeted_count integer NOT NULL DEFAULT 0,
  emails_sent integer NOT NULL DEFAULT 0,
  push_sent integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_wellness_reminder_log_category_date ON public.wellness_reminder_log (category_id, sent_at DESC);
GRANT SELECT, INSERT ON public.wellness_reminder_log TO authenticated;
GRANT ALL ON public.wellness_reminder_log TO service_role;
ALTER TABLE public.wellness_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view reminder log for their category"
ON public.wellness_reminder_log FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = wellness_reminder_log.category_id
      AND (
        EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = c.club_id AND cm.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.category_members cmem WHERE cmem.category_id = c.id AND cmem.user_id = auth.uid())
      )
  )
);

CREATE POLICY "Staff can insert reminder log for their category"
ON public.wellness_reminder_log FOR INSERT TO authenticated
WITH CHECK (
  sent_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = wellness_reminder_log.category_id
      AND (
        EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = c.club_id AND cm.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.category_members cmem WHERE cmem.category_id = c.id AND cmem.user_id = auth.uid())
      )
  )
);
