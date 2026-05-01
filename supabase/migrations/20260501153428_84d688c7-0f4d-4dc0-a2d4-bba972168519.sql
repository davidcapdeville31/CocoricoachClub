-- =====================================================
-- DROP COMPLET DE L'ANCIENNE TABLE EXERCISE_LIBRARY
-- =====================================================
-- Les FK ON DELETE SET NULL des tables référentes vont automatiquement mettre à NULL
-- les colonnes library_exercise_id / exercise_id / exercise_library_id

DROP TABLE IF EXISTS public.exercise_library CASCADE;

-- =====================================================
-- RECRÉATION SCHÉMA REMIX EXACT
-- =====================================================

CREATE TABLE public.exercise_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  station_name TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  description TEXT,
  general_description TEXT,
  positioning_criteria JSONB,
  execution_criteria JSONB,
  safety_prevention JSONB,
  tips TEXT,
  image_url TEXT,
  video_url TEXT,
  difficulty_level TEXT CHECK (difficulty_level IN ('débutant', 'intermédiaire', 'avancé')),
  muscles TEXT[],
  equipment TEXT[],
  joint_movements TEXT[],
  exercise_type TEXT,
  is_variation BOOLEAN DEFAULT false,
  coach_id UUID,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.exercise_library ENABLE ROW LEVEL SECURITY;

-- SELECT : tout le monde voit les exercices système + ses propres
CREATE POLICY "Users can view exercises"
  ON public.exercise_library
  FOR SELECT
  USING (
    is_default = true 
    OR coach_id = auth.uid()
    OR public.is_super_admin(auth.uid())
  );

-- INSERT : super_admin pour les défauts, coachs pour leurs custom
CREATE POLICY "Create exercises"
  ON public.exercise_library
  FOR INSERT
  WITH CHECK (
    (public.is_super_admin(auth.uid()) AND is_default = true AND coach_id IS NULL)
    OR
    (is_default = false AND coach_id = auth.uid())
  );

-- UPDATE
CREATE POLICY "Update exercises"
  ON public.exercise_library
  FOR UPDATE
  USING (
    (public.is_super_admin(auth.uid()) AND is_default = true)
    OR
    (coach_id = auth.uid() AND is_default = false)
  );

-- DELETE
CREATE POLICY "Delete exercises"
  ON public.exercise_library
  FOR DELETE
  USING (
    (public.is_super_admin(auth.uid()) AND is_default = true)
    OR
    (coach_id = auth.uid() AND is_default = false)
  );

-- Trigger updated_at
CREATE TRIGGER update_exercise_library_updated_at
  BEFORE UPDATE ON public.exercise_library
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- TABLE COACH_EXERCISE_OVERRIDES
-- =====================================================

CREATE TABLE public.coach_exercise_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_exercise_id UUID NOT NULL REFERENCES public.exercise_library(id) ON DELETE CASCADE,
  override_image_url TEXT,
  override_video_url TEXT,
  override_description TEXT,
  override_general_description TEXT,
  override_positioning_criteria JSONB,
  override_execution_criteria JSONB,
  override_safety_prevention JSONB,
  override_tips TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(coach_id, base_exercise_id)
);

CREATE TRIGGER update_coach_exercise_overrides_updated_at
  BEFORE UPDATE ON public.coach_exercise_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.coach_exercise_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view their own overrides"
  ON public.coach_exercise_overrides
  FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can insert their own overrides"
  ON public.coach_exercise_overrides
  FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update their own overrides"
  ON public.coach_exercise_overrides
  FOR UPDATE
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can delete their own overrides"
  ON public.coach_exercise_overrides
  FOR DELETE
  USING (coach_id = auth.uid());

