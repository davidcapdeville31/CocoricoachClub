
-- Trigger to auto-link a new club to its client based on the owner's email
CREATE OR REPLACE FUNCTION public.auto_link_club_to_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_email text;
  v_client_id uuid;
BEGIN
  -- Only run if client_id is not already set
  IF NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get the owner's email from profiles
  SELECT email INTO v_owner_email
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF v_owner_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find a client with matching email
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE email = v_owner_email
  LIMIT 1;

  IF v_client_id IS NOT NULL THEN
    NEW.client_id := v_client_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_link_club_client
BEFORE INSERT ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_club_to_client();
