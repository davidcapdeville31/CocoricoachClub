DO $$
DECLARE
  v_result json;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub','3c64ef46-aad0-4ada-8e32-7324c1561d93','role','authenticated')::text, true);
  SELECT public.restore_from_snapshot('52fab92b-627c-431e-bcf9-648c0084da87') INTO v_result;
  RAISE NOTICE 'Restore result: %', v_result;
END $$;