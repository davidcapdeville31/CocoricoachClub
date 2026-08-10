
CREATE TABLE IF NOT EXISTS public.cron_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cron_tokens TO service_role;
ALTER TABLE public.cron_tokens ENABLE ROW LEVEL SECURITY;
