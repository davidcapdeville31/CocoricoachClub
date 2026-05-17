-- ============================================================
-- 1) EXTENSION opponent_profiles : blocs JSONB scouting haut niveau
-- ============================================================
ALTER TABLE public.opponent_profiles
  ADD COLUMN IF NOT EXISTS general_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS kumikata_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tokui_waza jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attack_systems jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS newaza_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tactical_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS physical_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tactical_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS video_sequences jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scouting_notes text,
  ADD COLUMN IF NOT EXISTS danger_level integer,
  ADD COLUMN IF NOT EXISTS last_analyzed_at timestamptz;

-- Contrainte sur danger_level (1-5 étoiles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opponent_profiles_danger_level_chk'
  ) THEN
    ALTER TABLE public.opponent_profiles
      ADD CONSTRAINT opponent_profiles_danger_level_chk
      CHECK (danger_level IS NULL OR (danger_level BETWEEN 1 AND 5));
  END IF;
END $$;

-- Index pour filtres rapides
CREATE INDEX IF NOT EXISTS idx_opponent_profiles_danger_level
  ON public.opponent_profiles(club_id, danger_level DESC NULLS LAST);

-- ============================================================
-- 2) Historisation des analyses (snapshots)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.opponent_analysis_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent_id uuid NOT NULL REFERENCES public.opponent_profiles(id) ON DELETE CASCADE,
  club_id uuid NOT NULL,
  snapshot jsonb NOT NULL,
  author_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opp_history_opp ON public.opponent_analysis_history(opponent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opp_history_club ON public.opponent_analysis_history(club_id, created_at DESC);

ALTER TABLE public.opponent_analysis_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opp_history_select_club" ON public.opponent_analysis_history;
CREATE POLICY "opp_history_select_club"
  ON public.opponent_analysis_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.opponent_profiles op
      WHERE op.id = opponent_analysis_history.opponent_id
        AND op.club_id = opponent_analysis_history.club_id
    )
    AND opponent_analysis_history.club_id IN (
      SELECT cm.club_id FROM public.club_members cm WHERE cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "opp_history_insert_club" ON public.opponent_analysis_history;
CREATE POLICY "opp_history_insert_club"
  ON public.opponent_analysis_history FOR INSERT TO authenticated
  WITH CHECK (
    opponent_analysis_history.club_id IN (
      SELECT cm.club_id FROM public.club_members cm WHERE cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "opp_history_delete_club" ON public.opponent_analysis_history;
CREATE POLICY "opp_history_delete_club"
  ON public.opponent_analysis_history FOR DELETE TO authenticated
  USING (
    opponent_analysis_history.club_id IN (
      SELECT cm.club_id FROM public.club_members cm WHERE cm.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3) Bucket vidéos d'analyse adverse (privé)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'opponent-videos',
  'opponent-videos',
  false,
  209715200, -- 200 MB
  ARRAY['video/mp4','video/quicktime','video/webm','video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS storage: structure attendue {club_id}/{opponent_id}/{filename}
DROP POLICY IF EXISTS "opp_videos_select_club" ON storage.objects;
CREATE POLICY "opp_videos_select_club"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'opponent-videos'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT cm.club_id FROM public.club_members cm WHERE cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "opp_videos_insert_club" ON storage.objects;
CREATE POLICY "opp_videos_insert_club"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'opponent-videos'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT cm.club_id FROM public.club_members cm WHERE cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "opp_videos_update_club" ON storage.objects;
CREATE POLICY "opp_videos_update_club"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'opponent-videos'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT cm.club_id FROM public.club_members cm WHERE cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "opp_videos_delete_club" ON storage.objects;
CREATE POLICY "opp_videos_delete_club"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'opponent-videos'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT cm.club_id FROM public.club_members cm WHERE cm.user_id = auth.uid()
    )
  );