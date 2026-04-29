-- Enable pgcrypto for field-level encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. USER SECURITY SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  mfa_factor_id TEXT,
  mfa_verified_at TIMESTAMPTZ,
  session_timeout_minutes INTEGER NOT NULL DEFAULT 30 CHECK (session_timeout_minutes >= 5 AND session_timeout_minutes <= 480),
  last_password_change TIMESTAMPTZ,
  password_change_required BOOLEAN NOT NULL DEFAULT false,
  trusted_devices JSONB NOT NULL DEFAULT '[]'::jsonb,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own security settings"
ON public.user_security_settings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins view all security settings"
ON public.user_security_settings FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_user_security_settings_updated_at
BEFORE UPDATE ON public.user_security_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. SECURITY EVENTS LOG (insert-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX idx_security_events_created_at ON public.security_events(created_at DESC);
CREATE INDEX idx_security_events_severity ON public.security_events(severity) WHERE severity IN ('warning', 'critical');
CREATE INDEX idx_security_events_event_type ON public.security_events(event_type);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert their own events (logged via app code)
CREATE POLICY "Users can insert their own security events"
ON public.security_events FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users see their own events
CREATE POLICY "Users view their own security events"
ON public.security_events FOR SELECT
USING (auth.uid() = user_id);

-- Super admins see everything
CREATE POLICY "Super admins view all security events"
ON public.security_events FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- Club admins see their club's events
CREATE POLICY "Club admins view their club security events"
ON public.security_events FOR SELECT
USING (
  club_id IS NOT NULL 
  AND public.has_club_role(auth.uid(), club_id, 'admin'::app_role)
);

-- ============================================================
-- 3. SENSITIVE DATA ACCESS LOG (audit médical)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sensitive_data_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accessor_email TEXT,
  accessor_role TEXT,
  accessed_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  accessed_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accessed_table TEXT NOT NULL,
  accessed_record_id UUID,
  access_action TEXT NOT NULL CHECK (access_action IN ('view', 'export', 'modify', 'delete', 'decrypt')),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  justification TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sensitive_access_accessor ON public.sensitive_data_access_log(accessor_user_id);
CREATE INDEX idx_sensitive_access_player ON public.sensitive_data_access_log(accessed_player_id);
CREATE INDEX idx_sensitive_access_created_at ON public.sensitive_data_access_log(created_at DESC);
CREATE INDEX idx_sensitive_access_table ON public.sensitive_data_access_log(accessed_table);

ALTER TABLE public.sensitive_data_access_log ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert (logged from app)
CREATE POLICY "Authenticated users can log sensitive access"
ON public.sensitive_data_access_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = accessor_user_id);

-- Super admins see everything
CREATE POLICY "Super admins view all sensitive access logs"
ON public.sensitive_data_access_log FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- Club admins see logs for their club
CREATE POLICY "Club admins view their club sensitive access logs"
ON public.sensitive_data_access_log FOR SELECT
USING (
  club_id IS NOT NULL 
  AND public.has_club_role(auth.uid(), club_id, 'admin'::app_role)
);

-- Users see who accessed their own data
CREATE POLICY "Users view who accessed their data"
ON public.sensitive_data_access_log FOR SELECT
USING (auth.uid() = accessed_user_id);

-- ============================================================
-- 4. ENCRYPTED MEDICAL FIELDS (pgcrypto)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.encrypted_medical_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  field_name TEXT NOT NULL,
  encrypted_value BYTEA NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, field_name)
);

CREATE INDEX idx_encrypted_medical_player ON public.encrypted_medical_fields(player_id);

ALTER TABLE public.encrypted_medical_fields ENABLE ROW LEVEL SECURITY;

-- Only medical staff or club admin can see/modify
CREATE POLICY "Medical staff manage encrypted fields"
ON public.encrypted_medical_fields FOR ALL
USING (
  category_id IS NOT NULL 
  AND public.has_medical_access(auth.uid(), 
    (SELECT club_id FROM public.categories WHERE id = category_id))
)
WITH CHECK (
  category_id IS NOT NULL 
  AND public.has_medical_access(auth.uid(), 
    (SELECT club_id FROM public.categories WHERE id = category_id))
);

CREATE POLICY "Super admins view encrypted metadata"
ON public.encrypted_medical_fields FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_encrypted_medical_fields_updated_at
BEFORE UPDATE ON public.encrypted_medical_fields
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. HELPER FUNCTIONS
-- ============================================================

