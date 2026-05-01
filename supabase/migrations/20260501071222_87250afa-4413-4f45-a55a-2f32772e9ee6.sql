-- ============================================
-- PHASE 1 : IDENTITÉ ATHLÈTE — Socle multi-dim
-- ============================================

-- 1. ENUM des dimensions
DO $$ BEGIN
  CREATE TYPE public.athlete_attribute_dimension AS ENUM (
    'position',
    'discipline',
    'style',
    'performance_profile',
    'level',
    'laterality',
    'specialty',
    'role'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. TABLE athlete_attributes
CREATE TABLE IF NOT EXISTS public.athlete_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  dimension public.athlete_attribute_dimension NOT NULL,
  value TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  weight NUMERIC(5,2) CHECK (weight IS NULL OR (weight >= 0 AND weight <= 100)),
  sport_context TEXT,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, dimension, value, sport_context)
);

CREATE INDEX IF NOT EXISTS idx_athlete_attributes_player ON public.athlete_attributes(player_id);
CREATE INDEX IF NOT EXISTS idx_athlete_attributes_dim ON public.athlete_attributes(dimension);
CREATE INDEX IF NOT EXISTS idx_athlete_attributes_primary ON public.athlete_attributes(player_id, dimension) WHERE is_primary;
CREATE INDEX IF NOT EXISTS idx_athlete_attributes_value ON public.athlete_attributes(dimension, value);

-- Trigger updated_at
CREATE TRIGGER trg_athlete_attributes_updated_at
BEFORE UPDATE ON public.athlete_attributes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger : un seul primary par (player, dimension, sport_context)
CREATE OR REPLACE FUNCTION public.enforce_single_primary_attribute()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.athlete_attributes
    SET is_primary = false
    WHERE player_id = NEW.player_id
      AND dimension = NEW.dimension
      AND COALESCE(sport_context, '') = COALESCE(NEW.sport_context, '')
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_athlete_attributes_single_primary
BEFORE INSERT OR UPDATE ON public.athlete_attributes
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_primary_attribute();

-- 3. TABLE sports_config (référentiel multi-sport)
CREATE TABLE IF NOT EXISTS public.sports_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_code TEXT NOT NULL,
  dimension public.athlete_attribute_dimension NOT NULL,
  allowed_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_primary_required BOOLEAN NOT NULL DEFAULT false,
  multi_select_allowed BOOLEAN NOT NULL DEFAULT true,
  weight_required BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sport_code, dimension)
);

CREATE INDEX IF NOT EXISTS idx_sports_config_sport ON public.sports_config(sport_code);

