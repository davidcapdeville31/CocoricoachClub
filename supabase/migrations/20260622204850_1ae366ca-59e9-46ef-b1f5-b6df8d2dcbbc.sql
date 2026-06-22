-- Add author metadata
ALTER TABLE public.admin_documents
  ADD COLUMN IF NOT EXISTS created_by_role text,
  ADD COLUMN IF NOT EXISTS original_filename text;

-- Helper: is the user the owner of this player profile
CREATE OR REPLACE FUNCTION public.is_player_owner(_user_id uuid, _player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE id = _player_id AND user_id = _user_id
  )
$$;

-- Helper: does the user have an athlete player record in this category
CREATE OR REPLACE FUNCTION public.is_category_athlete(_user_id uuid, _category_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE user_id = _user_id AND category_id = _category_id
  )
$$;

-- Replace the catch-all policies with finer ones
DROP POLICY IF EXISTS "Users can insert documents in their categories" ON public.admin_documents;
DROP POLICY IF EXISTS "Users can update documents in their categories" ON public.admin_documents;
DROP POLICY IF EXISTS "Users can delete documents in their categories" ON public.admin_documents;

CREATE POLICY "Users can insert documents in their categories"
ON public.admin_documents
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.can_access_category(auth.uid(), category_id)
  AND (
    -- Staff (not registered as athlete in this category) can add for team or any player
    NOT public.is_category_athlete(auth.uid(), category_id)
    OR
    -- Athlete can only add for their own profile
    (player_id IS NOT NULL AND public.is_player_owner(auth.uid(), player_id))
  )
);

CREATE POLICY "Users can update documents in their categories"
ON public.admin_documents
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR (
    public.can_access_category(auth.uid(), category_id)
    AND NOT public.is_category_athlete(auth.uid(), category_id)
  )
);

CREATE POLICY "Users can delete documents in their categories"
ON public.admin_documents
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR (
    public.can_access_category(auth.uid(), category_id)
    AND NOT public.is_category_athlete(auth.uid(), category_id)
  )
);

-- Tag legacy documents without metadata
UPDATE public.admin_documents
SET created_by_role = 'legacy'
WHERE created_by_role IS NULL;
