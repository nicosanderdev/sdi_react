-- Property Management metrics + pagination defaults (manual apply).
-- - Removes incomplete_properties metric from admin property statistics.
-- - Replaces never_published with unpublished_properties based on current visibility.
-- - Changes get_admin_properties_list default p_limit from 20 to 10.

begin;

drop function if exists public.get_admin_property_statistics();

create or replace function public.get_admin_property_statistics()
returns table (
  total_properties bigint,
  unpublished_properties bigint,
  active_properties bigint,
  archived_properties bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
  v_total bigint;
  v_active bigint;
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

  select count(*)::bigint
  into v_total
  from public."EstateProperties" ep
  where ep."IsDeleted" = false;

  select count(distinct l."EstatePropertyId")::bigint
  into v_active
  from public."Listings" l
  where l."IsDeleted" = false
    and l."IsActive" = true
    and l."IsPropertyVisible" = true;

  return query
  with latest_listing as (
    select distinct on (l."EstatePropertyId")
      l."EstatePropertyId",
      l."IsPropertyVisible"
    from public."Listings" l
    where l."IsDeleted" = false
    order by l."EstatePropertyId", l."Created" desc
  )
  select
    v_total as total_properties,
    (
      select count(*)::bigint
      from public."EstateProperties" ep
      left join latest_listing ll
        on ll."EstatePropertyId" = ep."Id"
      where ep."IsDeleted" = false
        and coalesce(ll."IsPropertyVisible", false) = false
    ) as unpublished_properties,
    coalesce(v_active, 0) as active_properties,
    greatest(v_total - coalesce(v_active, 0), 0) as archived_properties;
end;
$$;

create or replace function public.get_admin_properties_list(
  p_page integer default 1,
  p_limit integer default 10,
  p_user_id uuid default null::uuid,
  p_status text default null::text,
  p_location text default null::text,
  p_search text default null::text
)
returns table (
  id uuid,
  title character varying,
  owner_name text,
  owner_email character varying,
  city character varying,
  state character varying,
  status integer,
  is_active boolean,
  is_property_visible boolean,
  created timestamp with time zone,
  last_modified timestamp with time zone,
  total_count bigint
)
language plpgsql
as $$
begin
  return query
  with latest_listing as (
    select distinct on (l."EstatePropertyId")
      l."EstatePropertyId",
      l."Title",
      l."Status",
      l."IsActive",
      l."IsPropertyVisible"
    from public."Listings" l
    where l."IsDeleted" = false
    order by l."EstatePropertyId", l."Created" desc
  ),
  filtered_properties as (
    select
      ep."Id",
      ll."Title" as "Title",
      case
        when o."OwnerType" = 'member' then concat(m."FirstName", ' ', m."LastName")
        when o."OwnerType" = 'company' then c."Name"
        else 'Unknown Owner'
      end as owner_name,
      case
        when o."OwnerType" = 'member' then m."Email"
        when o."OwnerType" = 'company' then c."BillingEmail"
        else null
      end as owner_email,
      ep."City",
      ep."State",
      ll."Status",
      ll."IsActive",
      ll."IsPropertyVisible",
      coalesce(re."Created", ev."Created", sr."Created") as "Created",
      coalesce(re."LastModified", ev."LastModified", sr."LastModified") as "LastModified"
    from public."EstateProperties" ep
    join latest_listing ll on ep."Id" = ll."EstatePropertyId"
    join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
    left join public."Members" m on o."OwnerType" = 'member' and o."MemberId" = m."Id" and m."IsDeleted" = false
    left join public."Companies" c on o."OwnerType" = 'company' and o."CompanyId" = c."Id" and c."IsDeleted" = false
    left join public."RealEstateExtension" re on re."EstatePropertyId" = ep."Id"
    left join public."EventVenueExtension" ev on ev."EstatePropertyId" = ep."Id"
    left join public."SummerRentExtension" sr on sr."EstatePropertyId" = ep."Id"
    where ep."IsDeleted" = false
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
      and (
        p_status is null
        or ll."Status" = case
          when p_status = 'sale' then 0
          when p_status = 'rent' then 1
          when p_status = 'reserved' then 2
          when p_status = 'sold' then 3
          when p_status = 'unavailable' then 4
          else ll."Status"
        end
      )
      and (
        p_location is null
        or ep."City" ilike '%' || p_location || '%'
        or ep."State" ilike '%' || p_location || '%'
        or concat(ep."City", ', ', ep."State") ilike '%' || p_location || '%'
      )
      and (
        p_search is null
        or ll."Title" ilike '%' || p_search || '%'
        or case
          when o."OwnerType" = 'member' then concat(m."FirstName", ' ', m."LastName")
          when o."OwnerType" = 'company' then c."Name"
          else ''
        end ilike '%' || p_search || '%'
        or ep."City" ilike '%' || p_search || '%'
        or ep."State" ilike '%' || p_search || '%'
      )
    order by coalesce(re."Created", ev."Created", sr."Created") desc
  ),
  total_count as (
    select count(*)::bigint as count
    from filtered_properties
  )
  select
    fp."Id",
    fp."Title"::character varying,
    fp.owner_name,
    fp.owner_email::character varying,
    fp."City"::character varying,
    fp."State"::character varying,
    fp."Status",
    fp."IsActive",
    fp."IsPropertyVisible",
    fp."Created",
    fp."LastModified",
    tc.count
  from filtered_properties fp
  cross join total_count tc
  limit p_limit
  offset ((p_page - 1) * p_limit);
end;
$$;

commit;
