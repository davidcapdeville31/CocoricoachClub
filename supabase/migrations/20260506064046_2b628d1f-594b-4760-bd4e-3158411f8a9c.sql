
-- Fix list functions type mismatch (varchar vs text)
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
  SELECT 'club'::text, c.id, c.name::text, c.id, c.name::text,
    c.archived_at, c.archived_by,
    (SELECT u.email::text FROM auth.users u WHERE u.id = c.archived_by),
    (SELECT COUNT(*)::int FROM public.archived_snapshots s WHERE s.entity_type='club' AND s.entity_id=c.id),
    (SELECT s.id FROM public.archived_snapshots s WHERE s.entity_type='club' AND s.entity_id=c.id ORDER BY s.created_at DESC LIMIT 1)
  FROM public.clubs c
  WHERE c.is_archived = true
  UNION ALL
  SELECT 'category'::text, cat.id, cat.name::text, cat.club_id, cl.name::text,
    cat.archived_at, cat.archived_by,
    (SELECT u.email::text FROM auth.users u WHERE u.id = cat.archived_by),
    (SELECT COUNT(*)::int FROM public.archived_snapshots s WHERE s.entity_type='category' AND s.entity_id=cat.id),
    (SELECT s.id FROM public.archived_snapshots s WHERE s.entity_type='category' AND s.entity_id=cat.id ORDER BY s.created_at DESC LIMIT 1)
  FROM public.categories cat
  LEFT JOIN public.clubs cl ON cl.id = cat.club_id
  WHERE cat.is_archived = true AND (cl.is_archived = false OR cl.is_archived IS NULL)
  ORDER BY archived_at DESC NULLS LAST;
END;
$function$;

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
  SELECT s.id, s.entity_type::text, s.entity_id, s.entity_name::text, s.club_id, cl.name::text,
    s.version, s.notes::text, s.created_at, s.created_by,
    (SELECT u.email::text FROM auth.users u WHERE u.id = s.created_by),
    COALESCE(
      CASE WHEN s.entity_type='club' THEN (SELECT cl2.is_archived FROM public.clubs cl2 WHERE cl2.id = s.entity_id)
           WHEN s.entity_type='category' THEN (SELECT cat.is_archived FROM public.categories cat WHERE cat.id = s.entity_id)
      END, false)
  FROM public.archived_snapshots s
  LEFT JOIN public.clubs cl ON cl.id = s.club_id
  ORDER BY s.created_at DESC;
END;
$function$;

