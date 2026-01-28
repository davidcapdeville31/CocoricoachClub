-- Table pour stocker les références de performance par joueur
CREATE TABLE public.player_performance_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  
  -- Source du test
  test_date DATE NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'speed_test', -- 'speed_test', 'gps_session', 'manual'
  source_id UUID, -- ID du test ou session GPS source
  
  -- Métriques de référence vitesse/sprint
  ref_vmax_ms NUMERIC, -- Vitesse max en m/s
  ref_vmax_kmh NUMERIC, -- Vitesse max en km/h
  ref_acceleration_max NUMERIC, -- Accélération max
  ref_deceleration_max NUMERIC, -- Décélération max
  ref_sprint_distance_m NUMERIC, -- Distance sprint de référence
  ref_time_40m_seconds NUMERIC, -- Temps 40m si test sprint
  
  -- Métriques de charge/contact (pour matchs)
  ref_player_load_per_min NUMERIC, -- Player load par minute
  ref_high_intensity_distance_per_min NUMERIC, -- Distance haute intensité par minute
  ref_impacts_per_min NUMERIC, -- Impacts/contacts par minute
  
  -- Métadonnées
  is_active BOOLEAN NOT NULL DEFAULT true, -- Référence actuellement utilisée
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Un seul jeu de références actif par joueur/catégorie
  CONSTRAINT unique_active_reference UNIQUE (player_id, category_id, is_active) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Index pour requêtes fréquentes
CREATE INDEX idx_perf_ref_player ON public.player_performance_references(player_id);
CREATE INDEX idx_perf_ref_category ON public.player_performance_references(category_id);
CREATE INDEX idx_perf_ref_active ON public.player_performance_references(player_id, is_active) WHERE is_active = true;

-- Trigger pour updated_at
CREATE TRIGGER update_player_performance_references_updated_at
  BEFORE UPDATE ON public.player_performance_references
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.player_performance_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view references for their categories"
  ON public.player_performance_references FOR SELECT
  USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can insert references for their categories"
  ON public.player_performance_references FOR INSERT
  WITH CHECK (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can update references for their categories"
  ON public.player_performance_references FOR UPDATE
  USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can delete references for their categories"
  ON public.player_performance_references FOR DELETE
  USING (public.can_access_category(auth.uid(), category_id));