CREATE TRIGGER trg_sports_config_updated_at
BEFORE UPDATE ON public.sports_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. FONCTION compute_age_category (dynamique selon date)
CREATE OR REPLACE FUNCTION public.compute_age_category(_birth_date DATE, _ref_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _birth_date IS NULL THEN NULL
    WHEN AGE(_ref_date, _birth_date) < INTERVAL '15 years' THEN 'U15'
    WHEN AGE(_ref_date, _birth_date) < INTERVAL '17 years' THEN 'U17'
    WHEN AGE(_ref_date, _birth_date) < INTERVAL '18 years' THEN 'U18'
    WHEN AGE(_ref_date, _birth_date) < INTERVAL '19 years' THEN 'U19'
    WHEN AGE(_ref_date, _birth_date) < INTERVAL '21 years' THEN 'U21'
    WHEN AGE(_ref_date, _birth_date) < INTERVAL '23 years' THEN 'U23'
    WHEN AGE(_ref_date, _birth_date) < INTERVAL '35 years' THEN 'Senior'
    WHEN AGE(_ref_date, _birth_date) < INTERVAL '45 years' THEN 'Master'
    ELSE 'Veteran'
  END
$$;

-- 5. VUE player_tags (calculée à la volée — toujours à jour)
CREATE OR REPLACE VIEW public.player_tags 
WITH (security_invoker = true)
AS
SELECT
  p.id AS player_id,
  p.category_id,
  jsonb_build_object(
    'genre', p.gender,
    'age_category', public.compute_age_category(p.birth_date),
    'birth_year', EXTRACT(YEAR FROM p.birth_date)::int,
    'sport', c.rugby_type,
    'sport_gender', c.gender,
    'positions_all', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('value', value, 'weight', weight, 'is_primary', is_primary) ORDER BY is_primary DESC, weight DESC NULLS LAST)
       FROM public.athlete_attributes WHERE player_id = p.id AND dimension = 'position' AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)),
      '[]'::jsonb
    ),
    'position_primary', (
      SELECT value FROM public.athlete_attributes 
      WHERE player_id = p.id AND dimension = 'position' AND is_primary 
      LIMIT 1
    ),
    'disciplines_all', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('value', value, 'weight', weight, 'is_primary', is_primary) ORDER BY is_primary DESC, weight DESC NULLS LAST)
       FROM public.athlete_attributes WHERE player_id = p.id AND dimension = 'discipline' AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)),
      '[]'::jsonb
    ),
    'discipline_primary', (
      SELECT value FROM public.athlete_attributes 
      WHERE player_id = p.id AND dimension = 'discipline' AND is_primary 
      LIMIT 1
    ),
    'styles', COALESCE(
      (SELECT jsonb_agg(value ORDER BY is_primary DESC, weight DESC NULLS LAST)
       FROM public.athlete_attributes WHERE player_id = p.id AND dimension = 'style' AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)),
      '[]'::jsonb
    ),
    'specialties', COALESCE(
      (SELECT jsonb_agg(value ORDER BY is_primary DESC)
       FROM public.athlete_attributes WHERE player_id = p.id AND dimension = 'specialty' AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)),
      '[]'::jsonb
    ),
    'performance_profile', (
      SELECT value FROM public.athlete_attributes 
      WHERE player_id = p.id AND dimension = 'performance_profile' AND is_primary 
      LIMIT 1
    ),
    'laterality', (
      SELECT value FROM public.athlete_attributes 
      WHERE player_id = p.id AND dimension = 'laterality' AND is_primary 
      LIMIT 1
    ),
    'level', (
      SELECT value FROM public.athlete_attributes 
      WHERE player_id = p.id AND dimension = 'level' AND is_primary 
      LIMIT 1
    )
  ) AS tags,
  -- Format à plat pour filtres rapides : ["genre:male","age:U18","sport:rugby_xv","poste:pilier"]
  (
    SELECT array_agg(DISTINCT t)
    FROM (
      SELECT 'genre:' || p.gender AS t WHERE p.gender IS NOT NULL
      UNION ALL
      SELECT 'age:' || public.compute_age_category(p.birth_date) WHERE p.birth_date IS NOT NULL
      UNION ALL
      SELECT 'sport:' || c.rugby_type WHERE c.rugby_type IS NOT NULL
      UNION ALL
      SELECT dimension::text || ':' || value
      FROM public.athlete_attributes
      WHERE player_id = p.id AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
    ) sub
  ) AS flat_tags
FROM public.players p
LEFT JOIN public.categories c ON c.id = p.category_id;

GRANT SELECT ON public.player_tags TO authenticated, anon;

-- 6. FONCTION get_player_attributes_by_dimension
CREATE OR REPLACE FUNCTION public.get_player_attributes_by_dimension(
  _player_id UUID,
  _dimension public.athlete_attribute_dimension
)
RETURNS TABLE (
  value TEXT,
  is_primary BOOLEAN,
  weight NUMERIC,
  sport_context TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT value, is_primary, weight, sport_context
  FROM public.athlete_attributes
  WHERE player_id = _player_id 
    AND dimension = _dimension
    AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
  ORDER BY is_primary DESC, weight DESC NULLS LAST, value ASC
$$;

-- 7. RLS sur athlete_attributes
ALTER TABLE public.athlete_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view athlete attributes"
ON public.athlete_attributes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.players pl
    WHERE pl.id = athlete_attributes.player_id
      AND public.can_access_category(auth.uid(), pl.category_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.players pl
    WHERE pl.id = athlete_attributes.player_id AND pl.user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Staff can manage athlete attributes"
ON public.athlete_attributes FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.players pl
    JOIN public.categories c ON c.id = pl.category_id
    WHERE pl.id = athlete_attributes.player_id
      AND public.can_modify_club_data(auth.uid(), c.club_id)
  )
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players pl
    JOIN public.categories c ON c.id = pl.category_id
    WHERE pl.id = athlete_attributes.player_id
      AND public.can_modify_club_data(auth.uid(), c.club_id)
  )
  OR public.is_super_admin(auth.uid())
);

