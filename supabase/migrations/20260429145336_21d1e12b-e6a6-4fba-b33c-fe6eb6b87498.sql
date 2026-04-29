-- ============================================
-- RGPD: Consents tracking
-- ============================================
CREATE TYPE public.consent_type AS ENUM (
  'terms_of_service',
  'privacy_policy',
  'cookies_essential',
  'cookies_notifications',
  'cookies_preferences',
  'health_data_processing',
  'marketing_communications',
  'parental_consent_minor'
);

CREATE TABLE public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type public.consent_type NOT NULL,
  document_version TEXT,
  granted BOOLEAN NOT NULL DEFAULT true,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_consents_user ON public.user_consents(user_id, consent_type, granted_at DESC);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consents"
  ON public.user_consents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can insert own consents"
  ON public.user_consents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own consents"
  ON public.user_consents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- RGPD: Data export requests
-- ============================================
CREATE TYPE public.export_status AS ENUM ('pending', 'processing', 'ready', 'failed', 'expired');

CREATE TABLE public.data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_for_player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  status public.export_status NOT NULL DEFAULT 'pending',
  format TEXT NOT NULL DEFAULT 'json',
  file_url TEXT,
  error_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_data_export_requests_user ON public.data_export_requests(user_id, requested_at DESC);

ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own export requests"
  ON public.data_export_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users create own export requests"
  ON public.data_export_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RGPD: Account deletion requests (30-day grace)
-- ============================================
CREATE TYPE public.deletion_status AS ENUM ('pending', 'cancelled', 'completed');

CREATE TABLE public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.deletion_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_deletion_requests_scheduled ON public.account_deletion_requests(scheduled_for) WHERE status = 'pending';

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own deletion requests"
  ON public.account_deletion_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users create own deletion requests"
  ON public.account_deletion_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users cancel own deletion requests"
  ON public.account_deletion_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'cancelled'));

-- ============================================
-- RGPD: Legal document versions
-- ============================================
CREATE TABLE public.legal_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL,
  version TEXT NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  summary_of_changes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_type, version)
);

CREATE INDEX idx_legal_docs_current ON public.legal_document_versions(document_type) WHERE is_current = true;

ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view legal versions"
  ON public.legal_document_versions FOR SELECT
  USING (true);

CREATE POLICY "Super admins manage legal versions"
  ON public.legal_document_versions FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Seed initial versions
INSERT INTO public.legal_document_versions (document_type, version, is_current, summary_of_changes)
VALUES
  ('terms_of_service', '1.0', true, 'Version initiale'),
  ('privacy_policy', '1.0', true, 'Version initiale'),
  ('cookies_policy', '1.0', true, 'Version initiale'),
  ('legal_notices', '1.0', true, 'Version initiale');

-- ============================================
-- RGPD: Helper to record consent (RLS-friendly)
-- ============================================
CREATE OR REPLACE FUNCTION public.record_user_consent(
  _consent_type public.consent_type,
  _granted BOOLEAN,
  _document_version TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_consents (
    user_id, consent_type, granted, document_version, metadata
  ) VALUES (
    v_user, _consent_type, _granted, _document_version, _metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================
-- RGPD: Get current consents per user
-- ============================================
CREATE OR REPLACE FUNCTION public.get_current_user_consents(_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  consent_type public.consent_type,
  granted BOOLEAN,
  granted_at TIMESTAMPTZ,
  document_version TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (uc.consent_type)
    uc.consent_type,
    uc.granted,
    uc.granted_at,
    uc.document_version
  FROM public.user_consents uc
  WHERE uc.user_id = COALESCE(_user_id, auth.uid())
  ORDER BY uc.consent_type, uc.granted_at DESC;
$$;
