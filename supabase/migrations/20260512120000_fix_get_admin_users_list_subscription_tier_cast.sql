-- Re-apply get_admin_users_list so subscription_tier is always integer (plan_tier_code).
-- Fixes: invalid input syntax for type integer: "free" when RETURNS TABLE declares
-- subscription_tier integer but the old body returned text Plans."Key" (e.g. 'free').
-- Tier CASE uses plan_key::text so integer Keys (seed 0,1,2) do not coerce literals to int.
-- Idempotent with 20260506154300_users_filters_type_alignment.sql; use this migration
-- for audit trail or if the database definition drifted from that file.

begin;

drop function if exists public.get_admin_users_list(integer, integer, text, integer, text, date, date, text);

create or replace function public.get_admin_users_list(
  p_page integer default 1,
  p_limit integer default 20,
  p_subscription_status text default null,
  p_subscription_tier integer default null,
  p_account_status text default null,
  p_registration_date_from date default null,
  p_registration_date_to date default null,
  p_search text default null
)
returns table (
  id uuid,
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  avatar_url text,
  role text,
  subscription_status text,
  subscription_tier integer,
  subscription_expires_at timestamptz,
  account_status text,
  registration_date timestamptz,
  last_login timestamptz,
  properties_count bigint,
  payment_status text,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
  v_offset int;
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_lim int := greatest(least(coalesce(p_limit, 20), 200), 1);
begin
  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Forbidden: admin only';
  end if;

  v_offset := (v_page - 1) * v_lim;

  return query
  with base as (
    select
      m."Id" as member_id,
      m."UserId" as uid,
      m."FirstName" as fn,
      m."LastName" as ln,
      m."Email" as em,
      m."AvatarUrl" as av,
      m."Role" as rrole,
      m."Created" as reg,
      m."IsDeleted" as is_del,
      u.last_sign_in_at as llogin,
      u.banned_until as banned_until,
      (
        select count(*)::bigint
        from public."EstateProperties" ep
        join public."Owners" o
          on o."Id" = ep."OwnerId"
         and o."IsDeleted" = false
         and o."OwnerType" = 'member'
         and o."MemberId" = m."Id"
        where ep."IsDeleted" = false
      ) as pcnt,
      (
        select mp."EndDate"
        from public."MemberPlans" mp
        where mp."MemberId" = m."Id"
        order by mp."StartDate" desc
        limit 1
      ) as latest_mp_end,
      (
        select mp."IsActive"
        from public."MemberPlans" mp
        where mp."MemberId" = m."Id"
        order by mp."StartDate" desc
        limit 1
      ) as latest_mp_active,
      (
        select p."Key"
        from public."MemberPlans" mp
        join public."Plans" p on p."Id" = mp."PlanId"
        where mp."MemberId" = m."Id"
        order by mp."StartDate" desc
        limit 1
      ) as plan_key,
      (
        select i."Status"
        from public."Invoices" i
        where i."MemberId" = m."Id"
        order by i."CreatedAt" desc nulls last
        limit 1
      ) as inv_status
    from public."Members" m
    join auth.users u on u.id = m."UserId"
  ),
  computed as (
    select
      b.*,
      case
        when coalesce(b.plan_key::text, '') in ('free', '0') then 0
        when coalesce(b.plan_key::text, '') in ('manager', '1') then 1
        when coalesce(b.plan_key::text, '') = 'company_small' then 2
        when coalesce(b.plan_key::text, '') = 'company_unlimited' then 3
        when coalesce(b.plan_key::text, '') in ('manager_pro', '2') then 4
        else 5
      end as plan_tier_code,
      case
        when not exists (select 1 from public."MemberPlans" mp where mp."MemberId" = b.member_id) then 'none'::text
        when b.latest_mp_active = true and (b.latest_mp_end is null or b.latest_mp_end >= timezone('utc', now())) then 'active'::text
        else 'expired'::text
      end as sub_stat,
      case
        when b.is_del then 'deleted'::text
        when b.banned_until is not null and b.banned_until > timezone('utc', now()) then 'suspended'::text
        else 'active'::text
      end as acct_stat,
      case
        when b.inv_status = 'paid' then 'paid'::text
        when b.inv_status = 'pending' then 'pending'::text
        when b.inv_status is null then 'none'::text
        else 'unknown'::text
      end as pay_stat
    from base b
  ),
  filtered as (
    select *
    from computed c
    where
      (p_search is null
        or coalesce(c.fn, '') ilike '%' || p_search || '%'
        or coalesce(c.ln, '') ilike '%' || p_search || '%'
        or coalesce(c.em, '') ilike '%' || p_search || '%')
      and (p_registration_date_from is null or c.reg::date >= p_registration_date_from)
      and (p_registration_date_to is null or c.reg::date <= p_registration_date_to)
      and (p_subscription_status is null or c.sub_stat = p_subscription_status)
      and (p_subscription_tier is null or c.plan_tier_code = p_subscription_tier)
      and (p_account_status is null or c.acct_stat = p_account_status)
  ),
  counted as (
    select f.*, count(*) over () as tc
    from filtered f
  )
  select
    c.member_id as id,
    c.uid as user_id,
    c.fn::text as first_name,
    c.ln::text as last_name,
    c.em::text as email,
    c.av::text as avatar_url,
    c.rrole::text as role,
    c.sub_stat as subscription_status,
    c.plan_tier_code as subscription_tier,
    c.latest_mp_end as subscription_expires_at,
    c.acct_stat as account_status,
    c.reg as registration_date,
    c.llogin as last_login,
    c.pcnt as properties_count,
    c.pay_stat as payment_status,
    c.tc::bigint as total_count
  from counted c
  order by c.reg desc
  limit v_lim
  offset v_offset;
end;
$$;

commit;