-- Comprehensive category snapshot: captures ALL data linked to category & players
CREATE OR REPLACE FUNCTION public.archive_category(_category_id uuid, _notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_snapshot JSONB := '{}'::jsonb;
  v_snapshot_id UUID;
  v_name TEXT;
  v_club_id UUID;
  v_version INTEGER;
  v_player_ids UUID[];
  v_table TEXT;
  v_data JSONB;
  -- Tables qui contiennent category_id
  v_cat_tables TEXT[] := ARRAY[
    'players','player_categories','category_members','category_photos','category_invitations','category_stat_preferences',
    'training_sessions','training_programs','training_periods','training_cycles','training_attendance',
    'matches','match_sheets','tournaments','convocations','team_trips',
    'wellness_tracking','gathering_wellness_assessments','awcr_tracking','smart_alerts',
    'medical_records','injuries','concussion_protocols','injury_protocols','encrypted_medical_fields',
    'gps_sessions','gps_session_objectives','gps_objective_templates','position_benchmarks',
    'jump_tests','speed_tests','strength_tests','mobility_tests','rugby_specific_tests','generic_tests',
    'test_batteries','test_reminders','test_theme_categories','custom_test_categories','pending_test_results',
    'kicking_attempts','precision_training','precision_exercise_types',
    'video_analyses','video_clips','custom_video_action_types',
    'weekly_planning','session_templates','session_block_athlete_rpe',
    'benchmarks','custom_athletic_profiles','custom_stats','custom_training_types',
    'mental_assessments','mental_goals','mental_prep_sessions',
    'recovery_journal','hrv_records','body_composition','nutrition_entries','menstrual_cycles','menstrual_symptoms',
    'player_caps','player_evaluations','player_measurements','player_medals','player_objectives','player_selections',
    'player_development_plans','player_availability_scores','player_performance_references','player_tags','player_contacts','player_coaches',
    'player_academic_profiles','player_academic_tracking','academic_grades','academic_absences',
    'admin_documents','recruitment_prospects','equipment_inventory','facilities','facility_bookings',
    'staff_notes','notifications','notification_preferences','conversations','polls','convocation_recipients',
    'athlete_invitations','athlete_access_tokens','safe_category_invitations','public_access_tokens',
    'periodization_categories','periodization_cycles','periodization_saved_colors',
    'season_closures','season_goals','season_milestones',
    'fis_calendar_events','fis_calendar_feeds','fis_competitions','fis_objectives','fis_results','fis_ranking_settings','fis_points_reference',
    'athletics_minimas','athletics_records','athletics_sprint_attempts','athletics_throwing_attempts',
    'bowling_oil_patterns','bowling_spare_training','player_bowling_arsenal',
    'tennis_drill_training','player_padel_equipment','player_ski_equipment','player_surf_equipment',
    'ski_conditions','surf_conditions','national_team_events','national_team_event_types',
    'prophylaxis_programs','prophylaxis_assignments','rehab_calendar_events','player_rehab_protocols','return_to_play_protocols','injury_library',
    'pdf_settings','athlete_exercise_logs','athlete_attributes'
  ];
  -- Tables qui ont player_id (à filtrer via les joueurs de la catégorie)
  v_player_tables TEXT[] := ARRAY[
    'player_match_stats','match_lineups','match_sheet_players','event_participants',
    'competition_rounds','tournament_player_rotation','clip_player_associations',
    'player_exercise_completions','player_transfers',
    'bowling_oil_pattern_players','padel_session_equipment','ski_session_equipment','surf_session_equipment','program_assignments'
  ];
BEGIN
  IF v_user IS NULL OR NOT public.is_super_admin(v_user) THEN
    RETURN json_build_object('success', false, 'error', 'Permissions insuffisantes');
  END IF;

  SELECT name, club_id INTO v_name, v_club_id FROM public.categories WHERE id = _category_id;
  IF v_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Catégorie introuvable');
  END IF;

  -- Récupère les IDs des joueurs de la catégorie
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_player_ids
  FROM public.players WHERE category_id = _category_id;

  v_snapshot := jsonb_build_object(
    'category', (SELECT to_jsonb(c) FROM public.categories c WHERE c.id = _category_id),
    'archived_at', now(),
    'player_ids', to_jsonb(v_player_ids)
  );

  -- Boucle sur tables avec category_id
  FOREACH v_table IN ARRAY v_cat_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=v_table)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=v_table AND column_name='category_id') THEN
      EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM public.%I t WHERE t.category_id = $1', v_table)
        INTO v_data USING _category_id;
      v_snapshot := v_snapshot || jsonb_build_object(v_table, v_data);
    END IF;
  END LOOP;

  -- Boucle sur tables avec player_id (uniquement si la catégorie a des joueurs)
  IF array_length(v_player_ids, 1) > 0 THEN
    FOREACH v_table IN ARRAY v_player_tables LOOP
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=v_table)
         AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=v_table AND column_name='player_id') THEN
        EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM public.%I t WHERE t.player_id = ANY($1)', v_table)
          INTO v_data USING v_player_ids;
        v_snapshot := v_snapshot || jsonb_build_object('by_player__' || v_table, v_data);
      END IF;
    END LOOP;
  END IF;

  -- Compteur résumé
  v_snapshot := v_snapshot || jsonb_build_object(
    'players_count', COALESCE(array_length(v_player_ids, 1), 0),
    'tables_captured', (SELECT COUNT(*) FROM jsonb_object_keys(v_snapshot))
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

  RETURN json_build_object('success', true, 'snapshot_id', v_snapshot_id, 'version', v_version, 'players_count', COALESCE(array_length(v_player_ids, 1), 0));
END;
$function$;
