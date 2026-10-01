ALTER TABLE public.exercise_library
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subcategories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS canonical_id uuid NULL REFERENCES public.exercise_library(id) ON DELETE SET NULL;

UPDATE public.exercise_library SET categories = ARRAY[
  CASE
    WHEN station_name IN ('bodyweight_upper','bodyweight_lower','bodyweight_full','calisthenics','gymnastics','weighted_calisthenics','upper_pull','lower_push') THEN 'Poids de corps/Calisthenics'
    WHEN station_name IN ('bodyweight_core','core','anti_rotation') THEN 'Gainage/Core'
    WHEN station_name LIKE 'halterophilie_%' THEN 'Haltérophilie'
    WHEN station_name LIKE 'running_%' OR station_name = 'cardio' THEN 'Cardio/Endurance'
    WHEN station_name = 'explosive' THEN 'Vitesse/Plyométrie'
    WHEN station_name = 'functional_fitness' THEN 'CrossFit'
    ELSE station_name
  END]
WHERE categories = '{}' AND station_name IS NOT NULL AND station_name <> '';

CREATE INDEX IF NOT EXISTS idx_exercise_library_categories ON public.exercise_library USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_exercise_library_subcategories ON public.exercise_library USING GIN (subcategories);

DROP FUNCTION IF EXISTS public.get_merged_exercises_for_coach(uuid);
CREATE FUNCTION public.get_merged_exercises_for_coach(p_coach_id uuid)
 RETURNS TABLE(id uuid, exercise_name text, station_name text, exercise_type text, description text, general_description text, positioning_criteria jsonb, execution_criteria jsonb, safety_prevention jsonb, tips text, image_url text, video_url text, difficulty_level text, muscles text[], equipment text[], joint_movements text[], is_default boolean, coach_id uuid, is_overridden boolean, is_custom boolean, override_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, categories text[], subcategories text[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.id, e.exercise_name, e.station_name, e.exercise_type,
    COALESCE(o.override_description, e.description),
    COALESCE(o.override_general_description, e.general_description),
    COALESCE(o.override_positioning_criteria, e.positioning_criteria),
    COALESCE(o.override_execution_criteria, e.execution_criteria),
    COALESCE(o.override_safety_prevention, e.safety_prevention),
    COALESCE(o.override_tips, e.tips),
    COALESCE(o.override_image_url, e.image_url),
    COALESCE(o.override_video_url, e.video_url),
    e.difficulty_level, e.muscles, e.equipment, e.joint_movements, e.is_default, e.coach_id,
    (o.id IS NOT NULL), false, o.id, e.created_at, GREATEST(e.updated_at, o.updated_at),
    e.categories, e.subcategories
  FROM public.exercise_library e
  LEFT JOIN public.coach_exercise_overrides o ON o.base_exercise_id = e.id AND o.coach_id = p_coach_id
  WHERE e.is_default = true AND e.canonical_id IS NULL
  UNION ALL
  SELECT e.id, e.exercise_name, e.station_name, e.exercise_type, e.description, e.general_description,
    e.positioning_criteria, e.execution_criteria, e.safety_prevention, e.tips, e.image_url, e.video_url,
    e.difficulty_level, e.muscles, e.equipment, e.joint_movements, e.is_default, e.coach_id,
    false, true, NULL::uuid, e.created_at, e.updated_at, e.categories, e.subcategories
  FROM public.exercise_library e
  WHERE e.coach_id = p_coach_id AND e.is_default = false AND e.canonical_id IS NULL
  ORDER BY 2;
$function$;
GRANT EXECUTE ON FUNCTION public.get_merged_exercises_for_coach(uuid) TO authenticated, service_role;