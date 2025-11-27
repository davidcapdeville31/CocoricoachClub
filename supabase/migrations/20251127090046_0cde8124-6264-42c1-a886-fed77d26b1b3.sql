-- Create matches table
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  opponent TEXT NOT NULL,
  match_date DATE NOT NULL,
  match_time TIME,
  location TEXT,
  is_home BOOLEAN DEFAULT true,
  score_home INTEGER,
  score_away INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create match_lineups table for team composition
CREATE TABLE public.match_lineups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  position TEXT,
  is_starter BOOLEAN DEFAULT false,
  minutes_played INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(match_id, player_id)
);

-- Create player_match_stats table for individual statistics
CREATE TABLE public.player_match_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  tries INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  penalties_scored INTEGER DEFAULT 0,
  drop_goals INTEGER DEFAULT 0,
  tackles INTEGER DEFAULT 0,
  tackles_missed INTEGER DEFAULT 0,
  carries INTEGER DEFAULT 0,
  meters_gained INTEGER DEFAULT 0,
  offloads INTEGER DEFAULT 0,
  turnovers_won INTEGER DEFAULT 0,
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(match_id, player_id)
);

-- Enable RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies for matches
CREATE POLICY "Club members can view matches"
ON public.matches FOR SELECT
USING (EXISTS (
  SELECT 1 FROM categories
  JOIN clubs ON clubs.id = categories.club_id
  WHERE categories.id = matches.category_id
  AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
));

CREATE POLICY "Club owners can insert matches"
ON public.matches FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM categories
  JOIN clubs ON clubs.id = categories.club_id
  WHERE categories.id = matches.category_id
  AND clubs.user_id = auth.uid()
));

CREATE POLICY "Club owners can update matches"
ON public.matches FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM categories
  JOIN clubs ON clubs.id = categories.club_id
  WHERE categories.id = matches.category_id
  AND clubs.user_id = auth.uid()
));

CREATE POLICY "Club owners can delete matches"
ON public.matches FOR DELETE
USING (EXISTS (
  SELECT 1 FROM categories
  JOIN clubs ON clubs.id = categories.club_id
  WHERE categories.id = matches.category_id
  AND clubs.user_id = auth.uid()
));

-- RLS policies for match_lineups
CREATE POLICY "Club members can view match lineups"
ON public.match_lineups FOR SELECT
USING (EXISTS (
  SELECT 1 FROM matches
  JOIN categories ON categories.id = matches.category_id
  JOIN clubs ON clubs.id = categories.club_id
  WHERE matches.id = match_lineups.match_id
  AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
));

CREATE POLICY "Club owners can insert match lineups"
ON public.match_lineups FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM matches
  JOIN categories ON categories.id = matches.category_id
  JOIN clubs ON clubs.id = categories.club_id
  WHERE matches.id = match_lineups.match_id
  AND clubs.user_id = auth.uid()
));

CREATE POLICY "Club owners can update match lineups"
ON public.match_lineups FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM matches
  JOIN categories ON categories.id = matches.category_id
  JOIN clubs ON clubs.id = categories.club_id
  WHERE matches.id = match_lineups.match_id
  AND clubs.user_id = auth.uid()
));

CREATE POLICY "Club owners can delete match lineups"
ON public.match_lineups FOR DELETE
USING (EXISTS (
  SELECT 1 FROM matches
  JOIN categories ON categories.id = matches.category_id
  JOIN clubs ON clubs.id = categories.club_id
  WHERE matches.id = match_lineups.match_id
  AND clubs.user_id = auth.uid()
));

-- RLS policies for player_match_stats
CREATE POLICY "Club members can view player match stats"
ON public.player_match_stats FOR SELECT
USING (EXISTS (
  SELECT 1 FROM matches
  JOIN categories ON categories.id = matches.category_id
  JOIN clubs ON clubs.id = categories.club_id
  WHERE matches.id = player_match_stats.match_id
  AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
));

CREATE POLICY "Club owners can insert player match stats"
ON public.player_match_stats FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM matches
  JOIN categories ON categories.id = matches.category_id
  JOIN clubs ON clubs.id = categories.club_id
  WHERE matches.id = player_match_stats.match_id
  AND clubs.user_id = auth.uid()
));

CREATE POLICY "Club owners can update player match stats"
ON public.player_match_stats FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM matches
  JOIN categories ON categories.id = matches.category_id
  JOIN clubs ON clubs.id = categories.club_id
  WHERE matches.id = player_match_stats.match_id
  AND clubs.user_id = auth.uid()
));

CREATE POLICY "Club owners can delete player match stats"
ON public.player_match_stats FOR DELETE
USING (EXISTS (
  SELECT 1 FROM matches
  JOIN categories ON categories.id = matches.category_id
  JOIN clubs ON clubs.id = categories.club_id
  WHERE matches.id = player_match_stats.match_id
  AND clubs.user_id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_matches_updated_at
BEFORE UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();