-- Log a security event (callable from app)
CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type TEXT,
  _severity TEXT DEFAULT 'info',
  _ip_address TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _device_fingerprint TEXT DEFAULT NULL,
  _club_id UUID DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  INSERT INTO public.security_events (
    user_id, user_email, event_type, severity,
    ip_address, user_agent, device_fingerprint, club_id, metadata
  ) VALUES (
    auth.uid(), v_user_email, _event_type, _severity,
    _ip_address, _user_agent, _device_fingerprint, _club_id, _metadata
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Log sensitive data access (callable from app)
CREATE OR REPLACE FUNCTION public.log_sensitive_access(
  _accessed_player_id UUID,
  _accessed_table TEXT,
  _access_action TEXT,
  _accessed_record_id UUID DEFAULT NULL,
  _category_id UUID DEFAULT NULL,
  _justification TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_email TEXT;
  v_role TEXT;
  v_club_id UUID;
  v_player_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  
  -- Get role from club_members or super_admin
  IF public.is_super_admin(auth.uid()) THEN
    v_role := 'super_admin';
  END IF;
  
  IF _category_id IS NOT NULL THEN
    SELECT club_id INTO v_club_id FROM public.categories WHERE id = _category_id;
    IF v_role IS NULL THEN
      SELECT role::text INTO v_role 
      FROM public.club_members 
      WHERE user_id = auth.uid() AND club_id = v_club_id LIMIT 1;
    END IF;
  END IF;
  
  IF _accessed_player_id IS NOT NULL THEN
    SELECT user_id INTO v_player_user_id FROM public.players WHERE id = _accessed_player_id;
  END IF;
  
  INSERT INTO public.sensitive_data_access_log (
    accessor_user_id, accessor_email, accessor_role,
    accessed_player_id, accessed_user_id,
    accessed_table, accessed_record_id, access_action,
    category_id, club_id, justification, metadata
  ) VALUES (
    auth.uid(), v_email, COALESCE(v_role, 'unknown'),
    _accessed_player_id, v_player_user_id,
    _accessed_table, _accessed_record_id, _access_action,
    _category_id, v_club_id, _justification, _metadata
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Encrypt a medical field value
CREATE OR REPLACE FUNCTION public.encrypt_medical_field(
  _player_id UUID,
  _category_id UUID,
  _field_name TEXT,
  _value TEXT,
  _encryption_key TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_club_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT club_id INTO v_club_id FROM public.categories WHERE id = _category_id;
  
  IF NOT public.has_medical_access(auth.uid(), v_club_id) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  INSERT INTO public.encrypted_medical_fields (
    player_id, category_id, field_name, encrypted_value, created_by, updated_by
  ) VALUES (
    _player_id, _category_id, _field_name,
    pgp_sym_encrypt(_value, _encryption_key)::bytea,
    auth.uid(), auth.uid()
  )
  ON CONFLICT (player_id, field_name) 
  DO UPDATE SET 
    encrypted_value = pgp_sym_encrypt(_value, _encryption_key)::bytea,
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING id INTO v_id;
  
  -- Log the modification
  PERFORM public.log_sensitive_access(
    _player_id, 'encrypted_medical_fields', 'modify', v_id, _category_id,
    'Encrypted medical field updated', jsonb_build_object('field_name', _field_name)
  );
  
  RETURN v_id;
END;
$$;

-- Decrypt a medical field (logged automatically)
CREATE OR REPLACE FUNCTION public.decrypt_medical_field(
  _player_id UUID,
  _field_name TEXT,
  _encryption_key TEXT,
  _justification TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted BYTEA;
  v_decrypted TEXT;
  v_category_id UUID;
  v_club_id UUID;
  v_record_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT id, encrypted_value, category_id INTO v_record_id, v_encrypted, v_category_id
  FROM public.encrypted_medical_fields
  WHERE player_id = _player_id AND field_name = _field_name;
  
  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT club_id INTO v_club_id FROM public.categories WHERE id = v_category_id;
  
  IF NOT public.has_medical_access(auth.uid(), v_club_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to decrypt this field';
  END IF;
  
  v_decrypted := pgp_sym_decrypt(v_encrypted, _encryption_key);
  
  -- Log the decryption (audit trail)
  PERFORM public.log_sensitive_access(
    _player_id, 'encrypted_medical_fields', 'decrypt', v_record_id, v_category_id,
    COALESCE(_justification, 'Medical field decrypted'),
    jsonb_build_object('field_name', _field_name)
  );
  
  RETURN v_decrypted;
END;
$$;

-- Get security stats for the dashboard
CREATE OR REPLACE FUNCTION public.get_security_stats(_days INTEGER DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can access security stats';
  END IF;
  
  SELECT json_build_object(
    'total_events', (SELECT COUNT(*) FROM public.security_events WHERE created_at > now() - (_days || ' days')::interval),
    'critical_events', (SELECT COUNT(*) FROM public.security_events WHERE severity = 'critical' AND created_at > now() - (_days || ' days')::interval),
    'warning_events', (SELECT COUNT(*) FROM public.security_events WHERE severity = 'warning' AND created_at > now() - (_days || ' days')::interval),
    'failed_logins', (SELECT COUNT(*) FROM public.security_events WHERE event_type = 'login_failed' AND created_at > now() - (_days || ' days')::interval),
    'mfa_enabled_users', (SELECT COUNT(*) FROM public.user_security_settings WHERE mfa_enabled = true),
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'sensitive_access_count', (SELECT COUNT(*) FROM public.sensitive_data_access_log WHERE created_at > now() - (_days || ' days')::interval),
    'unique_accessors', (SELECT COUNT(DISTINCT accessor_user_id) FROM public.sensitive_data_access_log WHERE created_at > now() - (_days || ' days')::interval),
    'most_accessed_tables', (
      SELECT json_agg(t) FROM (
        SELECT accessed_table, COUNT(*) as count 
        FROM public.sensitive_data_access_log 
        WHERE created_at > now() - (_days || ' days')::interval
        GROUP BY accessed_table 
        ORDER BY count DESC LIMIT 5
      ) t
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Auto-create security settings on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_security_settings (user_id, last_password_change)
  VALUES (NEW.id, now())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_security ON auth.users;
CREATE TRIGGER on_auth_user_created_security
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_security();

-- Backfill existing users
INSERT INTO public.user_security_settings (user_id, last_password_change)
SELECT id, COALESCE(last_sign_in_at, created_at) FROM auth.users
ON CONFLICT (user_id) DO NOTHING;