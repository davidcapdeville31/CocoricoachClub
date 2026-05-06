
-- Patch snapshot_club_full to accept service-role calls (no auth.uid())
CREATE OR REPLACE FUNCTION public.snapshot_club_full(_club_id uuid, _notes text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_is_service boolean := (auth.role() = 'service_role');
  v_snapshot jsonb;
  v_snapshot_id uuid;
  v_name text;
  v_version integer;
  v_is_owner boolean;
  v_is_admin boolean;
  v_table TEXT;
  v_data JSONB;
  v_tables TEXT[] := ARRAY[
    'categories','players','player_categories','category_members','category_photos','category_invitations','category_stat_preferences',
    'training_sessions','training_programs','training_periods','training_cycles','training_attendance',
    'matches','match_sheets','tournaments','convocations','team_trips',
    'wellness_tracking','awcr_tracking','smart_alerts',
    'medical_records','injuries','concussion_protocols','injury_protocols',
    'gps_sessions','gps_session_objectives','gps_objective_templates','position_benchmarks',
    'jump_tests','speed_tests','strength_tests','mobility_tests','rugby_specific_tests','generic_tests',
    'test_batteries','test_reminders','custom_test_categories','pending_test_results',
    'kicking_attempts','precision_training',
    'video_analyses','video_clips',
    'weekly_planning','session_templates',
    'benchmarks','custom_athletic_profiles','custom_stats',
    'mental_assessments','mental_goals','mental_prep_sessions',
    'recovery_journal','hrv_records','body_composition','nutrition_entries','menstrual_cycles',
    'player_caps','player_evaluations','player_measurements','player_medals','player_objectives','player_selections',
    'player_availability_scores','player_tags','player_contacts',
    'admin_documents','recruitment_prospects','equipment_inventory','facilities','facility_bookings',
    'staff_notes','notifications','conversations','polls',
    'athlete_invitations','athlete_access_tokens','public_access_tokens',
    'periodization_cycles',
    'season_closures','season_goals','season_milestones',
    'pdf_settings','athlete_attributes','clubs'
  ];
BEGIN
  IF v_user IS NULL AND NOT v_is_service THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT name INTO v_name FROM public.clubs WHERE id = _club_id;
  IF v_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Club introuvable');
  END IF;

  IF NOT v_is_service THEN
    SELECT (user_id = v_user) INTO v_is_owner FROM public.clubs WHERE id = _club_id;
    SELECT EXISTS(
      SELECT 1 FROM public.club_members
      WHERE club_id = _club_id AND user_id = v_user AND role IN ('admin','owner')
    ) INTO v_is_admin;
    IF NOT (v_is_owner OR v_is_admin OR public.is_super_admin(v_user)) THEN
      RETURN json_build_object('success', false, 'error', 'Permissions insuffisantes');
    END IF;
  END IF;

  v_snapshot := jsonb_build_object(
    'club', (SELECT to_jsonb(c) FROM public.clubs c WHERE c.id = _club_id),
    'snapshot_taken_at', now()
  );

  FOREACH v_table IN ARRAY v_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=v_table)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=v_table AND column_name='club_id') THEN
      EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM public.%I t WHERE t.club_id = $1', v_table)
        INTO v_data USING _club_id;
      v_snapshot := v_snapshot || jsonb_build_object(v_table, v_data);
    END IF;
  END LOOP;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM public.archived_snapshots
  WHERE entity_type = 'club' AND entity_id = _club_id;

  INSERT INTO public.archived_snapshots (entity_type, entity_id, club_id, entity_name, snapshot, version, notes, created_by)
  VALUES ('club', _club_id, _club_id, v_name, v_snapshot, v_version, _notes, COALESCE(v_user, '00000000-0000-0000-0000-000000000000'::uuid))
  RETURNING id INTO v_snapshot_id;

  IF v_user IS NOT NULL THEN
    PERFORM public.log_audit_event('snapshot_club_full', 'club', _club_id,
      jsonb_build_object('snapshot_id', v_snapshot_id, 'version', v_version));
  END IF;

  RETURN json_build_object('success', true, 'snapshot_id', v_snapshot_id, 'version', v_version);
END;
$$;

-- Patch snapshot_category_full similarly
CREATE OR REPLACE FUNCTION public.snapshot_category_full(_category_id uuid, _notes text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_is_service boolean := (auth.role() = 'service_role');
  v_snapshot JSONB := '{}'::jsonb;
  v_snapshot_id UUID;
  v_name TEXT;
  v_club_id UUID;
  v_version INTEGER;
  v_player_ids UUID[];
  v_table TEXT;
  v_data JSONB;
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
  v_player_tables TEXT[] := ARRAY[
    'player_match_stats','match_lineups','match_sheet_players','event_participants',
    'competition_rounds','tournament_player_rotation','clip_player_associations',
    'player_exercise_completions','player_transfers',
    'bowling_oil_pattern_players','padel_session_equipment','ski_session_equipment','surf_session_equipment','program_assignments'
  ];
BEGIN
  IF v_user IS NULL AND NOT v_is_service THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT name, club_id INTO v_name, v_club_id FROM public.categories WHERE id = _category_id;
  IF v_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Catégorie introuvable');
  END IF;

  IF NOT v_is_service THEN
    IF NOT (public.is_super_admin(v_user) OR public.can_modify_club_data(v_user, v_club_id)) THEN
      RETURN json_build_object('success', false, 'error', 'Permissions insuffisantes');
    END IF;
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_player_ids
  FROM public.players WHERE category_id = _category_id;

  v_snapshot := jsonb_build_object(
    'category', (SELECT to_jsonb(c) FROM public.categories c WHERE c.id = _category_id),
    'snapshot_taken_at', now(),
    'player_ids', to_jsonb(v_player_ids)
  );

  FOREACH v_table IN ARRAY v_cat_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=v_table)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=v_table AND column_name='category_id') THEN
      EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM public.%I t WHERE t.category_id = $1', v_table)
        INTO v_data USING _category_id;
      v_snapshot := v_snapshot || jsonb_build_object(v_table, v_data);
    END IF;
  END LOOP;

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

  v_snapshot := v_snapshot || jsonb_build_object(
    'players_count', COALESCE(array_length(v_player_ids, 1), 0)
  );

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM public.archived_snapshots
  WHERE entity_type = 'category' AND entity_id = _category_id;

  INSERT INTO public.archived_snapshots (entity_type, entity_id, club_id, entity_name, snapshot, version, notes, created_by)
  VALUES ('category', _category_id, v_club_id, v_name, v_snapshot, v_version, _notes, COALESCE(v_user, '00000000-0000-0000-0000-000000000000'::uuid))
  RETURNING id INTO v_snapshot_id;

  IF v_user IS NOT NULL THEN
    PERFORM public.log_audit_event('snapshot_category', 'category', _category_id,
      jsonb_build_object('snapshot_id', v_snapshot_id, 'version', v_version));
  END IF;

  RETURN json_build_object('success', true, 'snapshot_id', v_snapshot_id, 'version', v_version, 'players_count', COALESCE(array_length(v_player_ids, 1), 0));
END;
$$;
