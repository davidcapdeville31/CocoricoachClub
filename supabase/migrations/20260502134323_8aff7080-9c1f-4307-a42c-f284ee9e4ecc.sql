CREATE TABLE IF NOT EXISTS public.program_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (club_id, name)
);

CREATE INDEX IF NOT EXISTS idx_program_themes_club ON public.program_themes(club_id, display_order);

ALTER TABLE public.program_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view themes of their club"
ON public.program_themes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = program_themes.club_id
      AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Coaches can insert themes"
ON public.program_themes FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = program_themes.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role)
  )
);

CREATE POLICY "Coaches can update themes"
ON public.program_themes FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = program_themes.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role)
  )
);

CREATE POLICY "Coaches can delete non-system themes"
ON public.program_themes FOR DELETE
TO authenticated
USING (
  is_system = false
  AND EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = program_themes.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin'::app_role, 'coach'::app_role, 'prepa_physique'::app_role)
  )
);

CREATE TRIGGER update_program_themes_updated_at
BEFORE UPDATE ON public.program_themes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.training_programs
  ADD COLUMN IF NOT EXISTS theme_id UUID REFERENCES public.program_themes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_training_programs_theme ON public.training_programs(theme_id);

CREATE OR REPLACE FUNCTION public.seed_default_program_themes(p_club_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.program_themes (club_id, name, color, icon, display_order, is_system)
  VALUES
    (p_club_id, 'Force',                     '#ef4444', 'Dumbbell',  10, true),
    (p_club_id, 'Hypertrophie',              '#f97316', 'Flame',     20, true),
    (p_club_id, 'Puissance',                 '#f59e0b', 'Zap',       30, true),
    (p_club_id, 'Vitesse',                   '#eab308', 'Rocket',    40, true),
    (p_club_id, 'Endurance de force',        '#84cc16', 'Activity',  50, true),
    (p_club_id, 'Cardio / VMA',              '#22c55e', 'Heart',     60, true),
    (p_club_id, 'Endurance fondamentale',    '#10b981', 'Wind',      70, true),
    (p_club_id, 'Prophylaxie',               '#06b6d4', 'Shield',    80, true),
    (p_club_id, 'Réathlétisation',           '#3b82f6', 'BriefcaseMedical', 90, true),
    (p_club_id, 'Mobilité',                  '#8b5cf6', 'StretchHorizontal', 100, true),
    (p_club_id, 'Technique',                 '#ec4899', 'Target',    110, true),
    (p_club_id, 'Spécifique compétition',    '#f43f5e', 'Trophy',    120, true)
  ON CONFLICT (club_id, name) DO NOTHING;
END;
$$;

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT id FROM public.clubs LOOP
    PERFORM public.seed_default_program_themes(c.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.trigger_seed_program_themes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_program_themes(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_program_themes ON public.clubs;
CREATE TRIGGER trg_seed_program_themes
AFTER INSERT ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.trigger_seed_program_themes();