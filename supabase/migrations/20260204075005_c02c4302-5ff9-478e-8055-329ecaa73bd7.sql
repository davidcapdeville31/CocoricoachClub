-- Add lateness details to training_attendance (if not already added)
ALTER TABLE public.training_attendance 
ADD COLUMN IF NOT EXISTS late_minutes INTEGER,
ADD COLUMN IF NOT EXISTS late_justified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS late_reason TEXT;

-- Create match_sheets table for match lineup management
CREATE TABLE IF NOT EXISTS public.match_sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sheet_date DATE NOT NULL DEFAULT CURRENT_DATE,
  opponent TEXT,
  location TEXT,
  match_time TIME,
  notes TEXT,
  status TEXT DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create match_sheet_players for players in match sheets
CREATE TABLE IF NOT EXISTS public.match_sheet_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_sheet_id UUID NOT NULL REFERENCES public.match_sheets(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  position TEXT,
  jersey_number INTEGER,
  is_starter BOOLEAN DEFAULT true,
  is_captain BOOLEAN DEFAULT false,
  notes TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create convocations table
CREATE TABLE IF NOT EXISTS public.convocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  description TEXT,
  response_deadline DATE,
  status TEXT DEFAULT 'draft',
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  training_session_id UUID REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create convocation_recipients table
CREATE TABLE IF NOT EXISTS public.convocation_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  convocation_id UUID NOT NULL REFERENCES public.convocations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  response TEXT DEFAULT 'pending',
  response_date TIMESTAMP WITH TIME ZONE,
  response_reason TEXT,
  notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.match_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_sheet_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convocation_recipients ENABLE ROW LEVEL SECURITY;

-- RLS policies for match_sheets (using admin, coach roles)
CREATE POLICY "Users can view match sheets for their categories" 
ON public.match_sheets 
FOR SELECT 
USING (
  category_id IN (
    SELECT cm.category_id FROM category_members cm WHERE cm.user_id = auth.uid()
  ) OR
  category_id IN (
    SELECT c.id FROM categories c 
    JOIN club_members clm ON c.club_id = clm.club_id 
    WHERE clm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage match sheets for their categories" 
ON public.match_sheets 
FOR ALL 
USING (
  category_id IN (
    SELECT cm.category_id FROM category_members cm 
    WHERE cm.user_id = auth.uid() AND cm.role IN ('admin', 'coach')
  ) OR
  category_id IN (
    SELECT c.id FROM categories c 
    JOIN club_members clm ON c.club_id = clm.club_id 
    WHERE clm.user_id = auth.uid() AND clm.role IN ('admin', 'coach')
  )
);

-- RLS policies for match_sheet_players
CREATE POLICY "Users can view match sheet players" 
ON public.match_sheet_players 
FOR SELECT 
USING (
  match_sheet_id IN (
    SELECT id FROM match_sheets ms 
    WHERE ms.category_id IN (
      SELECT cm.category_id FROM category_members cm WHERE cm.user_id = auth.uid()
    ) OR ms.category_id IN (
      SELECT c.id FROM categories c 
      JOIN club_members clm ON c.club_id = clm.club_id 
      WHERE clm.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage match sheet players" 
ON public.match_sheet_players 
FOR ALL 
USING (
  match_sheet_id IN (
    SELECT id FROM match_sheets ms 
    WHERE ms.category_id IN (
      SELECT cm.category_id FROM category_members cm 
      WHERE cm.user_id = auth.uid() AND cm.role IN ('admin', 'coach')
    ) OR ms.category_id IN (
      SELECT c.id FROM categories c 
      JOIN club_members clm ON c.club_id = clm.club_id 
      WHERE clm.user_id = auth.uid() AND clm.role IN ('admin', 'coach')
    )
  )
);

-- RLS policies for convocations
CREATE POLICY "Users can view convocations for their categories" 
ON public.convocations 
FOR SELECT 
USING (
  category_id IN (
    SELECT cm.category_id FROM category_members cm WHERE cm.user_id = auth.uid()
  ) OR
  category_id IN (
    SELECT c.id FROM categories c 
    JOIN club_members clm ON c.club_id = clm.club_id 
    WHERE clm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage convocations for their categories" 
ON public.convocations 
FOR ALL 
USING (
  category_id IN (
    SELECT cm.category_id FROM category_members cm 
    WHERE cm.user_id = auth.uid() AND cm.role IN ('admin', 'coach')
  ) OR
  category_id IN (
    SELECT c.id FROM categories c 
    JOIN club_members clm ON c.club_id = clm.club_id 
    WHERE clm.user_id = auth.uid() AND clm.role IN ('admin', 'coach')
  )
);

-- RLS policies for convocation_recipients
CREATE POLICY "Users can view convocation recipients" 
ON public.convocation_recipients 
FOR SELECT 
USING (
  convocation_id IN (
    SELECT id FROM convocations cv 
    WHERE cv.category_id IN (
      SELECT cm.category_id FROM category_members cm WHERE cm.user_id = auth.uid()
    ) OR cv.category_id IN (
      SELECT c.id FROM categories c 
      JOIN club_members clm ON c.club_id = clm.club_id 
      WHERE clm.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage convocation recipients" 
ON public.convocation_recipients 
FOR ALL 
USING (
  convocation_id IN (
    SELECT id FROM convocations cv 
    WHERE cv.category_id IN (
      SELECT cm.category_id FROM category_members cm 
      WHERE cm.user_id = auth.uid() AND cm.role IN ('admin', 'coach')
    ) OR cv.category_id IN (
      SELECT c.id FROM categories c 
      JOIN club_members clm ON c.club_id = clm.club_id 
      WHERE clm.user_id = auth.uid() AND clm.role IN ('admin', 'coach')
    )
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_match_sheets_category ON public.match_sheets(category_id);
CREATE INDEX IF NOT EXISTS idx_match_sheets_match ON public.match_sheets(match_id);
CREATE INDEX IF NOT EXISTS idx_match_sheet_players_sheet ON public.match_sheet_players(match_sheet_id);
CREATE INDEX IF NOT EXISTS idx_convocations_category ON public.convocations(category_id);
CREATE INDEX IF NOT EXISTS idx_convocation_recipients_convocation ON public.convocation_recipients(convocation_id);