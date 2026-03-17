create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."Members"
    where "UserId" = auth.uid()
      and "Role" = 'admin'
  );
$$;

create policy "Admins can read any members table record"
on public."Members"
for select
to public
using (
  public.is_admin()
);