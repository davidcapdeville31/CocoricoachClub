
CREATE TABLE public.opponent_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  last_name text NOT NULL,
  first_name text,
  gender text CHECK (gender IS NULL OR gender IN ('male','female','other')),
  weight_category text,
  handedness text CHECK (handedness IS NULL OR handedness IN ('left','right','ambidextrous','unknown')),
  club_origin text,
  country text,
  birth_year integer,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_opponent_profiles_club ON public.opponent_profiles(club_id);
CREATE INDEX idx_opponent_profiles_category ON public.opponent_profiles(category_id);

ALTER TABLE public.opponent_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view opponent profiles"
ON public.opponent_profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clubs cl
    WHERE cl.id = opponent_profiles.club_id
      AND (
        cl.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members cm
          WHERE cm.club_id = cl.id AND cm.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Club admins/coaches can insert opponent profiles"
ON public.opponent_profiles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clubs cl
    WHERE cl.id = opponent_profiles.club_id
      AND (
        cl.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members cm
          WHERE cm.club_id = cl.id AND cm.user_id = auth.uid()
            AND cm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role])
        )
      )
  )
);

CREATE POLICY "Club admins/coaches can update opponent profiles"
ON public.opponent_profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.clubs cl
    WHERE cl.id = opponent_profiles.club_id
      AND (
        cl.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members cm
          WHERE cm.club_id = cl.id AND cm.user_id = auth.uid()
            AND cm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role])
        )
      )
  )
);

CREATE POLICY "Club admins/coaches can delete opponent profiles"
ON public.opponent_profiles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.clubs cl
    WHERE cl.id = opponent_profiles.club_id
      AND (
        cl.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members cm
          WHERE cm.club_id = cl.id AND cm.user_id = auth.uid()
            AND cm.role = ANY (ARRAY['admin'::app_role,'coach'::app_role])
        )
      )
  )
);

CREATE TRIGGER update_opponent_profiles_updated_at
BEFORE UPDATE ON public.opponent_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.competition_rounds
  ADD COLUMN opponent_profile_id uuid REFERENCES public.opponent_profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_competition_rounds_opponent_profile ON public.competition_rounds(opponent_profile_id);
