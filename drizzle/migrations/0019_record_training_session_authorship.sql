ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS author_user_id uuid, ADD COLUMN IF NOT EXISTS author_name text;
COMMENT ON COLUMN public.training_sessions.author_user_id IS 'Actual authenticated creator; independent of assigned athlete. Historical unknown creators remain NULL.';
CREATE OR REPLACE FUNCTION public.stamp_training_session_author() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE creator uuid; display_name text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.author_user_id := OLD.author_user_id;
    NEW.author_name := OLD.author_name;
    RETURN NEW;
  END IF;
  IF auth.role() = 'authenticated' THEN
    creator := auth.uid();
  ELSIF auth.role() = 'service_role' THEN
    creator := NEW.author_user_id;
  ELSE
    creator := NULL;
  END IF;
  NEW.author_user_id := creator;
  NEW.author_name := NULL;
  IF creator IS NOT NULL THEN
    SELECT NULLIF(trim(p.full_name), '') INTO display_name FROM public.profiles p WHERE p.id = creator;
    NEW.author_name := display_name;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER stamp_training_session_author BEFORE INSERT OR UPDATE ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION public.stamp_training_session_author();
CREATE OR REPLACE FUNCTION public.get_training_session_authors(session_ids uuid[]) RETURNS TABLE(session_id uuid, author_user_id uuid, author_name text) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 SELECT s.id, s.author_user_id, s.author_name FROM public.training_sessions s WHERE s.id = ANY(session_ids)
$$;
REVOKE ALL ON FUNCTION public.get_training_session_authors(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_training_session_authors(uuid[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.stamp_training_session_author() FROM PUBLIC;