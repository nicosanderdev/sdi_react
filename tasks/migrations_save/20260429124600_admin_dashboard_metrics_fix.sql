-- Fix admin dashboard KPI consistency.
-- - New properties now use EstateProperties.Created
-- - Users without properties is computed (not hardcoded)

begin;

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
  v_new_props_7d bigint;
  v_new_props_30d bigint;
  v_users_without_properties bigint;
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

  select count(*)::bigint into v_new_props_7d
  from public."EstateProperties"
  where "IsDeleted" = false
    and "Created" >= v_7d
    and "Created" <= v_now;

  select count(*)::bigint into v_new_props_30d
  from public."EstateProperties"
  where "IsDeleted" = false
    and "Created" >= v_30d
    and "Created" <= v_now;

  select count(*)::bigint into v_users_without_properties
  from public."Members" m
  where m."IsDeleted" = false
    and not exists (
      select 1
      from public."EstateProperties" ep
      inner join public."Owners" o on o."Id" = ep."OwnerId"
      where ep."IsDeleted" = false
        and o."IsDeleted" = false
        and o."OwnerType" = 'member'
        and o."MemberId" = m."Id"
    );

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
      'usersWithoutProperties', coalesce(v_users_without_properties, 0)
    )
  );
end;
$$;

commit;
