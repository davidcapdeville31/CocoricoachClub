CREATE TABLE public.opponent_scouting_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent_id uuid NOT NULL REFERENCES public.opponent_profiles(id) ON DELETE CASCADE,
  club_id uuid NOT NULL,
  author_id uuid,
  author_name text,
  event_date date,
  event_name text,
  comment text NOT NULL,
  video_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opponent_scouting_comments TO authenticated;
GRANT ALL ON public.opponent_scouting_comments TO service_role;

ALTER TABLE public.opponent_scouting_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members and athletes can view opponent comments"
ON public.opponent_scouting_comments FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM clubs cl WHERE cl.id = opponent_scouting_comments.club_id
    AND (cl.user_id = auth.uid() OR EXISTS (SELECT 1 FROM club_members cm WHERE cm.club_id = cl.id AND cm.user_id = auth.uid())))
  OR EXISTS (SELECT 1 FROM players p JOIN categories c ON c.id = p.category_id
    WHERE p.user_id = auth.uid() AND c.club_id = opponent_scouting_comments.club_id)
);

CREATE POLICY "Club members and athletes can add opponent comments"
ON public.opponent_scouting_comments FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM clubs cl WHERE cl.id = opponent_scouting_comments.club_id
      AND (cl.user_id = auth.uid() OR EXISTS (SELECT 1 FROM club_members cm WHERE cm.club_id = cl.id AND cm.user_id = auth.uid())))
    OR EXISTS (SELECT 1 FROM players p JOIN categories c ON c.id = p.category_id
      WHERE p.user_id = auth.uid() AND c.club_id = opponent_scouting_comments.club_id)
  )
);

CREATE POLICY "Authors and club members can update opponent comments"
ON public.opponent_scouting_comments FOR UPDATE TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM clubs cl WHERE cl.id = opponent_scouting_comments.club_id
    AND (cl.user_id = auth.uid() OR EXISTS (SELECT 1 FROM club_members cm WHERE cm.club_id = cl.id AND cm.user_id = auth.uid())))
);

CREATE POLICY "Authors and club members can delete opponent comments"
ON public.opponent_scouting_comments FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM clubs cl WHERE cl.id = opponent_scouting_comments.club_id
    AND (cl.user_id = auth.uid() OR EXISTS (SELECT 1 FROM club_members cm WHERE cm.club_id = cl.id AND cm.user_id = auth.uid())))
);

CREATE INDEX idx_opponent_scouting_comments_opponent ON public.opponent_scouting_comments(opponent_id, event_date DESC);

CREATE TRIGGER update_opponent_scouting_comments_updated_at
BEFORE UPDATE ON public.opponent_scouting_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();