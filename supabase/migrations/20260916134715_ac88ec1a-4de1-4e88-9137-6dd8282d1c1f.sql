DROP POLICY IF EXISTS "Staff manage groups" ON public.player_groups;
CREATE POLICY "Staff manage groups" ON public.player_groups
FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.categories c JOIN public.clubs cl ON cl.id = c.club_id
    WHERE c.id = player_groups.category_id
      AND (cl.user_id = auth.uid() OR public.can_modify_club_data(auth.uid(), cl.id))
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.categories c JOIN public.clubs cl ON cl.id = c.club_id
    WHERE c.id = player_groups.category_id
      AND (cl.user_id = auth.uid() OR public.can_modify_club_data(auth.uid(), cl.id))
  )
);

DROP POLICY IF EXISTS "Staff manage group members" ON public.player_group_members;
CREATE POLICY "Staff manage group members" ON public.player_group_members
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.player_groups g
    JOIN public.categories c ON c.id = g.category_id
    JOIN public.clubs cl ON cl.id = c.club_id
    WHERE g.id = player_group_members.group_id
      AND (public.is_super_admin(auth.uid()) OR cl.user_id = auth.uid() OR public.can_modify_club_data(auth.uid(), cl.id))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.player_groups g
    JOIN public.categories c ON c.id = g.category_id
    JOIN public.clubs cl ON cl.id = c.club_id
    WHERE g.id = player_group_members.group_id
      AND (public.is_super_admin(auth.uid()) OR cl.user_id = auth.uid() OR public.can_modify_club_data(auth.uid(), cl.id))
  )
);