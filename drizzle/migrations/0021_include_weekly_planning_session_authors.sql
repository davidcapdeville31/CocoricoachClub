CREATE OR REPLACE FUNCTION public.get_session_authorship(session_ids uuid[]) RETURNS TABLE(session_id uuid, author_user_id uuid, author_name text, author_player_id uuid) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
SELECT s.id, s.author_user_id,
CASE WHEN s.author_user_id IS NOT NULL THEN s.author_name ELSE NULLIF(trim(concat_ws(' ', p.first_name, p.name)), '') END,
CASE WHEN s.author_user_id IS NULL THEN s.created_by_player_id ELSE NULL END
FROM public.training_sessions s
LEFT JOIN public.players_safe p ON p.id = s.created_by_player_id AND s.author_user_id IS NULL
WHERE s.id = ANY(session_ids)
UNION ALL
SELECT w.id, w.created_by, NULLIF(trim(pr.full_name), ''), NULL::uuid
FROM public.weekly_planning w LEFT JOIN public.profiles pr ON pr.id = w.created_by
WHERE w.id = ANY(session_ids)
$$;
REVOKE ALL ON FUNCTION public.get_session_authorship(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_authorship(uuid[]) TO authenticated, service_role;