CREATE TABLE public.content_translations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_hash text NOT NULL,
  source_lang text NOT NULL,
  target_lang text NOT NULL,
  source_text text NOT NULL,
  translated_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX content_translations_unique ON public.content_translations (source_hash, source_lang, target_lang);
CREATE INDEX content_translations_lookup ON public.content_translations (target_lang, source_hash);

GRANT SELECT, INSERT, UPDATE ON public.content_translations TO authenticated;
GRANT SELECT ON public.content_translations TO anon;
GRANT ALL ON public.content_translations TO service_role;

ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read content translations"
ON public.content_translations FOR SELECT USING (true);

CREATE POLICY "Authenticated can add content translations"
ON public.content_translations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update content translations"
ON public.content_translations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_content_translations_updated_at
BEFORE UPDATE ON public.content_translations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();