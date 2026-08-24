ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'fr';

ALTER TABLE public.profiles ADD CONSTRAINT profiles_language_check CHECK (language IN ('fr','en'));