-- Link existing auth users to their pending athlete invitations
DO $$
DECLARE
  inv RECORD;
  v_user_id uuid;
BEGIN
  FOR inv IN
    SELECT * FROM public.athlete_invitations
    WHERE status = 'pending'
      AND email IN ('arthurangevin82@gmail.com','mattdsp9@gmail.com','timtimduj@gmail.com')
      AND category_id = '0e6a72e9-8475-489f-a09c-55d83b01bca4'
  LOOP
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(inv.email) LIMIT 1;
    IF v_user_id IS NOT NULL THEN
      PERFORM public.accept_athlete_invitation_signup(inv.token::text, v_user_id);
    END IF;
  END LOOP;
END $$;