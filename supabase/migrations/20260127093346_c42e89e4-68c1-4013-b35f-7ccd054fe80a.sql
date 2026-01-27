-- Add match_id to gps_sessions to allow linking GPS data to matches
ALTER TABLE public.gps_sessions 
ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_gps_sessions_match_id ON public.gps_sessions(match_id);

-- Add a constraint to ensure either training_session_id OR match_id is set (not both)
-- This is optional but helps maintain data integrity
ALTER TABLE public.gps_sessions 
ADD CONSTRAINT gps_sessions_single_parent 
CHECK (
  NOT (training_session_id IS NOT NULL AND match_id IS NOT NULL)
);