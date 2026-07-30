
CREATE OR REPLACE FUNCTION public.trg_notify_document_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_msg text;
  r RECORD;
BEGIN
  v_title := '📄 Nouveau document ajouté';

  IF NEW.player_id IS NOT NULL THEN
    v_msg := COALESCE(NEW.title, 'Un document') || ' a été ajouté à ton espace documents.';
    PERFORM public.notify_athlete_data_added(
      NEW.player_id, NEW.category_id, 'athlete_document',
      v_title, v_msg,
      jsonb_build_object('document_id', NEW.id, 'scope', 'personal')
    );
  ELSE
    v_msg := COALESCE(NEW.title, 'Un document') || ' a été ajouté aux documents de l''équipe.';
    FOR r IN
      SELECT id FROM public.players
      WHERE category_id = NEW.category_id AND user_id IS NOT NULL
    LOOP
      PERFORM public.notify_athlete_data_added(
        r.id, NEW.category_id, 'athlete_document',
        v_title, v_msg,
        jsonb_build_object('document_id', NEW.id, 'scope', 'team')
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_document_added ON public.admin_documents;
CREATE TRIGGER notify_document_added
AFTER INSERT ON public.admin_documents
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_document_added();
