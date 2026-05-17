ALTER TABLE public.club_members REPLICA IDENTITY FULL;
ALTER TABLE public.category_members REPLICA IDENTITY FULL;
ALTER TABLE public.club_invitations REPLICA IDENTITY FULL;
ALTER TABLE public.category_invitations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.category_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.category_invitations;