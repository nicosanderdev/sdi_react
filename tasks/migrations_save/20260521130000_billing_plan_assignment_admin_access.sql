-- Admin billing plan visibility: RPC grants + admin SELECT on BillingPlanAssignments.
-- Apply manually after 20260520120001 and 20260520120002 (is_admin helper).
-- Fixes: admin booking confirm → UsageRecords (plan snapshot via security definer RPC).

begin;

-- Ensure is_admin exists (idempotent if 20260520120002 already applied)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and lower(coalesce(m."Role", '')) = 'admin'
  );
$$;

grant execute on function public.get_active_plan_assignment(text, uuid, timestamptz)
  to authenticated, service_role;

grant execute on function public.get_active_member_plan(uuid, timestamptz)
  to authenticated, service_role;

drop policy if exists "BillingPlanAssignments_admin_select" on public."BillingPlanAssignments";
create policy "BillingPlanAssignments_admin_select"
  on public."BillingPlanAssignments"
  for select
  to authenticated
  using (public.is_admin());

commit;
