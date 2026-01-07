-- Add load objectives columns to training_cycles
ALTER TABLE public.training_cycles 
ADD COLUMN IF NOT EXISTS target_load_min integer,
ADD COLUMN IF NOT EXISTS target_load_max integer,
ADD COLUMN IF NOT EXISTS target_awcr_min numeric(3,2) DEFAULT 0.8,
ADD COLUMN IF NOT EXISTS target_awcr_max numeric(3,2) DEFAULT 1.3,
ADD COLUMN IF NOT EXISTS cycle_type text DEFAULT 'normal';

-- Add comment for documentation
COMMENT ON COLUMN public.training_cycles.target_load_min IS 'Minimum target training load for the week';
COMMENT ON COLUMN public.training_cycles.target_load_max IS 'Maximum target training load for the week';
COMMENT ON COLUMN public.training_cycles.target_awcr_min IS 'Minimum target AWCR for the week';
COMMENT ON COLUMN public.training_cycles.target_awcr_max IS 'Maximum target AWCR for the week';
COMMENT ON COLUMN public.training_cycles.cycle_type IS 'Type of cycle: recovery, normal, intensification, competition';