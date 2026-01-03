-- 1. Create audit_logs table for tracking sensitive actions
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view all audit logs" 
ON public.audit_logs 
FOR SELECT 
TO authenticated
USING (is_super_admin(auth.uid()));

-- Any authenticated user can insert audit logs (for their own actions)
CREATE POLICY "Users can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Create function to log audit events (callable from frontend)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action TEXT,
  _entity_type TEXT,
  _entity_id UUID DEFAULT NULL,
  _details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), _action, _entity_type, _entity_id, _details)
  RETURNING id INTO _log_id;
  
  RETURN _log_id;
END;
$$;

-- 3. Create push_subscriptions table for web push notifications
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can view own subscriptions" 
ON public.push_subscriptions FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" 
ON public.push_subscriptions FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" 
ON public.push_subscriptions FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions" 
ON public.push_subscriptions FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- 4. Create triggers for automatic audit logging on sensitive tables

-- Audit trigger for injuries
CREATE OR REPLACE FUNCTION public.audit_injury_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'create', 'injury', NEW.id, jsonb_build_object(
      'player_id', NEW.player_id,
      'injury_type', NEW.injury_type,
      'severity', NEW.severity
    ));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'update', 'injury', NEW.id, jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'player_id', NEW.player_id
    ));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'delete', 'injury', OLD.id, jsonb_build_object(
      'player_id', OLD.player_id,
      'injury_type', OLD.injury_type
    ));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_injuries_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.injuries
FOR EACH ROW EXECUTE FUNCTION public.audit_injury_changes();

-- Audit trigger for player transfers
CREATE OR REPLACE FUNCTION public.audit_player_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'transfer', 'player', NEW.player_id, jsonb_build_object(
    'from_category', NEW.from_category_id,
    'to_category', NEW.to_category_id,
    'reason', NEW.reason
  ));
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_player_transfers_trigger
AFTER INSERT ON public.player_transfers
FOR EACH ROW EXECUTE FUNCTION public.audit_player_transfer();

-- Audit trigger for approved_users changes
CREATE OR REPLACE FUNCTION public.audit_approval_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (COALESCE(NEW.approved_by, auth.uid()), 'approve_user', 'user', NEW.user_id, jsonb_build_object(
      'notes', NEW.notes
    ));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'revoke_approval', 'user', OLD.user_id, '{}'::jsonb);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_approvals_trigger
AFTER INSERT OR DELETE ON public.approved_users
FOR EACH ROW EXECUTE FUNCTION public.audit_approval_changes();

-- Audit trigger for super_admin_users changes
CREATE OR REPLACE FUNCTION public.audit_super_admin_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (COALESCE(NEW.granted_by, auth.uid()), 'grant_super_admin', 'user', NEW.user_id, '{}'::jsonb);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'revoke_super_admin', 'user', OLD.user_id, '{}'::jsonb);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_super_admins_trigger
AFTER INSERT OR DELETE ON public.super_admin_users
FOR EACH ROW EXECUTE FUNCTION public.audit_super_admin_changes();