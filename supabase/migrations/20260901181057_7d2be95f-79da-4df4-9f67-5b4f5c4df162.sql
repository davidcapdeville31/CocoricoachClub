create or replace function public.get_category_roster_min(_category_id uuid)
returns table (id uuid, name text, first_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.first_name
  from public.players p
  where (
      p.category_id = _category_id
      or exists (
        select 1 from public.player_categories pc
        where pc.player_id = p.id
          and pc.category_id = _category_id
          and pc.status = 'accepted'
      )
    )
    and p.archived_at is null
    and (
      exists (
        select 1 from public.category_members cm
        where cm.category_id = _category_id and cm.user_id = auth.uid()
      )
      or exists (
        select 1 from public.players me
        where me.user_id = auth.uid()
          and (
            me.category_id = _category_id
            or exists (
              select 1 from public.player_categories pc2
              where pc2.player_id = me.id
                and pc2.category_id = _category_id
                and pc2.status = 'accepted'
            )
          )
      )
    )
  order by p.name;
$$;

grant execute on function public.get_category_roster_min(uuid) to authenticated;