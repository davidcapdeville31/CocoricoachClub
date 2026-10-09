create table public.arsenal_bank_managers (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

grant select on public.arsenal_bank_managers to authenticated;
grant all on public.arsenal_bank_managers to service_role;

alter table public.arsenal_bank_managers enable row level security;

create policy "Users read own arsenal manager row"
  on public.arsenal_bank_managers for select to authenticated
  using (user_id = auth.uid());

create policy "Super admins manage arsenal managers"
  on public.arsenal_bank_managers for all to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

create or replace function public.is_arsenal_bank_manager(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.arsenal_bank_managers where user_id = _user_id
  )
$$;

insert into public.arsenal_bank_managers (user_id)
values ('444f2df1-4396-420d-b13d-8bf26eafa096');

-- Extend system-ball policies to arsenal bank managers
drop policy "Insert system balls (super admin)" on public.bowling_ball_catalog;
create policy "Insert system balls (super admin or arsenal manager)"
  on public.bowling_ball_catalog for insert to authenticated
  with check (is_system = true and (is_super_admin(auth.uid()) or is_arsenal_bank_manager(auth.uid())));

drop policy "Update system balls (super admin)" on public.bowling_ball_catalog;
create policy "Update system balls (super admin or arsenal manager)"
  on public.bowling_ball_catalog for update to authenticated
  using (is_system = true and (is_super_admin(auth.uid()) or is_arsenal_bank_manager(auth.uid())))
  with check (is_system = true and (is_super_admin(auth.uid()) or is_arsenal_bank_manager(auth.uid())));

drop policy "Delete system balls (super admin)" on public.bowling_ball_catalog;
create policy "Delete system balls (super admin or arsenal manager)"
  on public.bowling_ball_catalog for delete to authenticated
  using (is_system = true and (is_super_admin(auth.uid()) or is_arsenal_bank_manager(auth.uid())));