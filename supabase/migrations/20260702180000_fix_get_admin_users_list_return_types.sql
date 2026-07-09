-- Fix 42804: cast Members varchar columns to text in get_admin_users_list return query.
-- Members."FirstName"/"LastName"/"Email"/"AvatarUrl" are character varying; RETURNS TABLE expects text.

CREATE OR REPLACE FUNCTION public.get_admin_users_list(
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 20,
  p_subscription_status text DEFAULT NULL::text,
  p_subscription_tier integer DEFAULT NULL::integer,
  p_account_status text DEFAULT NULL::text,
  p_registration_date_from date DEFAULT NULL::date,
  p_registration_date_to date DEFAULT NULL::date,
  p_search text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  avatar_url text,
  role text,
  subscription_status text,
  subscription_tier integer,
  subscription_expires_at timestamp with time zone,
  account_status text,
  registration_date timestamp with time zone,
  last_login timestamp with time zone,
  properties_count bigint,
  payment_status text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
        select bpa."EndDate"
        from public."BillingPlanAssignments" bpa
        where bpa."SubjectType" = 'member'
          and bpa."MemberOrCompanyId" = m."Id"
        order by bpa."StartDate" desc
        limit 1
      ) as latest_mp_end,
      (
        select bpa."IsActive"
        from public."BillingPlanAssignments" bpa
        where bpa."SubjectType" = 'member'
          and bpa."MemberOrCompanyId" = m."Id"
        order by bpa."StartDate" desc
        limit 1
      ) as latest_mp_active,
      (
        select p."Key"
        from public."BillingPlanAssignments" bpa
        join public."Plans" p on p."Id" = bpa."PlanId"
        where bpa."SubjectType" = 'member'
          and bpa."MemberOrCompanyId" = m."Id"
        order by bpa."StartDate" desc
        limit 1
      ) as plan_key,
      (
        select i."Status"
        from public."Invoices" i
        where i."SubjectType" = 'member'
          and i."MemberOrCompanyId" = m."Id"
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
        when not exists (
          select 1
          from public."BillingPlanAssignments" bpa
          where bpa."SubjectType" = 'member'
            and bpa."MemberOrCompanyId" = b.member_id
        ) then 'none'::text
        when b.latest_mp_active = true
          and (b.latest_mp_end is null or b.latest_mp_end >= timezone('utc', now())) then 'active'::text
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
        or trim(p_search) = ''
        or coalesce(c.fn, '') ilike ('%' || p_search || '%')
        or coalesce(c.ln, '') ilike ('%' || p_search || '%')
        or coalesce(c.em, '') ilike ('%' || p_search || '%')
        or c.member_id::text = p_search
        or c.uid::text = p_search)
      and (p_subscription_status is null or c.sub_stat = p_subscription_status)
      and (p_subscription_tier is null or c.plan_tier_code = p_subscription_tier)
      and (p_account_status is null or c.acct_stat = p_account_status)
      and (p_registration_date_from is null or c.reg::date >= p_registration_date_from)
      and (p_registration_date_to is null or c.reg::date <= p_registration_date_to)
  ),
  counted as (
    select count(*)::bigint as cnt from filtered
  )
  select
    f.member_id as id,
    f.uid as user_id,
    f.fn::text as first_name,
    f.ln::text as last_name,
    f.em::text as email,
    f.av::text as avatar_url,
    f.rrole as role,
    f.sub_stat as subscription_status,
    f.plan_tier_code as subscription_tier,
    f.latest_mp_end as subscription_expires_at,
    f.acct_stat as account_status,
    f.reg as registration_date,
    f.llogin as last_login,
    f.pcnt as properties_count,
    f.pay_stat as payment_status,
    (select cnt from counted) as total_count
  from filtered f
  order by f.reg desc nulls last
  offset v_offset
  limit v_lim;
end;
$$;
