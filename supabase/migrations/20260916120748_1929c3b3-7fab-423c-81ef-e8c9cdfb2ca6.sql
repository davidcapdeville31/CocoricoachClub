CREATE OR REPLACE FUNCTION public.save_program_v2(p_program_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_week jsonb;
  v_session jsonb;
  v_ex jsonb;
  v_week_id uuid;
  v_session_id uuid;
BEGIN
  UPDATE public.training_programs
     SET name = p_payload->>'name',
         description = NULLIF(p_payload->>'description',''),
         level = p_payload->>'level',
         theme_id = NULLIF(p_payload->>'theme_id','')::uuid
   WHERE id = p_program_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Programme introuvable ou non modifiable';
  END IF;

  DELETE FROM public.program_weeks WHERE program_id = p_program_id;

  FOR v_week IN SELECT * FROM jsonb_array_elements(p_payload->'weeks')
  LOOP
    INSERT INTO public.program_weeks (program_id, week_number, name, block_order)
    VALUES (p_program_id,
            (v_week->>'week_number')::int,
            v_week->>'name',
            (v_week->>'block_order')::int)
    RETURNING id INTO v_week_id;

    FOR v_session IN SELECT * FROM jsonb_array_elements(COALESCE(v_week->'sessions','[]'::jsonb))
    LOOP
      INSERT INTO public.program_sessions (week_id, session_number, name, scheduled_day, start_time, end_time)
      VALUES (v_week_id,
              (v_session->>'session_number')::int,
              v_session->>'name',
              NULLIF(v_session->>'scheduled_day','')::int,
              NULLIF(v_session->>'start_time','')::time,
              NULLIF(v_session->>'end_time','')::time)
      RETURNING id INTO v_session_id;

      FOR v_ex IN SELECT * FROM jsonb_array_elements(COALESCE(v_session->'exercises','[]'::jsonb))
      LOOP
        INSERT INTO public.program_exercises (
          session_id, library_exercise_id, exercise_name, order_index, method,
          sets, reps, percentage_1rm, tempo, rest_seconds, notes, cluster_sets, drop_sets
        ) VALUES (
          v_session_id,
          NULLIF(v_ex->>'library_exercise_id','')::uuid,
          v_ex->>'exercise_name',
          (v_ex->>'order_index')::int,
          COALESCE(v_ex->>'method','normal'),
          COALESCE((v_ex->>'sets')::int, 3),
          COALESCE(v_ex->>'reps','10'),
          NULLIF(v_ex->>'percentage_1rm','')::numeric,
          NULLIF(v_ex->>'tempo',''),
          COALESCE((v_ex->>'rest_seconds')::int, 90),
          COALESCE(v_ex->>'notes',''),
          v_ex->'cluster_sets',
          v_ex->'drop_sets'
        );
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN p_program_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_program_v2(uuid, jsonb) TO authenticated;