ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS session_kind text NULL;
ALTER TABLE public.training_sessions DROP CONSTRAINT IF EXISTS training_sessions_session_kind_check;
ALTER TABLE public.training_sessions ADD CONSTRAINT training_sessions_session_kind_check CHECK (session_kind IS NULL OR session_kind IN ('training','competition','personal','evaluation'));
CREATE INDEX IF NOT EXISTS idx_training_sessions_session_kind ON public.training_sessions(category_id, session_kind) WHERE session_kind IS NOT NULL;