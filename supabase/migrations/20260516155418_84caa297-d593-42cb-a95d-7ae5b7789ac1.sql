ALTER TABLE public.opponent_profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.opponent_profiles;