-- =====================================================
-- FONCTION RPC FUSION
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_merged_exercises_for_coach(p_coach_id UUID)
RETURNS TABLE (
  id UUID,
  exercise_name TEXT,
  station_name TEXT,
  exercise_type TEXT,
  description TEXT,
  general_description TEXT,
  positioning_criteria JSONB,
  execution_criteria JSONB,
  safety_prevention JSONB,
  tips TEXT,
  image_url TEXT,
  video_url TEXT,
  difficulty_level TEXT,
  muscles TEXT[],
  equipment TEXT[],
  joint_movements TEXT[],
  is_default BOOLEAN,
  coach_id UUID,
  is_overridden BOOLEAN,
  is_custom BOOLEAN,
  override_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    e.id,
    e.exercise_name,
    e.station_name,
    e.exercise_type,
    COALESCE(o.override_description, e.description) as description,
    COALESCE(o.override_general_description, e.general_description) as general_description,
    COALESCE(o.override_positioning_criteria, e.positioning_criteria) as positioning_criteria,
    COALESCE(o.override_execution_criteria, e.execution_criteria) as execution_criteria,
    COALESCE(o.override_safety_prevention, e.safety_prevention) as safety_prevention,
    COALESCE(o.override_tips, e.tips) as tips,
    COALESCE(o.override_image_url, e.image_url) as image_url,
    COALESCE(o.override_video_url, e.video_url) as video_url,
    e.difficulty_level,
    e.muscles,
    e.equipment,
    e.joint_movements,
    e.is_default,
    e.coach_id,
    (o.id IS NOT NULL) as is_overridden,
    false as is_custom,
    o.id as override_id,
    e.created_at,
    GREATEST(e.updated_at, o.updated_at) as updated_at
  FROM public.exercise_library e
  LEFT JOIN public.coach_exercise_overrides o 
    ON o.base_exercise_id = e.id AND o.coach_id = p_coach_id
  WHERE e.is_default = true

  UNION ALL

  SELECT 
    e.id,
    e.exercise_name,
    e.station_name,
    e.exercise_type,
    e.description,
    e.general_description,
    e.positioning_criteria,
    e.execution_criteria,
    e.safety_prevention,
    e.tips,
    e.image_url,
    e.video_url,
    e.difficulty_level,
    e.muscles,
    e.equipment,
    e.joint_movements,
    e.is_default,
    e.coach_id,
    false as is_overridden,
    true as is_custom,
    NULL::UUID as override_id,
    e.created_at,
    e.updated_at
  FROM public.exercise_library e
  WHERE e.coach_id = p_coach_id AND e.is_default = false
  
  ORDER BY exercise_name;
$$;

-- =====================================================
-- BUCKET STORAGE EXERCISE-IMAGES
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-images', 'exercise-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view exercise images" ON storage.objects;
CREATE POLICY "Anyone can view exercise images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'exercise-images');

DROP POLICY IF EXISTS "Super admin can upload admin exercise images" ON storage.objects;
CREATE POLICY "Super admin can upload admin exercise images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'exercise-images' 
    AND public.is_super_admin(auth.uid())
    AND (storage.foldername(name))[1] = 'admin'
  );

DROP POLICY IF EXISTS "Coaches can upload their own exercise images" ON storage.objects;
CREATE POLICY "Coaches can upload their own exercise images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'exercise-images' 
    AND (storage.foldername(name))[1] = 'coach'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Super admin can delete admin exercise images" ON storage.objects;
CREATE POLICY "Super admin can delete admin exercise images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'exercise-images' 
    AND public.is_super_admin(auth.uid())
    AND (storage.foldername(name))[1] = 'admin'
  );

DROP POLICY IF EXISTS "Coaches can delete their own exercise images" ON storage.objects;
CREATE POLICY "Coaches can delete their own exercise images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'exercise-images' 
    AND (storage.foldername(name))[1] = 'coach'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Super admin can update admin exercise images" ON storage.objects;
CREATE POLICY "Super admin can update admin exercise images"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'exercise-images' 
    AND public.is_super_admin(auth.uid())
    AND (storage.foldername(name))[1] = 'admin'
  );

DROP POLICY IF EXISTS "Coaches can update their own exercise images" ON storage.objects;
CREATE POLICY "Coaches can update their own exercise images"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'exercise-images' 
    AND (storage.foldername(name))[1] = 'coach'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Bucket vidéos (au cas où)
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-videos', 'exercise-videos', true)
ON CONFLICT (id) DO NOTHING;