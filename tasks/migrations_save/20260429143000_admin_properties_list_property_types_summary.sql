-- Admin property list: add property_types_summary (Spanish offer-type labels).
-- Apply manually. Same RPC args as 20260429140000; adds one return column.

begin;

drop function if exists public.get_admin_properties_list(integer, integer, uuid, text, text, text);

create or replace function public.get_admin_properties_list(
  p_page integer default 1,
  p_limit integer default 10,
  p_user_id uuid default null::uuid,
  p_location text default null::text,
  p_search text default null::text,
  p_offer_kind text default null::text
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
  property_types_summary text,
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
      coalesce(re."LastModified", ev."LastModified", sr."LastModified") as "LastModified",
      nullif(
        trim(both from concat_ws(', ',
          case when exists (
            select 1
            from public."Listings" lx
            where lx."EstatePropertyId" = ep."Id"
              and lx."IsDeleted" = false
              and lx."ListingType" = 'RealEstate'::public."ListingType"
          ) then 'En venta' end,
          case when exists (
            select 1
            from public."Listings" lx
            where lx."EstatePropertyId" = ep."Id"
              and lx."IsDeleted" = false
              and lx."ListingType" = 'AnnualRent'::public."ListingType"
          ) then 'En alquiler' end,
          case when
            exists (select 1 from public."SummerRentExtension" sx where sx."EstatePropertyId" = ep."Id")
            or exists (
              select 1
              from public."Listings" lx
              where lx."EstatePropertyId" = ep."Id"
                and lx."IsDeleted" = false
                and lx."ListingType" = 'SummerRent'::public."ListingType"
            )
          then 'Alquiler de temporada' end,
          case when
            exists (select 1 from public."EventVenueExtension" ex where ex."EstatePropertyId" = ep."Id")
            or exists (
              select 1
              from public."Listings" lx
              where lx."EstatePropertyId" = ep."Id"
                and lx."IsDeleted" = false
                and lx."ListingType" = 'EventVenue'::public."ListingType"
            )
          then 'Eventos' end
        )),
        ''
      ) as property_types_summary
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
        p_offer_kind is null
        or p_offer_kind not in ('real_estate', 'annual_rent', 'summer_rent', 'event_venue')
        or (
          (p_offer_kind = 'real_estate' and exists (
            select 1
            from public."Listings" lx
            where lx."EstatePropertyId" = ep."Id"
              and lx."IsDeleted" = false
              and lx."ListingType" = 'RealEstate'::public."ListingType"
          ))
          or (p_offer_kind = 'annual_rent' and exists (
            select 1
            from public."Listings" lx
            where lx."EstatePropertyId" = ep."Id"
              and lx."IsDeleted" = false
              and lx."ListingType" = 'AnnualRent'::public."ListingType"
          ))
          or (p_offer_kind = 'summer_rent' and (
            exists (
              select 1
              from public."SummerRentExtension" sx
              where sx."EstatePropertyId" = ep."Id"
            )
            or exists (
              select 1
              from public."Listings" lx
              where lx."EstatePropertyId" = ep."Id"
                and lx."IsDeleted" = false
                and lx."ListingType" = 'SummerRent'::public."ListingType"
            )
          ))
          or (p_offer_kind = 'event_venue' and (
            exists (
              select 1
              from public."EventVenueExtension" ex
              where ex."EstatePropertyId" = ep."Id"
            )
            or exists (
              select 1
              from public."Listings" lx
              where lx."EstatePropertyId" = ep."Id"
                and lx."IsDeleted" = false
                and lx."ListingType" = 'EventVenue'::public."ListingType"
            )
          ))
        )
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
    fp.property_types_summary,
    tc.count
  from filtered_properties fp
  cross join total_count tc
  limit p_limit
  offset ((p_page - 1) * p_limit);
end;
$$;

commit;