-- 8. RLS sur sports_config (lecture publique authentifiée)
ALTER TABLE public.sports_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read sports config"
ON public.sports_config FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Super admin can manage sports config"
ON public.sports_config FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 9. SEED initial sports_config (rugby, foot, basket, hand, athlé, bowling, tennis, padel, ski, snow, surf, judo, golf)
INSERT INTO public.sports_config (sport_code, dimension, allowed_values, default_primary_required, multi_select_allowed, weight_required, display_order) VALUES
-- Rugby XV
('XV', 'position', '["pilier_gauche","talonneur","pilier_droit","2eme_ligne","3eme_ligne_aile","3eme_ligne_centre","demi_de_melee","demi_d_ouverture","centre","ailier","arriere"]'::jsonb, true, true, true, 10),
('XV', 'role', '["avant","arriere","specialiste_touche","specialiste_melee","buteur"]'::jsonb, false, true, false, 20),
-- Rugby 7
('7', 'position', '["avant","demi","centre","ailier"]'::jsonb, true, true, true, 10),
-- Football
('football', 'position', '["gardien","defenseur_central","lateral_gauche","lateral_droit","milieu_defensif","milieu_central","milieu_offensif","ailier_gauche","ailier_droit","attaquant"]'::jsonb, true, true, true, 10),
('football', 'laterality', '["pied_droit","pied_gauche","ambidextre"]'::jsonb, true, false, false, 30),
-- Basket
('basket', 'position', '["meneur","arriere","ailier","ailier_fort","pivot"]'::jsonb, true, true, true, 10),
-- Hand
('handball', 'position', '["gardien","arriere_gauche","arriere_central","arriere_droit","demi_centre","ailier_gauche","ailier_droit","pivot"]'::jsonb, true, true, true, 10),
-- Volley
('volley', 'position', '["passeur","attaquant_recepteur","central","libero","pointu"]'::jsonb, true, true, true, 10),
-- Athlétisme
('athletisme', 'discipline', '["100m","200m","400m","800m","1500m","5000m","10000m","marathon","110m_haies","400m_haies","3000m_steeple","longueur","triple_saut","hauteur","perche","poids","disque","javelot","marteau","decathlon","heptathlon","relais"]'::jsonb, true, true, true, 10),
-- Bowling
('bowling', 'style', '["1_main","2_mains","thumbless","plastic_bowler"]'::jsonb, true, true, false, 10),
('bowling', 'laterality', '["droitier","gaucher"]'::jsonb, true, false, false, 20),
-- Tennis
('tennis', 'style', '["fond_de_court","attaquant","contre_attaquant","tout_terrain","serveur_volleyeur"]'::jsonb, false, true, false, 10),
('tennis', 'laterality', '["droitier","gaucher","revers_1_main","revers_2_mains"]'::jsonb, true, true, false, 20),
('tennis', 'specialty', '["simple","double","mixte"]'::jsonb, false, true, false, 30),
-- Padel
('padel', 'position', '["droite","gauche","polyvalent"]'::jsonb, true, true, false, 10),
('padel', 'laterality', '["droitier","gaucher"]'::jsonb, true, false, false, 20),
-- Ski alpin
('ski_alpin', 'discipline', '["slalom","slalom_geant","super_g","descente","combine"]'::jsonb, true, true, true, 10),
-- Snowboard
('snowboard', 'discipline', '["slalom_parallele","slalom_geant_parallele","snowboard_cross","halfpipe","slopestyle","big_air"]'::jsonb, true, true, true, 10),
('snowboard', 'laterality', '["regular","goofy"]'::jsonb, true, false, false, 20),
-- Surf
('surf', 'laterality', '["regular","goofy"]'::jsonb, true, false, false, 20),
('surf', 'style', '["shortboard","longboard","big_wave","aerial"]'::jsonb, false, true, false, 10),
-- Judo
('judo', 'specialty', '["uchimata","seoi_nage","osoto_gari","tai_otoshi","ouchi_gari","harai_goshi","sasae_tsuri_komi_ashi","kosoto_gari","tomoe_nage","kata_guruma"]'::jsonb, false, true, false, 10),
('judo', 'laterality', '["droitier","gaucher"]'::jsonb, true, false, false, 20),
-- Golf
('golf', 'laterality', '["droitier","gaucher"]'::jsonb, true, false, false, 20),
('golf', 'style', '["puissance","precision","short_game","stratege"]'::jsonb, false, true, false, 10)
ON CONFLICT (sport_code, dimension) DO NOTHING;

