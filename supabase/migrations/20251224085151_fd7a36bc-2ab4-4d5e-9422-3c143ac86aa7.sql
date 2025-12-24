
-- Table pour les bilans de rassemblement (wellness détaillé)
CREATE TABLE public.gathering_wellness_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.national_team_events(id) ON DELETE SET NULL,
  
  -- Type de bilan
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('pre_gathering', 'day_of')),
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Lien entre les 2 bilans (le bilan jour J référence le bilan pré-rassemblement)
  linked_assessment_id UUID REFERENCES public.gathering_wellness_assessments(id) ON DELETE SET NULL,
  
  -- Infos rempli par
  filled_by TEXT, -- Nom du préparateur physique club ou "joueur"
  filled_by_role TEXT CHECK (filled_by_role IN ('club_trainer', 'player', 'national_staff')),
  
  -- Charge récente (7-14 jours)
  training_load_last_7_days INTEGER,
  training_load_last_14_days INTEGER,
  matches_played_last_14_days INTEGER,
  total_minutes_last_14_days INTEGER,
  
  -- Wellness standard (1-5)
  sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
  sleep_duration_hours NUMERIC(3,1),
  fatigue_level INTEGER CHECK (fatigue_level >= 1 AND fatigue_level <= 5),
  stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 5),
  muscle_soreness INTEGER CHECK (muscle_soreness >= 1 AND muscle_soreness <= 5),
  
  -- Wellness étendu
  motivation_level INTEGER CHECK (motivation_level >= 1 AND motivation_level <= 5),
  mood_level INTEGER CHECK (mood_level >= 1 AND mood_level <= 5),
  appetite_level INTEGER CHECK (appetite_level >= 1 AND appetite_level <= 5),
  hydration_level INTEGER CHECK (hydration_level >= 1 AND hydration_level <= 5),
  
  -- Douleurs et gênes
  has_pain BOOLEAN DEFAULT false,
  pain_locations TEXT[], -- zones de douleur
  pain_intensity INTEGER CHECK (pain_intensity >= 1 AND pain_intensity <= 10),
  pain_description TEXT,
  
  -- Blessures récentes
  recent_injuries TEXT,
  current_limitations TEXT,
  
  -- AWCR si disponible
  current_awcr NUMERIC(4,2),
  
  -- Commentaires
  club_staff_comments TEXT,
  player_comments TEXT,
  national_staff_comments TEXT,
  
  -- Recommandations
  recommended_load TEXT CHECK (recommended_load IN ('full', 'adapted', 'light', 'rest')),
  specific_recommendations TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour les recherches
CREATE INDEX idx_gathering_wellness_player ON public.gathering_wellness_assessments(player_id);
CREATE INDEX idx_gathering_wellness_event ON public.gathering_wellness_assessments(event_id);
CREATE INDEX idx_gathering_wellness_category ON public.gathering_wellness_assessments(category_id);
CREATE INDEX idx_gathering_wellness_type ON public.gathering_wellness_assessments(assessment_type);
CREATE INDEX idx_gathering_wellness_linked ON public.gathering_wellness_assessments(linked_assessment_id);

-- Enable RLS
ALTER TABLE public.gathering_wellness_assessments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view gathering assessments for their categories"
ON public.gathering_wellness_assessments
FOR SELECT
USING (can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can create gathering assessments for their categories"
ON public.gathering_wellness_assessments
FOR INSERT
WITH CHECK (can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can update gathering assessments for their categories"
ON public.gathering_wellness_assessments
FOR UPDATE
USING (can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can delete gathering assessments for their categories"
ON public.gathering_wellness_assessments
FOR DELETE
USING (can_access_category(auth.uid(), category_id));

-- Trigger pour updated_at
CREATE TRIGGER update_gathering_wellness_updated_at
BEFORE UPDATE ON public.gathering_wellness_assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
