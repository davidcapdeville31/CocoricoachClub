-- Create table for training session blocks (thematic segments within a session)
CREATE TABLE public.training_session_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  block_order INTEGER NOT NULL DEFAULT 0,
  start_time TIME WITHOUT TIME ZONE,
  end_time TIME WITHOUT TIME ZONE,
  training_type TEXT NOT NULL,
  intensity INTEGER CHECK (intensity >= 1 AND intensity <= 10),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.training_session_blocks ENABLE ROW LEVEL SECURITY;

-- Create policies based on parent session access
CREATE POLICY "Users can view blocks for accessible sessions"
ON public.training_session_blocks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.training_sessions ts
    JOIN public.categories c ON ts.category_id = c.id
    JOIN public.category_members cm ON c.id = cm.category_id
    WHERE ts.id = training_session_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert blocks for their sessions"
ON public.training_session_blocks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.training_sessions ts
    JOIN public.categories c ON ts.category_id = c.id
    JOIN public.category_members cm ON c.id = cm.category_id
    WHERE ts.id = training_session_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('admin', 'coach')
  )
);

CREATE POLICY "Users can update blocks for their sessions"
ON public.training_session_blocks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.training_sessions ts
    JOIN public.categories c ON ts.category_id = c.id
    JOIN public.category_members cm ON c.id = cm.category_id
    WHERE ts.id = training_session_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('admin', 'coach')
  )
);

CREATE POLICY "Users can delete blocks for their sessions"
ON public.training_session_blocks
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.training_sessions ts
    JOIN public.categories c ON ts.category_id = c.id
    JOIN public.category_members cm ON c.id = cm.category_id
    WHERE ts.id = training_session_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('admin', 'coach')
  )
);

-- Create index for performance
CREATE INDEX idx_training_session_blocks_session_id ON public.training_session_blocks(training_session_id);
CREATE INDEX idx_training_session_blocks_order ON public.training_session_blocks(training_session_id, block_order);