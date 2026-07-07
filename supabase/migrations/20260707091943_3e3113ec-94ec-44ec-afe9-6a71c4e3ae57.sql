CREATE POLICY "Staff can view gps for shared multi-structure players"
ON public.gps_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.player_categories pc
    JOIN public.category_members cm ON cm.category_id = pc.category_id
    WHERE pc.player_id = gps_sessions.player_id
      AND pc.status = 'accepted'
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['admin'::public.app_role, 'coach'::public.app_role, 'prepa_physique'::public.app_role, 'administratif'::public.app_role, 'doctor'::public.app_role])
  )
);

CREATE POLICY "Staff can view hrv for shared multi-structure players"
ON public.hrv_records
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.player_categories pc
    JOIN public.category_members cm ON cm.category_id = pc.category_id
    WHERE pc.player_id = hrv_records.player_id
      AND pc.status = 'accepted'
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['admin'::public.app_role, 'coach'::public.app_role, 'prepa_physique'::public.app_role, 'administratif'::public.app_role, 'doctor'::public.app_role])
  )
);