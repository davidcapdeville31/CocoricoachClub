CREATE OR REPLACE FUNCTION public.has_any_structure_access(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    public.is_super_admin(_uid)
    OR EXISTS (SELECT 1 FROM public.clubs WHERE user_id = _uid)
    OR EXISTS (SELECT 1 FROM public.club_members WHERE user_id = _uid)
    OR EXISTS (SELECT 1 FROM public.category_members WHERE user_id = _uid)
    OR EXISTS (SELECT 1 FROM public.players WHERE user_id = _uid)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_any_structure_access(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_any_structure_access(uuid) TO authenticated;
DROP POLICY IF EXISTS "Authenticated users can read permissions" ON public.role_menu_permissions;
CREATE POLICY "Structure members can read permissions" ON public.role_menu_permissions
  FOR SELECT TO authenticated USING (public.has_any_structure_access(auth.uid()));