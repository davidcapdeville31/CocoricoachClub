
-- Snapshot complet d'un club (sans archivage)
CREATE OR REPLACE FUNCTION public.snapshot_club_full(_club_id uuid, _notes text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_snapshot jsonb;
  v_snapshot_id uuid;
  v_name text;
  v_version integer;
  v_is_owner boolean;
  v_is_admin boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT name, (user_id = v_user) INTO v_name, v_is_owner
  FROM public.clubs WHERE id = _club_id;

  IF v_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Club introuvable');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.club_members
    WHERE club_id = _club_id AND user_id = v_user AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT (v_is_owner OR v_is_admin OR public.is_super_admin(v_user)) THEN
    RETURN json_build_object('success', false, 'error', 'Permissions insuffisantes');
  END IF;

  v_snapshot := jsonb_build_object(
    'club', (SELECT to_jsonb(c) FROM public.clubs c WHERE c.id = _club_id),
    'categories', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM public.categories c WHERE c.club_id = _club_id), '[]'::jsonb),
    'players', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.players p
        JOIN public.categories c ON c.id = p.category_id WHERE c.club_id = _club_id), '[]'::jsonb),
    'training_sessions', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.training_sessions t
        JOIN public.categories c ON c.id = t.category_id WHERE c.club_id = _club_id), '[]'::jsonb),
    'gym_session_exercises', COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM public.gym_session_exercises g
        JOIN public.categories c ON c.id = g.category_id WHERE c.club_id = _club_id), '[]'::jsonb),
    'wellness_tracking', COALESCE((SELECT jsonb_agg(to_jsonb(w)) FROM public.wellness_tracking w
        JOIN public.categories c ON c.id = w.category_id WHERE c.club_id = _club_id), '[]'::jsonb),
    'injuries', COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM public.injuries i
        JOIN public.categories c ON c.id = i.category_id WHERE c.club_id = _club_id), '[]'::jsonb),
    'generic_tests', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.generic_tests t
        JOIN public.categories c ON c.id = t.category_id WHERE c.club_id = _club_id), '[]'::jsonb),
    'strength_tests', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.strength_tests t
        JOIN public.categories c ON c.id = t.category_id WHERE c.club_id = _club_id), '[]'::jsonb),
    'speed_tests', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.speed_tests t
        JOIN public.categories c ON c.id = t.category_id WHERE c.club_id = _club_id), '[]'::jsonb),
    'jump_tests', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.jump_tests t
        JOIN public.categories c ON c.id = t.category_id WHERE c.club_id = _club_id), '[]'::jsonb),
    'mobility_tests', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.mobility_tests t
        JOIN public.categories c ON c.id = t.category_id WHERE c.club_id = _club_id), '[]'::jsonb),
    'body_composition', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM public.body_composition b
        JOIN public.categories c ON c.id = b.category_id WHERE c.club_id = _club_id), '[]'::jsonb),
    'awcr_tracking', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM public.awcr_tracking a
        JOIN public.categories c ON c.id = a.category_id WHERE c.club_id = _club_id), '[]'::jsonb),
    'gps_sessions', COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM public.gps_sessions g
        JOIN public.categories c ON c.id = g.category_id WHERE c.club_id = _club_id), '[]'::jsonb),
    'snapshot_taken_at', now()
  );

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM public.archived_snapshots
  WHERE entity_type = 'club' AND entity_id = _club_id;

  INSERT INTO public.archived_snapshots (entity_type, entity_id, club_id, entity_name, snapshot, version, notes, created_by)
  VALUES ('club', _club_id, _club_id, v_name, v_snapshot, v_version, _notes, v_user)
  RETURNING id INTO v_snapshot_id;

  PERFORM public.log_audit_event('snapshot_club_full', 'club', _club_id,
    jsonb_build_object('snapshot_id', v_snapshot_id, 'version', v_version));

  RETURN json_build_object('success', true, 'snapshot_id', v_snapshot_id, 'version', v_version);
END;
$$;

-- Lister tous les snapshots (super admin)
CREATE OR REPLACE FUNCTION public.list_club_snapshots()
RETURNS TABLE(
  snapshot_id uuid,
  entity_type text,
  entity_id uuid,
  entity_name text,
  club_id uuid,
  club_name text,
  version integer,
  notes text,
  created_at timestamptz,
  created_by uuid,
  creator_email text,
  is_archived boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissions insuffisantes';
  END IF;

  RETURN QUERY
  SELECT s.id, s.entity_type, s.entity_id, s.entity_name,
    s.club_id, cl.name,
    s.version, s.notes, s.created_at, s.created_by,
    (SELECT email FROM auth.users WHERE id = s.created_by),
    COALESCE(cl.is_archived, false)
  FROM public.archived_snapshots s
  LEFT JOIN public.clubs cl ON cl.id = s.club_id
  ORDER BY s.created_at DESC;
END;
$$;

-- RLS: permettre aux owner/admin du club de voir leurs propres snapshots
DROP POLICY IF EXISTS "Club staff view own snapshots" ON public.archived_snapshots;
CREATE POLICY "Club staff view own snapshots" ON public.archived_snapshots
FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.clubs WHERE id = archived_snapshots.club_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.club_members WHERE club_id = archived_snapshots.club_id AND user_id = auth.uid() AND role = 'admin')
);
