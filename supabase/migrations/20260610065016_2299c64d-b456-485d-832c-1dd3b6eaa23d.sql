DO $$
DECLARE
  v_user_id uuid;
  v_invite RECORD;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'precisonsbowling@hotmail.com' LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No auth user found';
    RETURN;
  END IF;

  SELECT * INTO v_invite
  FROM public.club_invitations
  WHERE lower(email) = 'precisonsbowling@hotmail.com'
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RAISE NOTICE 'No pending invitation found';
    RETURN;
  END IF;

  INSERT INTO public.club_members (club_id, user_id, role, assigned_categories)
  VALUES (v_invite.club_id, v_user_id, v_invite.role, v_invite.assigned_categories::uuid[])
  ON CONFLICT (club_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        assigned_categories = EXCLUDED.assigned_categories;

  INSERT INTO public.approved_users (user_id, approved_by, approved_at)
  VALUES (v_user_id, v_invite.invited_by, now())
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.club_invitations
  SET status = 'accepted'
  WHERE id = v_invite.id;
END $$;