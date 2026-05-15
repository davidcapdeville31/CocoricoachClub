ALTER TABLE public.public_access_tokens
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS auth_password text;