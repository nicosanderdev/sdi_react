-- Allow admin users to create owners regardless of member/company linkage.
-- Relies on the existing public.is_admin() helper defined in 20260316103000_add_members_admin_read_policy.sql.

create policy "Admins can create any owners"
on public."Owners"
for insert
to public
with check (public.is_admin());

