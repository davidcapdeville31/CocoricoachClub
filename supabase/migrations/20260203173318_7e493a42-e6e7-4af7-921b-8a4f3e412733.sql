-- Add exercise_category, target_velocity, erg_data, and running_data columns to program_exercises
ALTER TABLE public.program_exercises 
ADD COLUMN IF NOT EXISTS exercise_category TEXT,
ADD COLUMN IF NOT EXISTS target_velocity NUMERIC(6,3),
ADD COLUMN IF NOT EXISTS erg_data JSONB,
ADD COLUMN IF NOT EXISTS running_data JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.program_exercises.exercise_category IS 'Category of the exercise (running, ergo, sled, etc.) for specialized inputs';
COMMENT ON COLUMN public.program_exercises.target_velocity IS 'VBT - Target velocity in m/s for velocity-based training';
COMMENT ON COLUMN public.program_exercises.erg_data IS 'Ergometer-specific data (watts, calories, distance, etc.)';
COMMENT ON COLUMN public.program_exercises.running_data IS 'Running-specific data (VMA %, pace, intervals, recovery, etc.)';