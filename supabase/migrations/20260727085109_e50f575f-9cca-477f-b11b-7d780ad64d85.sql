-- Extend default expiration from 48h to 7 days
ALTER TABLE public.athlete_invitations ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');
ALTER TABLE public.club_invitations ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');
ALTER TABLE public.category_invitations ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');
ALTER TABLE public.ambassador_invitations ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

-- Update renew_invitation to use 7 days
CREATE OR REPLACE FUNCTION public.renew_invitation(_table_name text, _invitation_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_token text;
  v_new_expires timestamptz;
  v_email text;
BEGIN
  v_new_token := gen_random_uuid()::text;
  v_new_expires := now() + interval '7 days';

  IF _table_name = 'ambassador_invitations' THEN
    UPDATE public.ambassador_invitations
    SET token = v_new_token, expires_at = v_new_expires, status = 'pending'
    WHERE id = _invitation_id
    RETURNING email INTO v_email;
  ELSIF _table_name = 'club_invitations' THEN
    UPDATE public.club_invitations
    SET token = v_new_token, expires_at = v_new_expires, status = 'pending'
    WHERE id = _invitation_id
    RETURNING email INTO v_email;
  ELSIF _table_name = 'category_invitations' THEN
    UPDATE public.category_invitations
    SET token = v_new_token, expires_at = v_new_expires, status = 'pending'
    WHERE id = _invitation_id
    RETURNING email INTO v_email;
  ELSIF _table_name = 'athlete_invitations' THEN
    UPDATE public.athlete_invitations
    SET token = v_new_token, expires_at = v_new_expires, status = 'pending'
    WHERE id = _invitation_id
    RETURNING email INTO v_email;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Unknown table');
  END IF;

  IF v_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  RETURN json_build_object('success', true, 'token', v_new_token, 'email', v_email, 'expires_at', v_new_expires);
END;
$function$;

-- Extend still-pending invitations that were created with the old 48h default
UPDATE public.athlete_invitations SET expires_at = created_at + interval '7 days'
  WHERE status = 'pending' AND expires_at > now();
UPDATE public.club_invitations SET expires_at = created_at + interval '7 days'
  WHERE status = 'pending' AND expires_at > now();
UPDATE public.category_invitations SET expires_at = created_at + interval '7 days'
  WHERE status = 'pending' AND expires_at > now();
UPDATE public.ambassador_invitations SET expires_at = created_at + interval '7 days'
  WHERE status = 'pending' AND expires_at > now();