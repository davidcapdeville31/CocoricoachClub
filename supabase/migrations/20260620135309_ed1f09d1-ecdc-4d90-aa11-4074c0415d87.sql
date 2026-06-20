-- Audit log trigger for sensitive deletions.
-- Writes one row in public.audit_logs whenever a row is deleted from one of
-- the critical tables, capturing WHO did it, WHEN, and a JSON snapshot of
-- the row so we can at least know what was lost (and recreate manually if needed).

CREATE OR REPLACE FUNCTION public.log_sensitive_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_entity_id uuid;
BEGIN
  -- Try to read OLD.id (all targeted tables have a uuid id column)
  BEGIN
    v_entity_id := (to_jsonb(OLD)->>'id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_entity_id := NULL;
  END;

  -- audit_logs.user_id is NOT NULL — skip logging when there is no auth context
  -- (e.g. cascade delete from a server-side migration). In that case the DB
  -- log will still show the statement.
  IF v_user IS NULL THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    v_user,
    'delete',
    TG_TABLE_NAME,
    v_entity_id,
    jsonb_build_object(
      'snapshot', to_jsonb(OLD),
      'deleted_at', now()
    )
  );

  RETURN OLD;
END;
$$;

-- Allow the function (running as definer) to insert into audit_logs even
-- though the table's INSERT policy requires auth.uid() = user_id; SECURITY
-- DEFINER + explicit user_id = auth.uid() above satisfies that.

-- Attach the trigger to the sensitive tables.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'categories',
    'clubs',
    'players',
    'seasons',
    'training_sessions',
    'matches',
    'training_programs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_audit_delete_%I ON public.%I',
      t, t
    );
    EXECUTE format(
      'CREATE TRIGGER trg_audit_delete_%I
         AFTER DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_delete()',
      t, t
    );
  END LOOP;
END $$;