ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.match_events REPLICA IDENTITY FULL;