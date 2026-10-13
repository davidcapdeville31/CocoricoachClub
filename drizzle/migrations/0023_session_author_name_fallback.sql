CREATE OR REPLACE FUNCTION public.get_session_authorship(session_ids uuid[])
 RETURNS TABLE(session_id uuid, author_user_id uuid, author_name text, author_player_id uuid)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
SELECT s.id, s.author_user_id,
  COALESCE(
    NULLIF(trim(s.author_name), ''),
    NULLIF(trim(pr.full_name), ''),
    NULLIF(trim(concat_ws(' ', p.first_name, p.name)), '')
  ),
  s.created_by_player_id
FROM public.training_sessions s
LEFT JOIN public.players_safe p ON p.id = s.created_by_player_id
LEFT JOIN public.profiles pr ON pr.id = s.author_user_id
WHERE s.id = ANY(session_ids)
UNION ALL
SELECT w.id, w.created_by, NULLIF(trim(pr.full_name), ''), NULL::uuid
FROM public.weekly_planning w LEFT JOIN public.profiles pr ON pr.id = w.created_by
WHERE w.id = ANY(session_ids)
$function$;