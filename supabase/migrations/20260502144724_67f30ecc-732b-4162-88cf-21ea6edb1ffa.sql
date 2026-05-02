-- Branding table per club
CREATE TABLE public.club_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL UNIQUE REFERENCES public.clubs(id) ON DELETE CASCADE,
  logo_url TEXT,
  logo_crop JSONB,
  primary_color TEXT NOT NULL DEFAULT '#2563eb',
  secondary_color TEXT NOT NULL DEFAULT '#f5f5f5',
  accent_color TEXT NOT NULL DEFAULT '#dc2626',
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.club_branding ENABLE ROW LEVEL SECURITY;

-- Helper: who can manage branding (club owner or member)
CREATE POLICY "Members can view their club branding"
ON public.club_branding FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_branding.club_id AND c.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_branding.club_id AND m.user_id = auth.uid())
);

CREATE POLICY "Owners can insert their club branding"
ON public.club_branding FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_branding.club_id AND c.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_branding.club_id AND m.user_id = auth.uid())
);

CREATE POLICY "Owners can update their club branding"
ON public.club_branding FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_branding.club_id AND c.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_branding.club_id AND m.user_id = auth.uid())
);

CREATE POLICY "Owners can delete their club branding"
ON public.club_branding FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_branding.club_id AND c.user_id = auth.uid())
);

CREATE TRIGGER update_club_branding_updated_at
BEFORE UPDATE ON public.club_branding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for club logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-logos', 'club-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Club logos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'club-logos');

CREATE POLICY "Authenticated users can upload club logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'club-logos');

CREATE POLICY "Authenticated users can update club logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'club-logos');

CREATE POLICY "Authenticated users can delete club logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'club-logos');