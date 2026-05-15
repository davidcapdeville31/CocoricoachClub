
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, c.relname AS table_name, con.conname, a.attname AS col
    FROM pg_constraint con
    JOIN pg_class c ON c.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=ANY(con.conkey)
    WHERE confrelid='auth.users'::regclass AND con.contype='f' AND con.confdeltype='a' AND n.nspname='public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP NOT NULL', r.schema, r.table_name, r.col);
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.schema, r.table_name, r.conname);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL', r.schema, r.table_name, r.conname, r.col);
  END LOOP;
END $$;
