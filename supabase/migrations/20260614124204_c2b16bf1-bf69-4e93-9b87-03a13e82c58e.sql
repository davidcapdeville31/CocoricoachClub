
DO $$
DECLARE
  pol RECORD;
  new_qual TEXT;
  cmd_kw TEXT;
  policy_sql TEXT;
BEGIN
  FOR pol IN
    SELECT p.polname,
           c.oid AS relid,
           (n.nspname || '.' || c.relname) AS fqtn,
           p.polcmd,
           pg_get_expr(p.polqual, c.oid) AS qual
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pg_get_expr(p.polqual, c.oid) ILIKE '%''coach''::app_role%'
      AND pg_get_expr(p.polqual, c.oid) NOT ILIKE '%''administratif''::app_role%'
      AND n.nspname = 'public'
  LOOP
    new_qual := replace(pol.qual, '''coach''::app_role', '''coach''::app_role, ''administratif''::app_role');

    cmd_kw := CASE pol.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
    END;

    EXECUTE format('DROP POLICY %I ON %s', pol.polname, pol.fqtn);

    IF pol.polcmd IN ('w', '*') THEN
      policy_sql := format(
        'CREATE POLICY %I ON %s FOR %s TO authenticated USING (%s) WITH CHECK (%s)',
        pol.polname, pol.fqtn, cmd_kw, new_qual, new_qual
      );
    ELSE
      policy_sql := format(
        'CREATE POLICY %I ON %s FOR %s TO authenticated USING (%s)',
        pol.polname, pol.fqtn, cmd_kw, new_qual
      );
    END IF;

    EXECUTE policy_sql;
  END LOOP;
END $$;
