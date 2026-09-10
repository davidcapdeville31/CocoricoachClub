WITH prog_sess AS (
  SELECT tp.id AS program_id, tp.category_id, tp.name AS program_name, ps.id AS ps_id, ps.name AS ps_name,
         ROW_NUMBER() OVER (PARTITION BY tp.id ORDER BY pw.week_number, ps.session_number) AS rn
  FROM training_programs tp
  JOIN program_weeks pw ON pw.program_id = tp.id
  JOIN program_sessions ps ON ps.week_id = pw.id
),
train_sess AS (
  SELECT tp.id AS program_id, ts.id AS ts_id, ts.category_id,
         ROW_NUMBER() OVER (PARTITION BY tp.id ORDER BY ts.session_date, ts.created_at) AS rn
  FROM training_programs tp
  JOIN training_sessions ts ON ts.category_id = tp.category_id
   AND ts.notes LIKE 'Programme: ' || tp.name || ' - %'
),
matched AS (
  SELECT p.program_id, p.ps_id, t.ts_id, t.category_id
  FROM prog_sess p JOIN train_sess t ON t.program_id = p.program_id AND t.rn = p.rn
),
targets AS (
  SELECT DISTINCT m.ps_id, m.ts_id, m.category_id, pa.player_id
  FROM matched m
  JOIN program_assignments pa ON pa.program_id = m.program_id AND pa.is_active
),
ins_participants AS (
  INSERT INTO public.event_participants (training_session_id, player_id)
  SELECT DISTINCT t.ts_id, t.player_id FROM targets t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_participants ep
    WHERE ep.training_session_id = t.ts_id AND ep.player_id = t.player_id
  )
  RETURNING 1
)
INSERT INTO public.gym_session_exercises (
  training_session_id, player_id, category_id, exercise_name, exercise_category,
  library_exercise_id, sets, reps, percentage_1rm, tempo, rest_seconds, method,
  method_config, drop_sets, cluster_sets, target_force_newton, group_id, group_order,
  notes, order_index
)
SELECT t.ts_id, t.player_id, t.category_id, e.exercise_name, e.exercise_category,
       e.library_exercise_id, COALESCE(e.sets, 0),
       NULLIF(regexp_replace(COALESCE(e.reps, ''), '\D', '', 'g'), '')::int,
       e.percentage_1rm, e.tempo, e.rest_seconds, e.method, e.method_config,
       e.drop_sets, e.cluster_sets, e.target_force_newton,
       CASE WHEN e.group_id IS NULL THEN NULL ELSE e.group_id::text END,
       e.group_order, e.notes, e.order_index
FROM targets t
JOIN public.program_exercises e ON e.session_id = t.ps_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.gym_session_exercises g
  WHERE g.training_session_id = t.ts_id AND g.player_id = t.player_id
);