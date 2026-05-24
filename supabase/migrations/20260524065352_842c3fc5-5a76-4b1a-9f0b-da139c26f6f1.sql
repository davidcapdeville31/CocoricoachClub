CREATE TABLE IF NOT EXISTS public.wellness_question_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL UNIQUE REFERENCES public.categories(id) ON DELETE CASCADE,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wellness_question_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wellness config viewable by category members"
ON public.wellness_question_configs
FOR SELECT
TO authenticated
USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Wellness config manageable by category staff"
ON public.wellness_question_configs
FOR ALL
TO authenticated
USING (public.can_access_category(auth.uid(), category_id))
WITH CHECK (public.can_access_category(auth.uid(), category_id));

CREATE TRIGGER update_wellness_question_configs_updated_at
BEFORE UPDATE ON public.wellness_question_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.wellness_tracking
ADD COLUMN IF NOT EXISTS custom_answers JSONB NOT NULL DEFAULT '{}'::jsonb;