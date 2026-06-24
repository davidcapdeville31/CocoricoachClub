-- Restore missing category_members for EDF U19 (category 0e6a72e9-8475-489f-a09c-55d83b01bca4)
INSERT INTO public.category_members (category_id, user_id, role, invited_by)
VALUES
  ('0e6a72e9-8475-489f-a09c-55d83b01bca4', '7a40de25-e2d2-4492-9972-02897fdff548', 'coach', '13eb5245-9ff8-4178-bb3e-4813ba2b39f2'),
  ('0e6a72e9-8475-489f-a09c-55d83b01bca4', 'a18ffce8-305f-4ec0-90f4-6b6330165cf7', 'coach', '13eb5245-9ff8-4178-bb3e-4813ba2b39f2'),
  ('0e6a72e9-8475-489f-a09c-55d83b01bca4', 'eba9bab4-e577-483e-94a6-3c138206f483', 'administratif', '13eb5245-9ff8-4178-bb3e-4813ba2b39f2')
ON CONFLICT (category_id, user_id) DO NOTHING;

-- Ensure assigned_categories in club_members includes EDF U19 for Patrice and Béatrice
UPDATE public.club_members
SET assigned_categories = (
  SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(assigned_categories, ARRAY[]::uuid[]) || ARRAY['0e6a72e9-8475-489f-a09c-55d83b01bca4'::uuid]))
)
WHERE club_id = '00ac261b-4bd1-4a24-b625-776ff64ceb5f'
  AND user_id IN ('7a40de25-e2d2-4492-9972-02897fdff548','eba9bab4-e577-483e-94a6-3c138206f483');