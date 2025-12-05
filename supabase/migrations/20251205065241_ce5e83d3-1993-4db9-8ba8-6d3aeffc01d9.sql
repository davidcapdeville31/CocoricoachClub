-- Table for national team selections
CREATE TABLE public.player_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  selection_type TEXT NOT NULL, -- 'regional', 'france_u16', 'france_u18', 'france_u20', etc.
  selection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  competition_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for training attendance
CREATE TABLE public.training_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  training_session_id UUID REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'present', -- 'present', 'absent', 'excused', 'late'
  absence_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for parent/guardian contacts
CREATE TABLE public.player_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL DEFAULT 'parent', -- 'parent', 'guardian', 'emergency'
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  relationship TEXT, -- 'père', 'mère', 'tuteur', etc.
  phone TEXT,
  email TEXT,
  address TEXT,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for periodic evaluations
CREATE TABLE public.player_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  evaluation_period TEXT, -- 'trimestre_1', 'trimestre_2', 'trimestre_3', 'semestre_1', 'semestre_2'
  technical_score INTEGER CHECK (technical_score >= 1 AND technical_score <= 10),
  tactical_score INTEGER CHECK (tactical_score >= 1 AND tactical_score <= 10),
  physical_score INTEGER CHECK (physical_score >= 1 AND physical_score <= 10),
  mental_score INTEGER CHECK (mental_score >= 1 AND mental_score <= 10),
  attitude_score INTEGER CHECK (attitude_score >= 1 AND attitude_score <= 10),
  overall_comments TEXT,
  strengths TEXT,
  areas_to_improve TEXT,
  evaluated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.player_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for player_selections
CREATE POLICY "Club members can view player selections" ON public.player_selections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = player_selections.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

CREATE POLICY "Club members can insert player selections" ON public.player_selections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = player_selections.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

CREATE POLICY "Club members can update player selections" ON public.player_selections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = player_selections.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

CREATE POLICY "Club members can delete player selections" ON public.player_selections
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = player_selections.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

-- RLS Policies for training_attendance
CREATE POLICY "Club members can view training attendance" ON public.training_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_attendance.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

CREATE POLICY "Club members can insert training attendance" ON public.training_attendance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_attendance.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

CREATE POLICY "Club members can update training attendance" ON public.training_attendance
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_attendance.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

CREATE POLICY "Club members can delete training attendance" ON public.training_attendance
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_attendance.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

-- RLS Policies for player_contacts
CREATE POLICY "Club members can view player contacts" ON public.player_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = player_contacts.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

CREATE POLICY "Club members can insert player contacts" ON public.player_contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = player_contacts.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

CREATE POLICY "Club members can update player contacts" ON public.player_contacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = player_contacts.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

CREATE POLICY "Club members can delete player contacts" ON public.player_contacts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = player_contacts.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

-- RLS Policies for player_evaluations
CREATE POLICY "Club members can view player evaluations" ON public.player_evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = player_evaluations.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

CREATE POLICY "Club members can insert player evaluations" ON public.player_evaluations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = player_evaluations.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

CREATE POLICY "Club members can update player evaluations" ON public.player_evaluations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = player_evaluations.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );

CREATE POLICY "Club members can delete player evaluations" ON public.player_evaluations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = player_evaluations.category_id
      AND (clubs.user_id = auth.uid() OR can_access_club(auth.uid(), clubs.id))
    )
  );