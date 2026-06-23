ALTER TABLE public.awcr_tracking
ADD COLUMN IF NOT EXISTS post_session_feeling integer CHECK (post_session_feeling >= 1 AND post_session_feeling <= 5),
ADD COLUMN IF NOT EXISTS post_session_notes text;