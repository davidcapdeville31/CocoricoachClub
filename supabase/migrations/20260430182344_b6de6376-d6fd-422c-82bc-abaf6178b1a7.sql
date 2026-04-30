ALTER TABLE public.training_programs
  ADD COLUMN IF NOT EXISTS program_kind text NOT NULL DEFAULT 'training',
  ADD COLUMN IF NOT EXISTS injury_library_id uuid;

CREATE INDEX IF NOT EXISTS idx_training_programs_kind
  ON public.training_programs(category_id, program_kind);

CREATE TABLE IF NOT EXISTS public.injury_library (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  injury_category text NOT NULL,
  description text,
  typical_duration_days_min integer,
  typical_duration_days_max integer,
  is_system_default boolean NOT NULL DEFAULT false,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_injury_library_category ON public.injury_library(category_id);
CREATE INDEX IF NOT EXISTS idx_injury_library_system ON public.injury_library(is_system_default);

DO $$ BEGIN
  ALTER TABLE public.training_programs
    ADD CONSTRAINT training_programs_injury_library_fk
    FOREIGN KEY (injury_library_id) REFERENCES public.injury_library(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS update_injury_library_updated_at ON public.injury_library;
CREATE TRIGGER update_injury_library_updated_at
  BEFORE UPDATE ON public.injury_library
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.injury_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view system injuries" ON public.injury_library;
CREATE POLICY "Anyone can view system injuries"
  ON public.injury_library FOR SELECT
  USING (is_system_default = true);

DROP POLICY IF EXISTS "Members can view category injuries" ON public.injury_library;
CREATE POLICY "Members can view category injuries"
  ON public.injury_library FOR SELECT
  USING (
    category_id IS NOT NULL
    AND public.can_access_category(auth.uid(), category_id)
  );

DROP POLICY IF EXISTS "Staff can insert category injuries" ON public.injury_library;
CREATE POLICY "Staff can insert category injuries"
  ON public.injury_library FOR INSERT
  WITH CHECK (
    is_system_default = false
    AND category_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = category_id
        AND (
          public.can_modify_club_data(auth.uid(), c.club_id)
          OR public.has_medical_or_coaching_access(auth.uid(), c.club_id)
        )
    )
  );

DROP POLICY IF EXISTS "Staff can update category injuries" ON public.injury_library;
CREATE POLICY "Staff can update category injuries"
  ON public.injury_library FOR UPDATE
  USING (
    is_system_default = false
    AND category_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = category_id
        AND (
          public.can_modify_club_data(auth.uid(), c.club_id)
          OR public.has_medical_or_coaching_access(auth.uid(), c.club_id)
        )
    )
  );

DROP POLICY IF EXISTS "Staff can delete category injuries" ON public.injury_library;
CREATE POLICY "Staff can delete category injuries"
  ON public.injury_library FOR DELETE
  USING (
    is_system_default = false
    AND category_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = category_id
        AND (
          public.can_modify_club_data(auth.uid(), c.club_id)
          OR public.has_medical_or_coaching_access(auth.uid(), c.club_id)
        )
    )
  );

DROP POLICY IF EXISTS "Super admins manage all injuries" ON public.injury_library;
CREATE POLICY "Super admins manage all injuries"
  ON public.injury_library FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.injury_library (name, injury_category, description, typical_duration_days_min, typical_duration_days_max, is_system_default)
SELECT v.name, v.injury_category, v.description, v.dmin, v.dmax, true
FROM (VALUES
  ('Élongation ischio-jambiers', 'musculaire', 'Lésion des muscles à l''arrière de la cuisse, fréquente lors des sprints', 14, 42),
  ('Élongation quadriceps', 'musculaire', 'Lésion du muscle à l''avant de la cuisse', 14, 35),
  ('Déchirure mollet', 'musculaire', 'Lésion des muscles du mollet (gastrocnémien/soléaire)', 21, 56),
  ('Claquage adducteurs', 'musculaire', 'Lésion des muscles de l''intérieur de la cuisse', 14, 42),
  ('Contusion musculaire', 'musculaire', 'Ecchymose profonde suite à un choc direct', 7, 21),
  ('Tendinopathie patellaire', 'musculaire', 'Inflammation du tendon rotulien', 21, 60),
  ('Tendinopathie d''Achille', 'musculaire', 'Inflammation du tendon d''Achille', 21, 60),
  ('Entorse cheville', 'articulaire', 'Lésion des ligaments de la cheville', 7, 42),
  ('Entorse genou (LLI)', 'ligamentaire', 'Lésion du ligament latéral interne du genou', 21, 56),
  ('Rupture LCA', 'ligamentaire', 'Rupture du ligament croisé antérieur - nécessite chirurgie', 180, 270),
  ('Lésion méniscale', 'articulaire', 'Lésion du ménisque du genou', 42, 90),
  ('Luxation épaule', 'articulaire', 'Déboîtement de l''articulation de l''épaule', 42, 84),
  ('Lésion coiffe des rotateurs', 'musculaire', 'Lésion des muscles stabilisateurs de l''épaule', 28, 84),
  ('Entorse acromio-claviculaire', 'ligamentaire', 'Lésion entre clavicule et omoplate', 14, 56),
  ('Commotion cérébrale', 'neurologique', 'Traumatisme crânien - protocole HIA obligatoire', 14, 42),
  ('Cervicalgie traumatique', 'rachidien', 'Douleur cervicale suite à un traumatisme', 7, 28),
  ('Fracture clavicule', 'osseux', 'Fracture de la clavicule suite à un choc', 42, 84),
  ('Fracture côte', 'osseux', 'Fracture d''une ou plusieurs côtes', 28, 56),
  ('Fracture doigt/main', 'osseux', 'Fracture au niveau de la main ou des doigts', 21, 42),
  ('Fracture de fatigue (tibia)', 'osseux', 'Microfracture due au stress répétitif', 42, 84),
  ('Lombalgie', 'rachidien', 'Douleur lombaire d''origine mécanique', 7, 28),
  ('Pubalgie', 'musculaire', 'Douleur au niveau du pubis et des adducteurs', 42, 120)
) AS v(name, injury_category, description, dmin, dmax)
WHERE NOT EXISTS (
  SELECT 1 FROM public.injury_library il
  WHERE il.name = v.name AND il.is_system_default = true
);