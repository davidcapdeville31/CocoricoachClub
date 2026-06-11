CREATE OR REPLACE FUNCTION public.transfer_player_with_history(_player_id uuid, _from_category_id uuid, _to_category_id uuid, _reason text DEFAULT NULL::text, _notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_player_user_id uuid;
  v_club_id uuid;
  v_from_club_id uuid;
  v_to_club_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT club_id INTO v_from_club_id FROM public.categories WHERE id = _from_category_id;
  SELECT club_id INTO v_to_club_id FROM public.categories WHERE id = _to_category_id;

  IF v_from_club_id IS NULL OR v_to_club_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Catégorie introuvable');
  END IF;

  IF v_from_club_id != v_to_club_id THEN
    RETURN json_build_object('success', false, 'error', 'Les deux catégories doivent appartenir au même club');
  END IF;

  v_club_id := v_from_club_id;

  IF NOT (public.can_modify_club_data(v_user_id, v_club_id) OR public.is_super_admin(v_user_id)) THEN
    RETURN json_build_object('success', false, 'error', 'Permissions insuffisantes');
  END IF;

  SELECT user_id INTO v_player_user_id FROM public.players WHERE id = _player_id;

  INSERT INTO public.player_transfers (player_id, from_category_id, to_category_id, reason, notes, transferred_by)
  VALUES (_player_id, _from_category_id, _to_category_id, _reason, _notes, v_user_id);

  UPDATE public.players SET category_id = _to_category_id WHERE id = _player_id;

  DELETE FROM public.player_categories
  WHERE player_id = _player_id AND category_id = _from_category_id;

  INSERT INTO public.player_categories (player_id, category_id, club_id, is_primary, status)
  VALUES (_player_id, _to_category_id, v_club_id, true, 'accepted')
  ON CONFLICT (player_id, category_id) DO UPDATE SET is_primary = true, status = 'accepted';

  IF v_player_user_id IS NOT NULL THEN
    DELETE FROM public.category_members
    WHERE category_id = _from_category_id AND user_id = v_player_user_id AND role = 'athlete';

    INSERT INTO public.category_members (category_id, user_id, role, invited_by)
    VALUES (_to_category_id, v_player_user_id, 'athlete', v_user_id)
    ON CONFLICT (category_id, user_id) DO NOTHING;
  END IF;

  UPDATE public.athlete_access_tokens
  SET is_active = false
  WHERE player_id = _player_id AND category_id = _from_category_id;

  INSERT INTO public.athlete_access_tokens (player_id, category_id, created_by, is_active)
  VALUES (_player_id, _to_category_id, v_user_id, true);

  UPDATE public.academic_absences SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.academic_grades SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.admin_documents SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.athlete_exercise_logs SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.awcr_tracking SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.body_composition SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.bowling_spare_training SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.gathering_wellness_assessments SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.generic_tests SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.gps_sessions SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.gym_session_exercises SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.hrv_records SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.illnesses SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.injuries SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.jump_tests SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.mobility_tests SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.player_availability_scores SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.player_evaluations SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.player_measurements SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.player_objectives SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.precision_training SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.recovery_journal SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.rugby_specific_tests SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.speed_tests SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.strength_tests SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.training_attendance SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;
  UPDATE public.wellness_tracking SET category_id = _to_category_id WHERE player_id = _player_id AND category_id = _from_category_id;

  RETURN json_build_object('success', true, 'player_id', _player_id, 'from_category_id', _from_category_id, 'to_category_id', _to_category_id);
END;
$function$;