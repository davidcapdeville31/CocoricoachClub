-- ============================================================
-- ARCHIVE SYSTEM: clubs + categories
-- ============================================================

-- 1. Add archive columns to clubs
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID;

-- 2. Add archive columns to categories
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID;

CREATE INDEX IF NOT EXISTS idx_clubs_is_archived ON public.clubs(is_archived);
CREATE INDEX IF NOT EXISTS idx_categories_is_archived ON public.categories(is_archived);

-- 3. Snapshots table
CREATE TABLE IF NOT EXISTS public.archived_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('club','category')),
  entity_id UUID NOT NULL,
  club_id UUID,
  entity_name TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archived_snapshots_entity ON public.archived_snapshots(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_archived_snapshots_club ON public.archived_snapshots(club_id);

ALTER TABLE public.archived_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage snapshots" ON public.archived_snapshots;
CREATE POLICY "Super admins manage snapshots"
ON public.archived_snapshots
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. Archive a club
CREATE OR REPLACE FUNCTION public.archive_club(_club_id UUID, _notes TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_snapshot JSONB;
  v_snapshot_id UUID;
  v_name TEXT;
  v_version INTEGER;
BEGIN
  IF v_user IS NULL OR NOT public.is_super_admin(v_user) THEN
    RETURN json_build_object('success', false, 'error', 'Permissions insuffisantes');
  END IF;

  SELECT name INTO v_name FROM public.clubs WHERE id = _club_id;
  IF v_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Club introuvable');
  END IF;

  -- Build snapshot
  v_snapshot := jsonb_build_object(
    'club', (SELECT to_jsonb(c) FROM public.clubs c WHERE c.id = _club_id),
    'categories', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM public.categories c WHERE c.club_id = _club_id), '[]'::jsonb),
    'players_count', (SELECT COUNT(*) FROM public.players p JOIN public.categories c ON c.id = p.category_id WHERE c.club_id = _club_id),
    'archived_at', now()
  );

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM public.archived_snapshots
  WHERE entity_type = 'club' AND entity_id = _club_id;

  INSERT INTO public.archived_snapshots (entity_type, entity_id, club_id, entity_name, snapshot, version, notes, created_by)
  VALUES ('club', _club_id, _club_id, v_name, v_snapshot, v_version, _notes, v_user)
  RETURNING id INTO v_snapshot_id;

  UPDATE public.clubs
  SET is_archived = true, archived_at = now(), archived_by = v_user
  WHERE id = _club_id;

  -- cascade archive flag on categories
  UPDATE public.categories
  SET is_archived = true, archived_at = now(), archived_by = v_user
  WHERE club_id = _club_id AND is_archived = false;

  PERFORM public.log_audit_event('archive_club', 'club', _club_id, jsonb_build_object('snapshot_id', v_snapshot_id, 'version', v_version));

  RETURN json_build_object('success', true, 'snapshot_id', v_snapshot_id, 'version', v_version);
END;
$$;

-- 5. Archive a category
CREATE OR REPLACE FUNCTION public.archive_category(_category_id UUID, _notes TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_snapshot JSONB;
  v_snapshot_id UUID;
  v_name TEXT;
  v_club_id UUID;
  v_version INTEGER;
BEGIN
  IF v_user IS NULL OR NOT public.is_super_admin(v_user) THEN
    RETURN json_build_object('success', false, 'error', 'Permissions insuffisantes');
  END IF;

  SELECT name, club_id INTO v_name, v_club_id FROM public.categories WHERE id = _category_id;
  IF v_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Catégorie introuvable');
  END IF;

  v_snapshot := jsonb_build_object(
    'category', (SELECT to_jsonb(c) FROM public.categories c WHERE c.id = _category_id),
    'players', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.players p WHERE p.category_id = _category_id), '[]'::jsonb),
    'players_count', (SELECT COUNT(*) FROM public.players WHERE category_id = _category_id),
    'archived_at', now()
  );

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM public.archived_snapshots
  WHERE entity_type = 'category' AND entity_id = _category_id;

  INSERT INTO public.archived_snapshots (entity_type, entity_id, club_id, entity_name, snapshot, version, notes, created_by)
  VALUES ('category', _category_id, v_club_id, v_name, v_snapshot, v_version, _notes, v_user)
  RETURNING id INTO v_snapshot_id;

  UPDATE public.categories
  SET is_archived = true, archived_at = now(), archived_by = v_user
  WHERE id = _category_id;

  PERFORM public.log_audit_event('archive_category', 'category', _category_id, jsonb_build_object('snapshot_id', v_snapshot_id, 'version', v_version));

  RETURN json_build_object('success', true, 'snapshot_id', v_snapshot_id, 'version', v_version);
