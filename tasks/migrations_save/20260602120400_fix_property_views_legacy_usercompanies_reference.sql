-- Fix legacy property view RPCs that still reference "UserCompanies".
-- Manual apply intended: redefines RPCs to use "CompanyMembers".

begin;

create or replace function public.get_property_views(
  p_property_id uuid,
  p_period text default 'last30days',
  p_user_id uuid default null::uuid
)
returns table (
  date date,
  count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz := timezone('utc', now());
begin
  case lower(coalesce(p_period, 'last30days'))
    when 'last7days' then v_start := v_end - interval '7 days';
    when 'last30days' then v_start := v_end - interval '30 days';
    when 'last90days' then v_start := v_end - interval '90 days';
    when 'thisyear' then v_start := date_trunc('year', v_end);
    else v_start := v_end - interval '30 days';
  end case;

  return query
  select
    date_trunc('day', pvl."VisitedOnUtc")::date as date,
    count(*)::bigint as count
  from public."PropertyVisitLogs" pvl
  join public."EstateProperties" ep
    on ep."Id" = pvl."PropertyId"
   and ep."IsDeleted" = false
  join public."Owners" o
    on o."Id" = ep."OwnerId"
   and o."IsDeleted" = false
  where pvl."PropertyId" = p_property_id
    and pvl."VisitedOnUtc" >= v_start
    and pvl."VisitedOnUtc" <= v_end
    and (
      p_user_id is null
      or (
        (o."OwnerType" = 'member' and o."MemberId" = p_user_id)
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = p_user_id
              and cm."IsDeleted" = false
          )
        )
      )
    )
  group by 1
  order by 1;
end;
$$;

create or replace function public.get_property_views_by_source(
  p_property_id uuid,
  p_period text default 'last30days',
  p_user_id uuid default null::uuid
)
returns table (
  source text,
  visits bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz := timezone('utc', now());
begin
  case lower(coalesce(p_period, 'last30days'))
    when 'last7days' then v_start := v_end - interval '7 days';
    when 'last30days' then v_start := v_end - interval '30 days';
    when 'last90days' then v_start := v_end - interval '90 days';
    when 'thisyear' then v_start := date_trunc('year', v_end);
    else v_start := v_end - interval '30 days';
  end case;

  return query
  select
    coalesce(nullif(trim(pvl."Source"), ''), 'website')::text as source,
    count(*)::bigint as visits
  from public."PropertyVisitLogs" pvl
  join public."EstateProperties" ep
    on ep."Id" = pvl."PropertyId"
   and ep."IsDeleted" = false
  join public."Owners" o
    on o."Id" = ep."OwnerId"
   and o."IsDeleted" = false
  where pvl."PropertyId" = p_property_id
    and pvl."VisitedOnUtc" >= v_start
    and pvl."VisitedOnUtc" <= v_end
    and (
      p_user_id is null
      or (
        (o."OwnerType" = 'member' and o."MemberId" = p_user_id)
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = p_user_id
              and cm."IsDeleted" = false
          )
        )
      )
    )
  group by 1
  order by 2 desc, 1 asc;
end;
$$;

commit;
