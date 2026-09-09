-- Admin dashboard KPI RPC + active user count (admin-only).
-- Apply manually with your usual migration process.
-- Prerequisite: for admin_get_invoices errors, also apply 20260401114000_flexible_billing_admin_invoice_rpcs.sql (and its dependency chain).

begin;

-- ---------------------------------------------------------------------------
-- Active members with auth sign-in within the last N days (admin-only)
-- ---------------------------------------------------------------------------
drop function if exists public.get_active_users_count(integer);

create or replace function public.get_active_users_count(days_back integer default 30)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
  v_days int := coalesce(days_back, 30);
begin
  if v_days < 1 or v_days > 3650 then
    raise exception 'days_back must be between 1 and 3650';
  end if;

  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Forbidden: admin only';
  end if;

  return (
    select count(*)::bigint
    from auth.users u
    inner join public."Members" m on m."UserId" = u.id
    where m."IsDeleted" = false
      and u.last_sign_in_at is not null
      and u.last_sign_in_at >= timezone('utc', now()) - (v_days::text || ' days')::interval
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard stats JSON (parity with AdminService.buildDashboardStatsFallback)
-- ---------------------------------------------------------------------------
drop function if exists public.get_admin_dashboard_stats(text);

create or replace function public.get_admin_dashboard_stats(period text default '30d')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
  v_users bigint;
  v_properties bigint;
  v_active_users bigint;
  v_now timestamptz := timezone('utc', now());
  v_7d timestamptz := v_now - interval '7 days';
  v_30d timestamptz := v_now - interval '30 days';
  v_active_properties int;
  v_new_users_7d bigint;
  v_new_users_30d bigint;
  v_new_props_7d int;
  v_new_props_30d int;
begin
  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Forbidden: admin only';
  end if;

  select count(*) into v_users from public."Members" where "IsDeleted" = false;
  select count(*) into v_properties from public."EstateProperties" where "IsDeleted" = false;

  -- Same rule as get_active_users_count(30): members with auth sign-in in last 30 days
  select count(*)::bigint into v_active_users
  from auth.users u
  inner join public."Members" m on m."UserId" = u.id
  where m."IsDeleted" = false
    and u.last_sign_in_at is not null
    and u.last_sign_in_at >= timezone('utc', now()) - interval '30 days';

  select count(distinct "EstatePropertyId")::int into v_active_properties
  from public."Listings"
  where "IsDeleted" = false
    and "IsActive" = true
    and "IsPropertyVisible" = true;

  select count(*) into v_new_users_7d
  from public."Members"
  where "IsDeleted" = false
    and "Created" >= v_7d
    and "Created" <= v_now;

  select count(*) into v_new_users_30d
  from public."Members"
  where "IsDeleted" = false
    and "Created" >= v_30d
    and "Created" <= v_now;

  select count(distinct "EstatePropertyId")::int into v_new_props_7d
  from public."Listings"
  where "IsDeleted" = false
    and "Created" >= v_7d
    and "Created" <= v_now;

  select count(distinct "EstatePropertyId")::int into v_new_props_30d
  from public."Listings"
  where "IsDeleted" = false
    and "Created" >= v_30d
    and "Created" <= v_now;

  return json_build_object(
    'propertiesCount', v_properties,
    'usersCount', v_users,
    'activeUsers', v_active_users,
    'inactiveUsers', greatest(v_users - coalesce(v_active_users, 0), 0),
    'activeProperties', coalesce(v_active_properties, 0),
    'archivedProperties', greatest(v_properties - coalesce(v_active_properties, 0), 0),
    'subscriptionStats', json_build_object(
      'withoutSubscription', 0,
      'active', 0,
      'expired', 0
    ),
    'mrr', 0,
    'growth', json_build_object(
      'newUsers7d', v_new_users_7d,
      'newUsers30d', v_new_users_30d,
      'newProperties7d', v_new_props_7d,
      'newProperties30d', v_new_props_30d
    ),
    'usageStats', json_build_object(
      'avgPropertiesPerUser',
      case
        when v_users > 0 then (v_properties::numeric / v_users::numeric)
        else 0::numeric
      end,
      'usersWithoutProperties', 0
    )
  );
end;
$$;

commit;
