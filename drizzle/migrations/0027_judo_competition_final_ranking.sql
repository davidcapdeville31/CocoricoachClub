CREATE TABLE public.competition_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  final_ranking text CHECK (final_ranking IS NULL OR final_ranking IN ('1','2','3','5','7','NC')),
  migrated_from_rounds boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_results TO authenticated;
GRANT ALL ON public.competition_results TO service_role;
ALTER TABLE public.competition_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cres_staff_select" ON public.competition_results FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM matches m JOIN categories c ON c.id=m.category_id JOIN clubs cl ON cl.id=c.club_id
    WHERE m.id = competition_results.match_id AND (cl.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM club_members cm WHERE cm.club_id=cl.id AND cm.user_id=auth.uid())
      OR EXISTS (SELECT 1 FROM category_members catm WHERE catm.category_id=c.id AND catm.user_id=auth.uid()))));
CREATE POLICY "cres_staff_write" ON public.competition_results FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM matches m JOIN categories c ON c.id=m.category_id JOIN clubs cl ON cl.id=c.club_id
    WHERE m.id = competition_results.match_id AND (cl.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM club_members cm WHERE cm.club_id=cl.id AND cm.user_id=auth.uid() AND cm.role IN ('admin','coach','administratif'))
      OR EXISTS (SELECT 1 FROM category_members catm WHERE catm.category_id=c.id AND catm.user_id=auth.uid() AND catm.role IN ('admin','coach','administratif')))))
WITH CHECK (
  EXISTS (SELECT 1 FROM matches m JOIN categories c ON c.id=m.category_id JOIN clubs cl ON cl.id=c.club_id
    WHERE m.id = competition_results.match_id AND (cl.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM club_members cm WHERE cm.club_id=cl.id AND cm.user_id=auth.uid() AND cm.role IN ('admin','coach','administratif'))
      OR EXISTS (SELECT 1 FROM category_members catm WHERE catm.category_id=c.id AND catm.user_id=auth.uid() AND catm.role IN ('admin','coach','administratif')))));
CREATE POLICY "cres_athlete_self" ON public.competition_results FOR ALL TO authenticated
  USING (public.player_belongs_to_user(player_id, auth.uid()))
  WITH CHECK (public.player_belongs_to_user(player_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.competition_results_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by); RETURN NEW; END $$;
CREATE TRIGGER trg_competition_results_touch BEFORE INSERT OR UPDATE ON public.competition_results
FOR EACH ROW EXECUTE FUNCTION public.competition_results_touch();

-- Backfill (judo only): take the legacy "last ranked combat" value only when all ranked combats agree.
INSERT INTO public.competition_results (match_id, player_id, final_ranking, migrated_from_rounds)
SELECT j.match_id, j.player_id,
  CASE WHEN j.last IN (1,2,3,5,7) THEN j.last::text END, true
FROM (
  SELECT cr.match_id, cr.player_id,
    count(DISTINCT cr.ranking) FILTER (WHERE cr.ranking > 0) AS d,
    (array_agg(cr.ranking ORDER BY cr.round_number DESC) FILTER (WHERE cr.ranking > 0))[1] AS last
  FROM public.competition_rounds cr
  JOIN public.matches m ON m.id = cr.match_id
  JOIN public.categories c ON c.id = m.category_id
  WHERE c.rugby_type ILIKE '%judo%'
  GROUP BY cr.match_id, cr.player_id
) j
WHERE j.d = 1 AND j.last IN (1,2,3,5,7)
ON CONFLICT (match_id, player_id) DO NOTHING;

COMMENT ON COLUMN public.competition_rounds.ranking IS 'Judo: DEPRECATED for final ranking, replaced by competition_results.final_ranking. Still used by other sports (per-round ranking).';