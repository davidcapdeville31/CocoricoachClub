-- Create enum for training types
CREATE TYPE training_type AS ENUM ('collectif', 'technique_individuelle', 'physique', 'musculation', 'repos', 'test');

-- Table des clubs
CREATE TABLE public.clubs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des catégories
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des joueurs
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des séances d'entraînement
CREATE TABLE public.training_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_time TIME,
  training_type training_type NOT NULL,
  intensity INTEGER CHECK (intensity >= 1 AND intensity <= 10),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des tests de vitesse (40m sprint et 1600m run)
CREATE TABLE public.speed_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  test_type TEXT NOT NULL CHECK (test_type IN ('40m_sprint', '1600m_run')),
  -- Pour 40m sprint
  time_40m_seconds DECIMAL(5,2),
  speed_ms DECIMAL(5,2),
  speed_kmh DECIMAL(5,2),
  -- Pour 1600m run
  time_1600m_seconds INTEGER,
  time_1600m_minutes INTEGER,
  vma_kmh DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des tests de musculation
CREATE TABLE public.strength_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  test_name TEXT NOT NULL,
  weight_kg DECIMAL(6,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table pour le suivi AWCR (Acute:Chronic Workload Ratio)
CREATE TABLE public.awcr_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  training_session_id UUID REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  session_date DATE NOT NULL,
  rpe INTEGER NOT NULL CHECK (rpe >= 0 AND rpe <= 10),
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  training_load INTEGER GENERATED ALWAYS AS (rpe * duration_minutes) STORED,
  acute_load DECIMAL(10,2),
  chronic_load DECIMAL(10,2),
  awcr DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speed_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strength_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.awcr_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Public access for now (we can add authentication later)
CREATE POLICY "Enable all operations for everyone" ON public.clubs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for everyone" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for everyone" ON public.players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for everyone" ON public.training_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for everyone" ON public.speed_tests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for everyone" ON public.strength_tests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for everyone" ON public.awcr_tracking FOR ALL USING (true) WITH CHECK (true);

-- Indexes for better performance
CREATE INDEX idx_categories_club_id ON public.categories(club_id);
CREATE INDEX idx_players_category_id ON public.players(category_id);
CREATE INDEX idx_training_sessions_category_id ON public.training_sessions(category_id);
CREATE INDEX idx_training_sessions_date ON public.training_sessions(session_date);
CREATE INDEX idx_speed_tests_player_id ON public.speed_tests(player_id);
CREATE INDEX idx_speed_tests_category_id ON public.speed_tests(category_id);
CREATE INDEX idx_strength_tests_player_id ON public.strength_tests(player_id);
CREATE INDEX idx_awcr_tracking_player_id ON public.awcr_tracking(player_id);
CREATE INDEX idx_awcr_tracking_date ON public.awcr_tracking(session_date);