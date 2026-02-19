
-- Fix: Recreate the view with SECURITY INVOKER (default, safe)
DROP VIEW IF EXISTS public.all_invitations;

CREATE VIEW public.all_invitations 
WITH (security_invoker = true)
AS

SELECT 
  ai.id,
  ai.email,
  'admin'::text AS role,
  NULL::uuid AS club_id,
  NULL::uuid[] AS category_ids,
  ai.token,
  ai.status,
  ai.created_at,
  ai.accepted_at,
  ai.expires_at,
  ai.invited_by,
  'ambassador'::text AS invitation_type,
  ai.name AS recipient_name
FROM public.ambassador_invitations ai

UNION ALL

SELECT 
  ci.id,
  ci.email,
  ci.role::text AS role,
  ci.club_id,
  ci.assigned_categories::uuid[] AS category_ids,
  ci.token,
  ci.status,
  ci.created_at,
  NULL::timestamptz AS accepted_at,
  ci.expires_at,
  ci.invited_by,
  'club_staff'::text AS invitation_type,
  NULL::text AS recipient_name
FROM public.club_invitations ci

UNION ALL

SELECT 
  cti.id,
  cti.email,
  cti.role::text AS role,
  NULL::uuid AS club_id,
  ARRAY[cti.category_id]::uuid[] AS category_ids,
  cti.token,
  cti.status,
  cti.created_at,
  NULL::timestamptz AS accepted_at,
  cti.expires_at,
  cti.invited_by,
  'category_member'::text AS invitation_type,
  NULL::text AS recipient_name
FROM public.category_invitations cti

UNION ALL

SELECT 
  ati.id,
  ati.email,
  'athlete'::text AS role,
  ati.club_id,
  ARRAY[ati.category_id]::uuid[] AS category_ids,
  ati.token,
  ati.status,
  ati.created_at,
  ati.accepted_at,
  ati.expires_at,
  ati.invited_by,
  'athlete'::text AS invitation_type,
  NULL::text AS recipient_name
FROM public.athlete_invitations ati;

COMMENT ON VIEW public.all_invitations IS 'Unified view of all invitation types (security invoker)';
