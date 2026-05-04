
-- 1. Ajouter colonnes
ALTER TABLE public.custom_tests
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cloned_from_system_id uuid REFERENCES public.custom_tests(id) ON DELETE SET NULL;

-- 2. Rendre club_id nullable pour permettre les tests système globaux
ALTER TABLE public.custom_tests ALTER COLUMN club_id DROP NOT NULL;

-- 3. Contrainte: un test système n'a pas de club, un test custom en a un
ALTER TABLE public.custom_tests DROP CONSTRAINT IF EXISTS custom_tests_system_or_club_check;
ALTER TABLE public.custom_tests
  ADD CONSTRAINT custom_tests_system_or_club_check
  CHECK ((is_system = true AND club_id IS NULL) OR (is_system = false AND club_id IS NOT NULL));

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_custom_tests_is_system ON public.custom_tests(is_system) WHERE is_system = true;
CREATE INDEX IF NOT EXISTS idx_custom_tests_cloned_from ON public.custom_tests(cloned_from_system_id) WHERE cloned_from_system_id IS NOT NULL;

-- 5. RLS policies actualisées
DROP POLICY IF EXISTS "Club members can view custom tests" ON public.custom_tests;
DROP POLICY IF EXISTS "Club admins can manage custom tests" ON public.custom_tests;
DROP POLICY IF EXISTS "Anyone can view system tests" ON public.custom_tests;
DROP POLICY IF EXISTS "Club members can view own custom tests" ON public.custom_tests;
DROP POLICY IF EXISTS "Club admins can manage own custom tests" ON public.custom_tests;
DROP POLICY IF EXISTS "Super admins manage system tests" ON public.custom_tests;

-- Tout authentifié peut voir les tests système
CREATE POLICY "Anyone can view system tests"
  ON public.custom_tests FOR SELECT TO authenticated
  USING (is_system = true);

-- Membres du club peuvent voir leurs tests custom
CREATE POLICY "Club members can view own custom tests"
  ON public.custom_tests FOR SELECT TO authenticated
  USING (is_system = false AND club_id IS NOT NULL AND can_access_club(auth.uid(), club_id));

-- Admins du club peuvent gérer leurs tests custom
CREATE POLICY "Club admins can manage own custom tests"
  ON public.custom_tests FOR ALL TO authenticated
  USING (is_system = false AND club_id IS NOT NULL AND can_modify_club_data(auth.uid(), club_id))
  WITH CHECK (is_system = false AND club_id IS NOT NULL AND can_modify_club_data(auth.uid(), club_id));

-- Super-admins gèrent les tests système
CREATE POLICY "Super admins manage system tests"
  ON public.custom_tests FOR ALL TO authenticated
  USING (is_system = true AND public.is_super_admin(auth.uid()))
  WITH CHECK (is_system = true AND public.is_super_admin(auth.uid()));

-- 6. RPC: cloner un test système vers un club (override local)
CREATE OR REPLACE FUNCTION public.clone_system_test_to_club(_system_test_id uuid, _club_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF NOT can_modify_club_data(v_user, _club_id) THEN
    RAISE EXCEPTION 'Permissions insuffisantes';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM custom_tests WHERE id = _system_test_id AND is_system = true) THEN
    RAISE EXCEPTION 'Test système introuvable';
  END IF;

  -- Évite les doublons : si déjà cloné dans ce club, retourne l'existant
  SELECT id INTO v_new_id FROM custom_tests
   WHERE club_id = _club_id AND cloned_from_system_id = _system_test_id
   LIMIT 1;
  IF v_new_id IS NOT NULL THEN
    RETURN v_new_id;
  END IF;

  INSERT INTO custom_tests (
    club_id, created_by, name, test_category, unit, is_time, description,
    unit_kind, scoring_scale, max_points, objectives, image_url, formula_config, video_url, bilateral,
    is_system, cloned_from_system_id
  )
  SELECT _club_id, v_user, name, test_category, unit, is_time, description,
         unit_kind, scoring_scale, max_points, objectives, image_url, formula_config, video_url, bilateral,
         false, id
    FROM custom_tests WHERE id = _system_test_id
  RETURNING id INTO v_new_id;

  -- Copier les catégories liées
  INSERT INTO custom_test_categories (custom_test_id, category_id)
  SELECT v_new_id, category_id
    FROM custom_test_categories
   WHERE custom_test_id = _system_test_id
  ON CONFLICT DO NOTHING;

  RETURN v_new_id;
END;
$$;
