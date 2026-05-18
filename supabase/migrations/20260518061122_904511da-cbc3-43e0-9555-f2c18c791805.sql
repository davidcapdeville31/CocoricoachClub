CREATE OR REPLACE FUNCTION public.get_invitation_info(_token text, _kind text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid token');
  END IF;

  IF _kind = 'club' THEN
    SELECT jsonb_build_object(
      'success', true,
      'kind', 'club',
      'email', ci.email,
      'role', ci.role,
      'status', ci.status,
      'expires_at', ci.expires_at,
      'club_name', cl.name,
      'category_names', COALESCE((
        SELECT array_agg(c.name)
        FROM categories c
        WHERE c.club_id = cl.id
          AND ci.assigned_categories IS NOT NULL
          AND c.id::text = ANY(ci.assigned_categories)
      ), ARRAY[]::text[])
    )
    INTO result
    FROM club_invitations ci
    JOIN clubs cl ON cl.id = ci.club_id
    WHERE ci.token = _token;

  ELSIF _kind = 'category' THEN
    SELECT jsonb_build_object(
      'success', true,
      'kind', 'category',
      'email', ci.email,
      'role', ci.role,
      'status', ci.status,
      'expires_at', ci.expires_at,
      'club_name', cl.name,
      'category_name', cat.name
    )
    INTO result
    FROM category_invitations ci
    JOIN categories cat ON cat.id = ci.category_id
    JOIN clubs cl ON cl.id = cat.club_id
    WHERE ci.token = _token;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unknown kind');
  END IF;

  IF result IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_info(text, text) TO anon, authenticated;