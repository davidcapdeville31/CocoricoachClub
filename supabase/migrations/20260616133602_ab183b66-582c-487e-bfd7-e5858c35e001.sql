
CREATE TABLE IF NOT EXISTS public.competition_rounds_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid,
  match_id uuid,
  action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  user_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.competition_rounds_audit TO authenticated;
GRANT ALL ON public.competition_rounds_audit TO service_role;

ALTER TABLE public.competition_rounds_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view competition rounds audit"
ON public.competition_rounds_audit
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_cr_audit_match ON public.competition_rounds_audit(match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cr_audit_round ON public.competition_rounds_audit(round_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_competition_rounds()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.competition_rounds_audit(round_id, match_id, action, user_id, new_data)
    VALUES (NEW.id, NEW.match_id, 'INSERT', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.competition_rounds_audit(round_id, match_id, action, user_id, old_data, new_data)
    VALUES (NEW.id, NEW.match_id, 'UPDATE', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.competition_rounds_audit(round_id, match_id, action, user_id, old_data)
    VALUES (OLD.id, OLD.match_id, 'DELETE', auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_competition_rounds ON public.competition_rounds;
CREATE TRIGGER trg_audit_competition_rounds
AFTER INSERT OR UPDATE OR DELETE ON public.competition_rounds
FOR EACH ROW EXECUTE FUNCTION public.audit_competition_rounds();