END;
$$;

-- 6. Restore club
CREATE OR REPLACE FUNCTION public.restore_club(_club_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.is_super_admin(v_user) THEN
    RETURN json_build_object('success', false, 'error', 'Permissions insuffisantes');
  END IF;

  UPDATE public.clubs
  SET is_archived = false, archived_at = NULL, archived_by = NULL
  WHERE id = _club_id;

  UPDATE public.categories
  SET is_archived = false, archived_at = NULL, archived_by = NULL
  WHERE club_id = _club_id;

  PERFORM public.log_audit_event('restore_club', 'club', _club_id, '{}'::jsonb);
  RETURN json_build_object('success', true);
END;
$$;

-- 7. Restore category
CREATE OR REPLACE FUNCTION public.restore_category(_category_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.is_super_admin(v_user) THEN
    RETURN json_build_object('success', false, 'error', 'Permissions insuffisantes');
  END IF;

  UPDATE public.categories
  SET is_archived = false, archived_at = NULL, archived_by = NULL
  WHERE id = _category_id;

  PERFORM public.log_audit_event('restore_category', 'category', _category_id, '{}'::jsonb);
  RETURN json_build_object('success', true);
END;
$$;

-- 8. List archived entities
CREATE OR REPLACE FUNCTION public.list_archived_entities()
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  club_id UUID,
  club_name TEXT,
  archived_at TIMESTAMPTZ,
  archived_by UUID,
  archiver_email TEXT,
  snapshot_count INTEGER,
  latest_snapshot_id UUID
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
  SELECT 'club'::text, c.id, c.name, c.id, c.name,
    c.archived_at, c.archived_by,
    (SELECT email FROM auth.users WHERE id = c.archived_by),
    (SELECT COUNT(*)::int FROM public.archived_snapshots s WHERE s.entity_type='club' AND s.entity_id=c.id),
    (SELECT s.id FROM public.archived_snapshots s WHERE s.entity_type='club' AND s.entity_id=c.id ORDER BY s.created_at DESC LIMIT 1)
  FROM public.clubs c
  WHERE c.is_archived = true
  UNION ALL
  SELECT 'category'::text, cat.id, cat.name, cat.club_id, cl.name,
    cat.archived_at, cat.archived_by,
    (SELECT email FROM auth.users WHERE id = cat.archived_by),
    (SELECT COUNT(*)::int FROM public.archived_snapshots s WHERE s.entity_type='category' AND s.entity_id=cat.id),
    (SELECT s.id FROM public.archived_snapshots s WHERE s.entity_type='category' AND s.entity_id=cat.id ORDER BY s.created_at DESC LIMIT 1)
  FROM public.categories cat
  LEFT JOIN public.clubs cl ON cl.id = cat.club_id
  WHERE cat.is_archived = true AND (cl.is_archived = false OR cl.is_archived IS NULL)
  ORDER BY archived_at DESC NULLS LAST;
END;
$$;

-- 9. Permanent delete
CREATE OR REPLACE FUNCTION public.delete_archived_club(_club_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Permissions insuffisantes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = _club_id AND is_archived = true) THEN
    RETURN json_build_object('success', false, 'error', 'Le club doit être archivé avant suppression définitive');
  END IF;
  DELETE FROM public.clubs WHERE id = _club_id;
  PERFORM public.log_audit_event('delete_archived_club', 'club', _club_id, '{}'::jsonb);
  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_archived_category(_category_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Permissions insuffisantes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = _category_id AND is_archived = true) THEN
    RETURN json_build_object('success', false, 'error', 'La catégorie doit être archivée avant suppression définitive');
  END IF;
  DELETE FROM public.categories WHERE id = _category_id;
  PERFORM public.log_audit_event('delete_archived_category', 'category', _category_id, '{}'::jsonb);
  RETURN json_build_object('success', true);
END;
$$;