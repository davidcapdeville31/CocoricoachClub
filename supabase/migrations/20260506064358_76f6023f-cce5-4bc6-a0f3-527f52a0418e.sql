
CREATE OR REPLACE FUNCTION public.list_club_snapshots()
 RETURNS TABLE(snapshot_id uuid, entity_type text, entity_id uuid, entity_name text, club_id uuid, club_name text, version integer, notes text, created_at timestamp with time zone, created_by uuid, creator_email text, is_archived boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissions insuffisantes';
  END IF;

  RETURN QUERY
  SELECT 
    s.id,
    s.entity_type::text,
    s.entity_id,
    s.entity_name::text,
    s.club_id,
    cl.name::text,
    s.version,
    s.notes::text,
    s.created_at,
    s.created_by,
    (SELECT u.email::text FROM auth.users u WHERE u.id = s.created_by)::text,
    COALESCE(
      CASE WHEN s.entity_type='club' THEN (SELECT cl2.is_archived FROM public.clubs cl2 WHERE cl2.id = s.entity_id)
           WHEN s.entity_type='category' THEN (SELECT cat.is_archived FROM public.categories cat WHERE cat.id = s.entity_id)
      END, false)
  FROM public.archived_snapshots s
  LEFT JOIN public.clubs cl ON cl.id = s.club_id
  ORDER BY s.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_archived_entities()
 RETURNS TABLE(entity_type text, entity_id uuid, entity_name text, club_id uuid, club_name text, archived_at timestamp with time zone, archived_by uuid, archiver_email text, snapshot_count integer, latest_snapshot_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissions insuffisantes';
  END IF;

  RETURN QUERY
  SELECT 
    'club'::text, c.id, c.name::text, c.id, c.name::text,
    c.archived_at, c.archived_by,
    (SELECT u.email::text FROM auth.users u WHERE u.id = c.archived_by)::text,
    (SELECT COUNT(*)::int FROM public.archived_snapshots s WHERE s.entity_type='club' AND s.entity_id=c.id),
    (SELECT s.id FROM public.archived_snapshots s WHERE s.entity_type='club' AND s.entity_id=c.id ORDER BY s.created_at DESC LIMIT 1)
  FROM public.clubs c
  WHERE c.is_archived = true
  UNION ALL
  SELECT 
    'category'::text, cat.id, cat.name::text, cat.club_id, cl.name::text,
    cat.archived_at, cat.archived_by,
    (SELECT u.email::text FROM auth.users u WHERE u.id = cat.archived_by)::text,
    (SELECT COUNT(*)::int FROM public.archived_snapshots s WHERE s.entity_type='category' AND s.entity_id=cat.id),
    (SELECT s.id FROM public.archived_snapshots s WHERE s.entity_type='category' AND s.entity_id=cat.id ORDER BY s.created_at DESC LIMIT 1)
  FROM public.categories cat
  LEFT JOIN public.clubs cl ON cl.id = cat.club_id
  WHERE cat.is_archived = true AND (cl.is_archived = false OR cl.is_archived IS NULL)
  ORDER BY 6 DESC NULLS LAST;
END;
$function$;
