CREATE OR REPLACE FUNCTION public.notify_staff_athlete_test_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_name text;
  v_actor_user_id uuid;
  v_targets uuid[];
  v_user_id uuid;
  v_test_label text;
  v_uuid uuid;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.first_name,''),' ',COALESCE(p.name,''))),''), p.name, 'Athlète'), p.user_id
  INTO v_player_name, v_actor_user_id
  FROM public.players p WHERE p.id = NEW.player_id;

  v_test_label := COALESCE(NEW.test_type, 'test');
  IF NEW.test_type ~* '^custom:' THEN
    BEGIN
      v_uuid := substring(NEW.test_type from 8)::uuid;
    EXCEPTION WHEN others THEN
      v_uuid := NULL;
    END;
    IF v_uuid IS NOT NULL THEN
      SELECT ct.name INTO v_test_label FROM public.custom_tests ct WHERE ct.id = v_uuid;
    ELSE
      v_test_label := NULL;
    END IF;
    v_test_label := COALESCE(v_test_label, 'Test personnalisé');
  ELSIF NEW.test_type ~* '^custom_' THEN
    SELECT ct.name INTO v_test_label
    FROM public.custom_tests ct
    WHERE lower(regexp_replace(ct.name, '[\s_\-.]+', '', 'g')) = lower(regexp_replace(substring(NEW.test_type from 8), '[\s_\-.]+', '', 'g'))
    LIMIT 1;
    IF v_test_label IS NULL THEN
      v_test_label := initcap(replace(substring(NEW.test_type from 8), '_', ' '));
    END IF;
  END IF;

  v_targets := public.category_staff_user_ids(NEW.category_id);
  IF v_targets IS NULL OR array_length(v_targets,1) IS NULL THEN RETURN NEW; END IF;

  FOREACH v_user_id IN ARRAY v_targets LOOP
    IF v_actor_user_id IS NULL OR v_user_id <> v_actor_user_id THEN
      INSERT INTO public.notifications (user_id, category_id, notification_type, notification_subtype, title, message, is_read, priority, metadata)
      VALUES (
        v_user_id, NEW.category_id, 'test_result_submitted', NEW.test_category,
        'Résultat de test à valider',
        format('%s a enregistré un résultat (%s%s) le %s.', v_player_name, v_test_label,
               CASE WHEN NEW.result_value IS NOT NULL THEN ' : ' || NEW.result_value::text || COALESCE(' ' || NEW.result_unit,'') ELSE '' END,
               to_char(NEW.test_date,'DD/MM/YYYY')),
        false, 'normal',
        jsonb_build_object('player_id', NEW.player_id, 'pending_test_id', NEW.id, 'test_type', NEW.test_type, 'test_date', NEW.test_date)
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;