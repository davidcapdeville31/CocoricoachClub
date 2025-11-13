-- Create enum for injury severity
CREATE TYPE public.injury_severity AS ENUM ('légère', 'modérée', 'grave');

-- Create enum for injury status
CREATE TYPE public.injury_status AS ENUM ('active', 'en_réathlétisation', 'guérie');

-- Create enum for period type
CREATE TYPE public.period_type AS ENUM ('préparation', 'compétition', 'récupération', 'trêve');

-- Create injuries table
CREATE TABLE public.injuries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL,
  category_id UUID NOT NULL,
  injury_type TEXT NOT NULL,
  injury_date DATE NOT NULL DEFAULT CURRENT_DATE,
  severity injury_severity NOT NULL,
  status injury_status NOT NULL DEFAULT 'active',
  estimated_return_date DATE,
  actual_return_date DATE,
  description TEXT,
  protocol_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create training_periods table for periodization
CREATE TABLE public.training_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL,
  name TEXT NOT NULL,
  period_type period_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_load_percentage INTEGER, -- Pourcentage de charge cible (ex: 80 pour 80%)
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create training_cycles table for detailed weekly planning
CREATE TABLE public.training_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL,
  period_id UUID REFERENCES public.training_periods(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_intensity INTEGER, -- Intensité cible sur 10
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_cycles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for injuries
CREATE POLICY "Users can view own injuries"
  ON public.injuries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = injuries.category_id
      AND clubs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own injuries"
  ON public.injuries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = injuries.category_id
      AND clubs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own injuries"
  ON public.injuries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = injuries.category_id
      AND clubs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own injuries"
  ON public.injuries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = injuries.category_id
      AND clubs.user_id = auth.uid()
    )
  );

-- RLS Policies for training_periods
CREATE POLICY "Users can view own training periods"
  ON public.training_periods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_periods.category_id
      AND clubs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own training periods"
  ON public.training_periods FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_periods.category_id
      AND clubs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own training periods"
  ON public.training_periods FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_periods.category_id
      AND clubs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own training periods"
  ON public.training_periods FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_periods.category_id
      AND clubs.user_id = auth.uid()
    )
  );

-- RLS Policies for training_cycles
CREATE POLICY "Users can view own training cycles"
  ON public.training_cycles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_cycles.category_id
      AND clubs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own training cycles"
  ON public.training_cycles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_cycles.category_id
      AND clubs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own training cycles"
  ON public.training_cycles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_cycles.category_id
      AND clubs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own training cycles"
  ON public.training_cycles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM categories
      JOIN clubs ON clubs.id = categories.club_id
      WHERE categories.id = training_cycles.category_id
      AND clubs.user_id = auth.uid()
    )
  );

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_injuries_updated_at
  BEFORE UPDATE ON public.injuries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_training_periods_updated_at
  BEFORE UPDATE ON public.training_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_training_cycles_updated_at
  BEFORE UPDATE ON public.training_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_injuries_player_id ON public.injuries(player_id);
CREATE INDEX idx_injuries_category_id ON public.injuries(category_id);
CREATE INDEX idx_injuries_status ON public.injuries(status);
CREATE INDEX idx_training_periods_category_id ON public.training_periods(category_id);
CREATE INDEX idx_training_periods_dates ON public.training_periods(start_date, end_date);
CREATE INDEX idx_training_cycles_category_id ON public.training_cycles(category_id);
CREATE INDEX idx_training_cycles_period_id ON public.training_cycles(period_id);