-- Dimensions universelles (tous sports)
INSERT INTO public.sports_config (sport_code, dimension, allowed_values, default_primary_required, multi_select_allowed, weight_required, display_order) VALUES
('*', 'level', '["loisir","amateur","competition","elite","centre_de_formation","professionnel","international"]'::jsonb, false, false, false, 50),
('*', 'performance_profile', '["explosif","enduant","puissant","technique","polyvalent","vitesse","force","tactique"]'::jsonb, false, true, true, 60)
ON CONFLICT (sport_code, dimension) DO NOTHING;

-- 10. BACKFILL : copier les positions existantes vers athlete_attributes
INSERT INTO public.athlete_attributes (player_id, dimension, value, is_primary, source)
SELECT id, 'position'::public.athlete_attribute_dimension, position, true, 'backfill_v1'
FROM public.players
WHERE position IS NOT NULL AND position != ''
ON CONFLICT (player_id, dimension, value, sport_context) DO NOTHING;

-- Backfill : disciplines (athlétisme + ski + snowboard + surf)
INSERT INTO public.athlete_attributes (player_id, dimension, value, is_primary, source)
SELECT id, 'discipline'::public.athlete_attribute_dimension, discipline, true, 'backfill_v1'
FROM public.players
WHERE discipline IS NOT NULL AND discipline != ''
ON CONFLICT (player_id, dimension, value, sport_context) DO NOTHING;

-- Backfill : disciplines secondaires (athlétisme — colonne disciplines[])
INSERT INTO public.athlete_attributes (player_id, dimension, value, is_primary, source)
SELECT 
  p.id, 
  'discipline'::public.athlete_attribute_dimension, 
  d, 
  false, 
  'backfill_v1'
FROM public.players p,
     LATERAL unnest(COALESCE(p.disciplines, '{}'::text[])) AS d
WHERE d IS NOT NULL AND d != '' AND d != COALESCE(p.discipline, '')
ON CONFLICT (player_id, dimension, value, sport_context) DO NOTHING;

-- Backfill : specialty
INSERT INTO public.athlete_attributes (player_id, dimension, value, is_primary, source)
SELECT id, 'specialty'::public.athlete_attribute_dimension, specialty, true, 'backfill_v1'
FROM public.players
WHERE specialty IS NOT NULL AND specialty != ''
ON CONFLICT (player_id, dimension, value, sport_context) DO NOTHING;

-- Backfill : specialties[] (secondaires)
INSERT INTO public.athlete_attributes (player_id, dimension, value, is_primary, source)
SELECT 
  p.id, 
  'specialty'::public.athlete_attribute_dimension, 
  s, 
  false, 
  'backfill_v1'
FROM public.players p,
     LATERAL unnest(COALESCE(p.specialties, '{}'::text[])) AS s
WHERE s IS NOT NULL AND s != '' AND s != COALESCE(p.specialty, '')
ON CONFLICT (player_id, dimension, value, sport_context) DO NOTHING;