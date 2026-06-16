-- PROPOSAL ONLY: force-logout contract for deterministic all-device behavior.
-- Introduces a server-side flag table used by force_user_logout/check/acknowledge RPCs.

begin;

create table if not exists public."ForceLogoutRequests" (
  "Id" uuid primary key default gen_random_uuid(),
  "MemberId" uuid not null references public."Members"("Id") on delete cascade,
  "RequestedByMemberId" uuid not null references public."Members"("Id") on delete restrict,
  "Reason" text null,
  "RequestedAt" timestamptz not null default timezone('utc', now()),
  "AcknowledgedAt" timestamptz null
);

create index if not exists force_logout_member_pending_idx
  on public."ForceLogoutRequests" ("MemberId", "AcknowledgedAt");

create or replace function public.force_user_logout(p_member_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_member_id uuid;
begin
  select m."Id" into v_admin_member_id
  from public."Members" m
  where m."UserId" = auth.uid()
    and m."IsDeleted" = false
    and m."Role" = 'admin'
  limit 1;

  if v_admin_member_id is null then
    raise exception 'Forbidden: admin only';
  end if;

  insert into public."ForceLogoutRequests" ("MemberId", "RequestedByMemberId", "Reason")
  values (p_member_id, v_admin_member_id, p_reason);

  return jsonb_build_object('success', true, 'message', 'Force logout requested');
end;
$$;

create or replace function public.check_force_logout()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  select "Id" into v_member_id
  from public."Members"
  where "UserId" = auth.uid()
    and "IsDeleted" = false
  limit 1;

  if v_member_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public."ForceLogoutRequests" f
    where f."MemberId" = v_member_id
      and f."AcknowledgedAt" is null
  );
end;
$$;

drop function if exists public.acknowledge_force_logout();

create or replace function public.acknowledge_force_logout()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  select "Id" into v_member_id
  from public."Members"
  where "UserId" = auth.uid()
    and "IsDeleted" = false
  limit 1;

  if v_member_id is null then
    return jsonb_build_object('success', false, 'message', 'Member not found');
  end if;

  update public."ForceLogoutRequests"
  set "AcknowledgedAt" = timezone('utc', now())
  where "MemberId" = v_member_id
    and "AcknowledgedAt" is null;

  return jsonb_build_object('success', true, 'message', 'Force logout acknowledged');
end;
$$;

commit;
