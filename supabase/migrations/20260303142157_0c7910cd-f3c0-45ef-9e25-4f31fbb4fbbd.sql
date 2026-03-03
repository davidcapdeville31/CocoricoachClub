
-- GPS Session Objectives: targets per position group per training session
CREATE TABLE public.gps_session_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_session_id uuid REFERENCES public.training_sessions(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  position_group text NOT NULL, -- e.g. "Avants", "3/4", "Gardiens", "Global"
  target_total_distance_m numeric,
  target_high_speed_distance_m numeric,
  target_sprint_count integer,
  target_vmax_percentage numeric, -- % of Vmax to reach (e.g. 85)
  additional_kpis jsonb DEFAULT '[]'::jsonb, -- [{name, unit, target, tolerance}]
  tolerance_green numeric DEFAULT 15, -- ±15%
  tolerance_orange numeric DEFAULT 30, -- ±30%
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- GPS Objective Templates: reusable templates (system + custom)
CREATE TABLE public.gps_objective_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  sport_type text NOT NULL DEFAULT 'XV',
  is_system boolean DEFAULT false,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb, -- {groups: [{position_group, targets}]}
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.gps_session_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_objective_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for gps_session_objectives
CREATE POLICY "Users can view objectives for categories they access"
  ON public.gps_session_objectives FOR SELECT TO authenticated
  USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can insert objectives for categories they access"
  ON public.gps_session_objectives FOR INSERT TO authenticated
  WITH CHECK (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can update objectives for categories they access"
  ON public.gps_session_objectives FOR UPDATE TO authenticated
  USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can delete objectives for categories they access"
  ON public.gps_session_objectives FOR DELETE TO authenticated
  USING (public.can_access_category(auth.uid(), category_id));

-- RLS policies for gps_objective_templates
CREATE POLICY "Users can view system or own category templates"
  ON public.gps_objective_templates FOR SELECT TO authenticated
  USING (is_system = true OR (category_id IS NOT NULL AND public.can_access_category(auth.uid(), category_id)));

CREATE POLICY "Users can insert templates for their categories"
  ON public.gps_objective_templates FOR INSERT TO authenticated
  WITH CHECK (category_id IS NOT NULL AND public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can update own category templates"
  ON public.gps_objective_templates FOR UPDATE TO authenticated
  USING (category_id IS NOT NULL AND public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can delete own category templates"
  ON public.gps_objective_templates FOR DELETE TO authenticated
  USING (category_id IS NOT NULL AND public.can_access_category(auth.uid(), category_id));
