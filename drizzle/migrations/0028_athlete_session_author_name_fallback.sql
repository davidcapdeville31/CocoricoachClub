CREATE OR REPLACE FUNCTION public.stamp_training_session_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  END IF;
  -- Athlete-created sessions: fall back to the creator's player identity so teammates see the author.
  IF display_name IS NULL AND NEW.created_by_player_id IS NOT NULL THEN
    SELECT NULLIF(trim(concat_ws(' ', pl.first_name, pl.name)), '') INTO display_name
    FROM public.players pl WHERE pl.id = NEW.created_by_player_id;
  END IF;
  NEW.author_name := display_name;
  RETURN NEW;
END;
$$;

ALTER TABLE public.training_sessions DISABLE TRIGGER stamp_training_session_author;
UPDATE public.training_sessions s
SET author_name = NULLIF(trim(concat_ws(' ', pl.first_name, pl.name)), '')
FROM public.players pl
WHERE pl.id = s.created_by_player_id
  AND s.author_name IS NULL
  AND s.created_by_player_id IS NOT NULL;
ALTER TABLE public.training_sessions ENABLE TRIGGER stamp_training_session_author;