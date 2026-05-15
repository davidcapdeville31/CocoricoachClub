
CREATE OR REPLACE FUNCTION public.restore_from_snapshot(_snapshot_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_snap public.archived_snapshots%ROWTYPE;
  v_data JSONB;
  v_key TEXT;
  v_table TEXT;
  v_rows JSONB;
  v_cols TEXT;
  v_pk TEXT;
  v_update_set TEXT;
  v_restored_count INT := 0;
  v_skipped JSONB := '[]'::jsonb;
  v_errors JSONB := '[]'::jsonb;
  v_sql TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.is_super_admin(v_user) THEN
    RETURN json_build_object('success', false, 'error', 'Permissions insuffisantes');
  END IF;

  SELECT * INTO v_snap FROM public.archived_snapshots WHERE id = _snapshot_id;
  IF v_snap.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Instantané introuvable');
  END IF;

  v_data := v_snap.snapshot;

  -- 1) Restore the entity itself first (category or club + categories)
  IF v_snap.entity_type = 'category' AND v_data ? 'category' THEN
    INSERT INTO public.categories
    SELECT * FROM jsonb_populate_record(NULL::public.categories, v_data->'category')
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      is_archived = false,
      archived_at = NULL,
      archived_by = NULL;
  ELSIF v_snap.entity_type = 'club' AND v_data ? 'club' THEN
    INSERT INTO public.clubs
    SELECT * FROM jsonb_populate_record(NULL::public.clubs, v_data->'club')
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      is_archived = false,
      archived_at = NULL,
      archived_by = NULL;
    IF v_data ? 'categories' THEN
      INSERT INTO public.categories
      SELECT * FROM jsonb_populate_recordset(NULL::public.categories, v_data->'categories')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        is_archived = false,
        archived_at = NULL,
        archived_by = NULL;
    END IF;
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(v_data)
  LOOP
    CONTINUE WHEN v_key IN ('category','club','categories','archived_at','snapshot_taken_at','player_ids','players_count','tables_captured');

    IF v_key LIKE 'by_player__%' THEN
      v_table := substring(v_key FROM 12);
    ELSE
      v_table := v_key;
    END IF;

    v_rows := v_data->v_key;
    IF v_rows IS NULL OR jsonb_typeof(v_rows) <> 'array' OR jsonb_array_length(v_rows) = 0 THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=v_table) THEN
      v_skipped := v_skipped || jsonb_build_array(v_table || ' (table introuvable)');
      CONTINUE;
    END IF;

    BEGIN
      -- Column list from snapshot ∩ table columns
      EXECUTE format($q$
        WITH src AS (
          SELECT jsonb_object_keys(($1->>0)::jsonb) AS k
        ),
        cols AS (
          SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.column_name) AS list
          FROM information_schema.columns c
          WHERE c.table_schema='public' AND c.table_name=%L
            AND c.column_name IN (SELECT k FROM src)
        )
        SELECT list FROM cols
      $q$, v_table) INTO v_cols USING v_rows;

      IF v_cols IS NULL OR v_cols = '' THEN
        v_skipped := v_skipped || jsonb_build_array(v_table || ' (aucune colonne commune)');
        CONTINUE;
      END IF;

      -- Resolve primary key columns of the target table
      SELECT string_agg(quote_ident(a.attname), ', ')
        INTO v_pk
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = format('public.%I', v_table)::regclass
        AND i.indisprimary;

      IF v_pk IS NULL OR v_pk = '' THEN
        -- No PK → fall back to plain insert ignoring conflicts
        v_sql := format(
          'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT DO NOTHING',
          v_table, v_cols, v_cols, v_table
        );
      ELSE
        -- Build SET clause for all snapshot columns except PK columns
        EXECUTE format($q$
          WITH src AS (
            SELECT jsonb_object_keys(($1->>0)::jsonb) AS k
          ),
          pk AS (
            SELECT a.attname AS k
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = format('public.%%I','%s')::regclass AND i.indisprimary
          ),
          cols AS (
            SELECT c.column_name
            FROM information_schema.columns c
            WHERE c.table_schema='public' AND c.table_name=%L
              AND c.column_name IN (SELECT k FROM src)
              AND c.column_name NOT IN (SELECT k FROM pk)
          )
          SELECT string_agg(format('%%I = EXCLUDED.%%I', column_name, column_name), ', ')
          FROM cols
        $q$, v_table, v_table) INTO v_update_set USING v_rows;

        IF v_update_set IS NULL OR v_update_set = '' THEN
          v_sql := format(
            'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT (%s) DO NOTHING',
            v_table, v_cols, v_cols, v_table, v_pk
          );
        ELSE
          v_sql := format(
            'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT (%s) DO UPDATE SET %s',
            v_table, v_cols, v_cols, v_table, v_pk, v_update_set
          );
        END IF;
      END IF;

      EXECUTE v_sql USING v_rows;
      GET DIAGNOSTICS v_restored_count = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(v_table || ': ' || SQLERRM);
    END;
  END LOOP;

  IF v_snap.entity_type = 'category' THEN
    UPDATE public.categories
       SET is_archived = false, archived_at = NULL, archived_by = NULL
     WHERE id = v_snap.entity_id;
  ELSIF v_snap.entity_type = 'club' THEN
    UPDATE public.clubs
       SET is_archived = false, archived_at = NULL, archived_by = NULL
     WHERE id = v_snap.entity_id;
    UPDATE public.categories
       SET is_archived = false, archived_at = NULL, archived_by = NULL
     WHERE club_id = v_snap.entity_id;
  END IF;

  PERFORM public.log_audit_event('restore_from_snapshot', v_snap.entity_type, v_snap.entity_id,
    jsonb_build_object('snapshot_id', _snapshot_id, 'version', v_snap.version, 'skipped', v_skipped, 'errors', v_errors));

  RETURN json_build_object(
    'success', true,
    'snapshot_id', _snapshot_id,
    'entity_type', v_snap.entity_type,
    'entity_id', v_snap.entity_id,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$function$;
