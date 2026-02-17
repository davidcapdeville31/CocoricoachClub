
-- Create seasons table at club level
CREATE TABLE public.seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. "2025-2026"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Only one active season per club
CREATE UNIQUE INDEX unique_active_season_per_club ON public.seasons (club_id) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- Policies: club members can view, club owners/admins can manage
CREATE POLICY "Club members can view seasons"
  ON public.seasons FOR SELECT
  USING (public.can_access_club(auth.uid(), club_id));

CREATE POLICY "Club admins can insert seasons"
  ON public.seasons FOR INSERT
  WITH CHECK (public.can_modify_club_data(auth.uid(), club_id));

CREATE POLICY "Club admins can update seasons"
  ON public.seasons FOR UPDATE
  USING (public.can_modify_club_data(auth.uid(), club_id));

CREATE POLICY "Club admins can delete seasons"
  ON public.seasons FOR DELETE
  USING (public.can_modify_club_data(auth.uid(), club_id));

CREATE POLICY "Super admins can manage seasons"
  ON public.seasons FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- Add season_id to players (nullable for backward compatibility)
ALTER TABLE public.players ADD COLUMN season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL;

-- Trigger for updated_at
CREATE TRIGGER update_seasons_updated_at
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to deactivate other seasons when activating one
CREATE OR REPLACE FUNCTION public.enforce_single_active_season()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.seasons 
    SET is_active = false 
    WHERE club_id = NEW.club_id AND id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_single_active_season_trigger
  BEFORE INSERT OR UPDATE ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_active_season();
