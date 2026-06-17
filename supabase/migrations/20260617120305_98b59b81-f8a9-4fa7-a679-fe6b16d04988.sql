
DO $$
DECLARE
  pol RECORD;
  new_qual TEXT;
  new_check TEXT;
  sql_stmt TEXT;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check, roles, permissive
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd IN ('INSERT','UPDATE','DELETE')
      AND tablename IN (
        'athletics_sprint_attempts','athletics_throwing_attempts',
        'coach_exercise_overrides','exercise_favorites','exercise_library',
        'gym_session_exercises','illnesses','injuries','injury_library',
        'player_coaches','player_evaluations','players','program_themes',
        'training_programs','training_session_blocks'
      )
      AND (COALESCE(qual::text,'')||COALESCE(with_check::text,'')) LIKE '%''coach''::app_role%'
      AND (COALESCE(qual::text,'')||COALESCE(with_check::text,'')) NOT LIKE '%''administratif''::app_role%'
  LOOP
    new_qual  := pol.qual;
    new_check := pol.with_check;

    -- Add 'administratif' wherever 'coach' appears inside ARRAY[...] role lists
    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(
        new_qual,
        '(ARRAY\[[^\]]*''coach''::app_role[^\]]*)\]',
        '\1, ''administratif''::app_role]',
        'g'
      );
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(
        new_check,
        '(ARRAY\[[^\]]*''coach''::app_role[^\]]*)\]',
        '\1, ''administratif''::app_role]',
        'g'
      );
    END IF;

    -- Drop and recreate the policy with the augmented expressions
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);

    sql_stmt := format(
      'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
      pol.policyname,
      pol.tablename,
      CASE WHEN pol.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      pol.cmd,
      array_to_string(pol.roles, ', ')
    );

    IF new_qual IS NOT NULL THEN
      sql_stmt := sql_stmt || ' USING (' || new_qual || ')';
    END IF;
    IF new_check IS NOT NULL THEN
      sql_stmt := sql_stmt || ' WITH CHECK (' || new_check || ')';
    END IF;

    RAISE NOTICE 'Updating policy % on %', pol.policyname, pol.tablename;
    EXECUTE sql_stmt;
  END LOOP;
END $$;
