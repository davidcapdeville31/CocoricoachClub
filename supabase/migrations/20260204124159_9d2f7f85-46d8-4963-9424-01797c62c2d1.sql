-- =============================================
-- SUIVI ACADÉMIQUE (Academic Tracking)
-- =============================================

-- Table for player academic profiles
CREATE TABLE public.player_academic_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  school_name TEXT,
  grade_level TEXT, -- 6ème, 5ème, 4ème, 3ème, 2nde, 1ère, Terminale, Licence, etc.
  class_name TEXT, -- Sport-études, Section sportive, etc.
  school_contact_name TEXT,
  school_contact_email TEXT,
  school_contact_phone TEXT,
  special_arrangements TEXT, -- Aménagements scolaires
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(player_id, category_id)
);

-- Table for academic grades/results
CREATE TABLE public.academic_grades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  grade DECIMAL(4,2),
  max_grade DECIMAL(4,2) DEFAULT 20,
  grade_date DATE NOT NULL DEFAULT CURRENT_DATE,
  term TEXT, -- Trimestre 1, 2, 3 ou Semestre 1, 2
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for school absences
CREATE TABLE public.academic_absences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  absence_date DATE NOT NULL,
  absence_type TEXT NOT NULL DEFAULT 'absence', -- absence, retard, exclusion
  justified BOOLEAN DEFAULT false,
  reason TEXT,
  duration_hours DECIMAL(4,2) DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- PERFORMANCE MENTALE (Mental Performance)
-- =============================================

-- Table for mental performance assessments
CREATE TABLE public.mental_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  assessment_type TEXT NOT NULL, -- initial, suivi, pre-match, post-match
  
  -- Psychological metrics (1-10 scale)
  confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 10),
  focus_level INTEGER CHECK (focus_level BETWEEN 1 AND 10),
  anxiety_level INTEGER CHECK (anxiety_level BETWEEN 1 AND 10),
  motivation_level INTEGER CHECK (motivation_level BETWEEN 1 AND 10),
  resilience_level INTEGER CHECK (resilience_level BETWEEN 1 AND 10),
  team_cohesion INTEGER CHECK (team_cohesion BETWEEN 1 AND 10),
  
  -- Additional notes
  strengths TEXT,
  areas_to_improve TEXT,
  mental_prep_notes TEXT,
  assessed_by TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for mental goals
CREATE TABLE public.mental_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL, -- short_term, medium_term, long_term
  goal_title TEXT NOT NULL,
  goal_description TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active', -- active, achieved, abandoned
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for mental prep sessions with professional
CREATE TABLE public.mental_prep_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_type TEXT NOT NULL, -- individuel, groupe, visualisation, relaxation, respiration
  duration_minutes INTEGER,
  practitioner_name TEXT,
  topics_covered TEXT,
  exercises_practiced TEXT,
  homework TEXT, -- Travail à faire entre les séances
  player_feedback TEXT,
  next_session_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.player_academic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mental_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mental_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mental_prep_sessions ENABLE ROW LEVEL SECURITY;

-- Academic profiles policies
CREATE POLICY "Users can view academic profiles for accessible categories"
ON public.player_academic_profiles FOR SELECT
USING (can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can manage academic profiles for accessible categories"
ON public.player_academic_profiles FOR ALL
USING (can_access_category(auth.uid(), category_id));

-- Academic grades policies
CREATE POLICY "Users can view grades for accessible categories"
ON public.academic_grades FOR SELECT
USING (can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can manage grades for accessible categories"
ON public.academic_grades FOR ALL
USING (can_access_category(auth.uid(), category_id));

-- Academic absences policies
CREATE POLICY "Users can view absences for accessible categories"
ON public.academic_absences FOR SELECT
USING (can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can manage absences for accessible categories"
ON public.academic_absences FOR ALL
USING (can_access_category(auth.uid(), category_id));

-- Mental assessments policies
CREATE POLICY "Users can view mental assessments for accessible categories"
ON public.mental_assessments FOR SELECT
USING (can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can manage mental assessments for accessible categories"
ON public.mental_assessments FOR ALL
USING (can_access_category(auth.uid(), category_id));

-- Mental goals policies
CREATE POLICY "Users can view mental goals for accessible categories"
ON public.mental_goals FOR SELECT
USING (can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can manage mental goals for accessible categories"
ON public.mental_goals FOR ALL
USING (can_access_category(auth.uid(), category_id));

-- Mental prep sessions policies
CREATE POLICY "Users can view mental prep sessions for accessible categories"
ON public.mental_prep_sessions FOR SELECT
USING (can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can manage mental prep sessions for accessible categories"
ON public.mental_prep_sessions FOR ALL
USING (can_access_category(auth.uid(), category_id));

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_academic_profiles_player ON public.player_academic_profiles(player_id);
CREATE INDEX idx_academic_profiles_category ON public.player_academic_profiles(category_id);
CREATE INDEX idx_academic_grades_player ON public.academic_grades(player_id);
CREATE INDEX idx_academic_grades_category ON public.academic_grades(category_id);
CREATE INDEX idx_academic_absences_player ON public.academic_absences(player_id);
CREATE INDEX idx_academic_absences_category ON public.academic_absences(category_id);
CREATE INDEX idx_mental_assessments_player ON public.mental_assessments(player_id);
CREATE INDEX idx_mental_assessments_category ON public.mental_assessments(category_id);
CREATE INDEX idx_mental_goals_player ON public.mental_goals(player_id);
CREATE INDEX idx_mental_goals_category ON public.mental_goals(category_id);
CREATE INDEX idx_mental_prep_sessions_player ON public.mental_prep_sessions(player_id);
CREATE INDEX idx_mental_prep_sessions_category ON public.mental_prep_sessions(category_id);