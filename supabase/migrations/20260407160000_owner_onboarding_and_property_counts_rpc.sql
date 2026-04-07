-- Owner onboarding RPCs (no legacy Subscriptions) + property count RPCs aligned with
-- public.get_dashboard_summary accessible-properties logic (see 20260407102000).
-- Onboarding state uses existing "Members" columns only:
--   "NeedsOnboarding", "EmailVerifiedAt", "PhoneVerifiedAt" (see tasks/public_schema.sql).
-- Tradeoff: numeric step (1-4) is not persisted server-side while "NeedsOnboarding" is true;
-- post-exit steps 5-7 are merged on the client (sessionStorage) in useOwnerOnboarding.
-- Apply manually if you do not auto-run migrations.

begin;

-- ---------------------------------------------------------------------------
-- Caller may act as this member, or be an admin (Members.Role = admin)
-- ---------------------------------------------------------------------------
create or replace function public.member_rpc_caller_ok(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."Members" m
    where m."Id" = p_member_id
      and m."IsDeleted" = false
      and m."UserId" = auth.uid()
  )
  or exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and lower(coalesce(m."Role"::text, '')) = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Count non-deleted EstateProperties accessible to this member (member or company owner)
-- ---------------------------------------------------------------------------
create or replace function public.count_member_accessible_properties(p_member_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  if not public.member_rpc_caller_ok(p_member_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select count(*)::bigint
  into v_count
  from public."EstateProperties" ep
  join public."Owners" o
    on o."Id" = ep."OwnerId"
   and o."IsDeleted" = false
  where ep."IsDeleted" = false
    and (
      (o."OwnerType" = 'member' and o."MemberId" = p_member_id)
      or (
        o."OwnerType" = 'company'
        and exists (
          select 1
          from public."CompanyMembers" cm
          where cm."CompanyId" = o."CompanyId"
            and cm."MemberId" = p_member_id
            and cm."IsDeleted" = false
        )
      )
    );

  return coalesce(v_count, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Published = at least one non-deleted, visible, active listing on an accessible property
-- ---------------------------------------------------------------------------
create or replace function public.count_member_published_properties(p_member_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  if not public.member_rpc_caller_ok(p_member_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  with accessible as (
    select ep."Id"
    from public."EstateProperties" ep
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and (
        (o."OwnerType" = 'member' and o."MemberId" = p_member_id)
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = p_member_id
              and cm."IsDeleted" = false
          )
        )
      )
  )
  select count(distinct l."EstatePropertyId")::bigint
  into v_count
  from public."Listings" l
  join accessible a
    on a."Id" = l."EstatePropertyId"
  where l."IsDeleted" = false
    and l."IsPropertyVisible" = true
    and l."IsActive" = true;

  return coalesce(v_count, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Onboarding state (MemberPlans + Plans; no Subscriptions).
-- Uses "NeedsOnboarding" + verification timestamps only (no extra columns).
-- ---------------------------------------------------------------------------
create or replace function public.get_owner_onboarding_state(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_needs boolean := true;
  v_ev_at timestamptz;
  v_pv_at timestamptz;
  v_lm timestamptz;
  v_step integer;
  v_completed timestamptz;
  v_pub bigint;
  v_plan_limit integer := 5;
  v_plan_key integer := 0;
begin
  if not public.member_rpc_caller_ok(p_member_id) then
    return jsonb_build_object('error', 'forbidden');
  end if;

  select
    m."NeedsOnboarding",
    m."EmailVerifiedAt",
    m."PhoneVerifiedAt",
    m."LastModified"
  into v_needs, v_ev_at, v_pv_at, v_lm
  from public."Members" m
  where m."Id" = p_member_id
    and m."IsDeleted" = false;

  if not found then
    return jsonb_build_object('error', 'member_not_found');
  end if;

  -- Server only tracks coarse flow: in-tour vs exited ("NeedsOnboarding" = false).
  -- Step 5+ after exit is merged with sessionStorage on the client.
  if coalesce(v_needs, true) then
    v_step := 0;
    v_completed := null;
  else
    v_step := 5;
    v_completed := v_lm;
  end if;

  select public.count_member_published_properties(p_member_id)
  into v_pub;

  select
    coalesce(p."ListingLimit", p."MaxPublishedProperties", 5)::integer,
    coalesce(p."Key", 0)::integer
  into v_plan_limit, v_plan_key
  from public.get_active_member_plan(p_member_id) amp
  join public."Plans" p
    on p."Id" = amp.plan_id
  limit 1;

  return jsonb_build_object(
    'current_step', v_step,
    'completed_at', to_jsonb(v_completed),
    'dismissed_at', null,
    'published_properties_count', v_pub,
    'email_verified', (v_ev_at is not null),
    'phone_verified', (v_pv_at is not null),
    'plan_published_limit', coalesce(v_plan_limit, 5),
    'plan_key', coalesce(v_plan_key, 0)
  );
end;
$$;

create or replace function public.update_owner_onboarding_step(
  p_member_id uuid,
  p_step integer,
  p_dismissed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.member_rpc_caller_ok(p_member_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  -- p_step is not persisted (no column); dismiss/exit sets "NeedsOnboarding" = false.
  update public."Members" m
  set
    "NeedsOnboarding" = case
      when p_dismissed then false
      else m."NeedsOnboarding"
    end,
    "LastModified" = timezone('utc', now())
  where m."Id" = p_member_id
    and m."IsDeleted" = false;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.set_owner_onboarding_complete(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.member_rpc_caller_ok(p_member_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  update public."Members" m
  set
    "NeedsOnboarding" = false,
    "LastModified" = timezone('utc', now())
  where m."Id" = p_member_id
    and m."IsDeleted" = false;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.set_member_verification(
  p_member_id uuid,
  p_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.member_rpc_caller_ok(p_member_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if p_type = 'email' then
    update public."Members" m
    set
      "EmailVerifiedAt" = coalesce(m."EmailVerifiedAt", timezone('utc', now())),
      "LastModified" = timezone('utc', now())
    where m."Id" = p_member_id
      and m."IsDeleted" = false;
  elsif p_type = 'phone' then
    update public."Members" m
    set
      "PhoneVerifiedAt" = coalesce(m."PhoneVerifiedAt", timezone('utc', now())),
      "LastModified" = timezone('utc', now())
    where m."Id" = p_member_id
      and m."IsDeleted" = false;
  else
    return jsonb_build_object('success', false, 'error', 'invalid_type');
  end if;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.member_rpc_caller_ok(uuid) to authenticated;
grant execute on function public.count_member_accessible_properties(uuid) to authenticated;
grant execute on function public.count_member_published_properties(uuid) to authenticated;
grant execute on function public.get_owner_onboarding_state(uuid) to authenticated;
grant execute on function public.update_owner_onboarding_step(uuid, integer, boolean) to authenticated;
grant execute on function public.set_owner_onboarding_complete(uuid) to authenticated;
grant execute on function public.set_member_verification(uuid, text) to authenticated;

commit;
