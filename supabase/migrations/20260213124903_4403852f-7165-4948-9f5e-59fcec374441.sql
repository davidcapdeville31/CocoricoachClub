-- Drop the GENERATED ALWAYS column and recreate as a normal column with trigger
ALTER TABLE public.awcr_tracking DROP COLUMN training_load;
ALTER TABLE public.awcr_tracking ADD COLUMN training_load integer;

-- Backfill existing data
UPDATE public.awcr_tracking SET training_load = rpe * duration_minutes;

-- Create trigger to auto-compute training_load on insert/update
CREATE OR REPLACE FUNCTION public.compute_training_load()
RETURNS TRIGGER AS $$
BEGIN
  NEW.training_load := NEW.rpe * NEW.duration_minutes;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_compute_training_load
BEFORE INSERT OR UPDATE ON public.awcr_tracking
FOR EACH ROW
EXECUTE FUNCTION public.compute_training_load();