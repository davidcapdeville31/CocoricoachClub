
-- 1) Colonne avatar_url pour les conversations (avatar de groupe)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2) RPC: get_or_create_direct_conversation
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(
  _category_id uuid,
  _other_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _existing uuid;
  _new_id uuid;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _other_user_id = _me THEN
    RAISE EXCEPTION 'cannot dm yourself';
  END IF;

  -- Chercher une DM existante entre les deux users dans cette catégorie
  SELECT c.id INTO _existing
  FROM public.conversations c
  WHERE c.category_id = _category_id
    AND c.conversation_type = 'direct'
    AND EXISTS (SELECT 1 FROM public.conversation_participants p1
                WHERE p1.conversation_id = c.id AND p1.user_id = _me)
    AND EXISTS (SELECT 1 FROM public.conversation_participants p2
                WHERE p2.conversation_id = c.id AND p2.user_id = _other_user_id)
    AND (SELECT count(*) FROM public.conversation_participants p WHERE p.conversation_id = c.id) = 2
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  -- Créer la nouvelle conversation
  INSERT INTO public.conversations (category_id, name, conversation_type, created_by)
  VALUES (_category_id, NULL, 'direct', _me)
  RETURNING id INTO _new_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id, is_admin)
  VALUES
    (_new_id, _me, true),
    (_new_id, _other_user_id, false);

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid, uuid) TO authenticated;

-- 3) RPC: rename_conversation
CREATE OR REPLACE FUNCTION public.rename_conversation(
  _conversation_id uuid,
  _new_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _conv record;
  _is_staff boolean;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id, category_id, created_by, conversation_type
    INTO _conv
  FROM public.conversations
  WHERE id = _conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation not found';
  END IF;

  IF _conv.conversation_type = 'direct' THEN
    RAISE EXCEPTION 'direct conversations cannot be renamed';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.category_members cm
    WHERE cm.category_id = _conv.category_id
      AND cm.user_id = _me
      AND cm.role IN ('admin', 'coach')
  ) INTO _is_staff;

  IF _conv.created_by <> _me AND NOT _is_staff THEN
    RAISE EXCEPTION 'not authorized to rename this conversation';
  END IF;

  UPDATE public.conversations
     SET name = NULLIF(btrim(_new_name), ''),
         updated_at = now()
   WHERE id = _conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_conversation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_conversation(uuid, text) TO authenticated;
