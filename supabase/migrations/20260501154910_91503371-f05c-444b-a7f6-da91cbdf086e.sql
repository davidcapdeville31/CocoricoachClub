CREATE TABLE IF NOT EXISTS public.exercise_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  exercise_id UUID NOT NULL REFERENCES public.exercise_library(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (coach_id, exercise_id)
);

ALTER TABLE public.exercise_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own favorites"
  ON public.exercise_favorites FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Users add their own favorites"
  ON public.exercise_favorites FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Users remove their own favorites"
  ON public.exercise_favorites FOR DELETE
  USING (coach_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_exercise_favorites_coach ON public.exercise_favorites(coach_id);
CREATE INDEX IF NOT EXISTS idx_exercise_favorites_exercise ON public.exercise_favorites(exercise_id);