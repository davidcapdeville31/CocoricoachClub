
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_players_archived_at ON public.players(archived_at);

CREATE OR REPLACE VIEW public.players_safe
WITH (security_invoker = true) AS
SELECT id, name, first_name, category_id, "position", birth_date, birth_year, avatar_url,
  club_origin, discipline, specialty, user_id, season_id, pwa_install_dismissed, created_at,
  gender,
  CASE WHEN can_view_player_sensitive_data(auth.uid(), category_id) THEN email ELSE NULL::text END AS email,
  CASE WHEN can_view_player_sensitive_data(auth.uid(), category_id) THEN phone ELSE NULL::text END AS phone,
  CASE WHEN can_view_player_sensitive_data(auth.uid(), category_id) THEN parent_contact_1_name ELSE NULL::text END AS parent_contact_1_name,
  CASE WHEN can_view_player_sensitive_data(auth.uid(), category_id) THEN parent_contact_1_phone ELSE NULL::text END AS parent_contact_1_phone,
  CASE WHEN can_view_player_sensitive_data(auth.uid(), category_id) THEN parent_contact_1_email ELSE NULL::text END AS parent_contact_1_email,
  CASE WHEN can_view_player_sensitive_data(auth.uid(), category_id) THEN parent_contact_1_relation ELSE NULL::text END AS parent_contact_1_relation,
  CASE WHEN can_view_player_sensitive_data(auth.uid(), category_id) THEN parent_contact_2_name ELSE NULL::text END AS parent_contact_2_name,
  CASE WHEN can_view_player_sensitive_data(auth.uid(), category_id) THEN parent_contact_2_phone ELSE NULL::text END AS parent_contact_2_phone,
  CASE WHEN can_view_player_sensitive_data(auth.uid(), category_id) THEN parent_contact_2_email ELSE NULL::text END AS parent_contact_2_email,
  CASE WHEN can_view_player_sensitive_data(auth.uid(), category_id) THEN parent_contact_2_relation ELSE NULL::text END AS parent_contact_2_relation,
  CASE WHEN can_view_player_sensitive_data(auth.uid(), category_id) THEN dietary_requirements ELSE NULL::text END AS dietary_requirements,
  CASE WHEN can_view_player_sensitive_data(auth.uid(), category_id) THEN allergies ELSE NULL::text END AS allergies,
  CASE WHEN can_view_player_sensitive_data(auth.uid(), category_id) THEN medical_notes ELSE NULL::text END AS medical_notes,
  CASE WHEN can_view_player_sensitive_data(auth.uid(), category_id) THEN emergency_notes ELSE NULL::text END AS emergency_notes,
  archived_at
FROM public.players;

GRANT SELECT ON public.players_safe TO authenticated, anon;
