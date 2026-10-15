-- Member-scoped property list and statistics (mirror admin list chrome, ownership from auth.uid()).

CREATE OR REPLACE FUNCTION public.get_member_properties_list(
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 10,
  p_scope text DEFAULT 'my'::text,
  p_location text DEFAULT NULL::text,
  p_search text DEFAULT NULL::text,
  p_offer_kind text DEFAULT NULL::text
)
RETURNS TABLE(
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_member_id uuid;
  v_scope text := coalesce(nullif(trim(p_scope), ''), 'my');
  v_company_id uuid := null;
begin
  v_member_id := public.current_member_id();
  if v_member_id is null then
    raise exception 'Forbidden: no member for current user';
  end if;

  if v_scope not in ('my', 'all', 'all-companies') then
    begin
      v_company_id := v_scope::uuid;
    exception when invalid_text_representation then
      return;
    end;

    if not exists (
      select 1
      from public."CompanyMembers" cm
      where cm."CompanyId" = v_company_id
        and cm."MemberId" = v_member_id
        and cm."IsDeleted" = false
    ) then
      return;
    end if;
  end if;

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
        (
          v_scope = 'my'
          and o."OwnerType" = 'member'
          and o."MemberId" = v_member_id
        )
        or (
          v_scope = 'all-companies'
          and o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = v_member_id
              and cm."IsDeleted" = false
          )
        )
        or (
          v_scope = 'all'
          and (
            (o."OwnerType" = 'member' and o."MemberId" = v_member_id)
            or (
              o."OwnerType" = 'company'
              and exists (
                select 1
                from public."CompanyMembers" cm
                where cm."CompanyId" = o."CompanyId"
                  and cm."MemberId" = v_member_id
                  and cm."IsDeleted" = false
              )
            )
          )
        )
        or (
          v_company_id is not null
          and o."OwnerType" = 'company'
          and o."CompanyId" = v_company_id
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
        or nullif(trim(p_location), '') is null
        or ep."City" ilike '%' || p_location || '%'
        or ep."State" ilike '%' || p_location || '%'
        or concat(ep."City", ', ', ep."State") ilike '%' || p_location || '%'
      )
      and (
        p_search is null
        or nullif(trim(p_search), '') is null
        or ll."Title" ilike '%' || p_search || '%'
        or case
          when o."OwnerType" = 'member' then concat(m."FirstName", ' ', m."LastName")
          when o."OwnerType" = 'company' then c."Name"
          else ''
        end ilike '%' || p_search || '%'
        or ep."City" ilike '%' || p_search || '%'
        or ep."State" ilike '%' || p_search || '%'
      )
    order by coalesce(re."Created", ev."Created", sr."Created") desc nulls last
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
  limit greatest(coalesce(p_limit, 10), 1)
  offset ((greatest(coalesce(p_page, 1), 1) - 1) * greatest(coalesce(p_limit, 10), 1));
end;
$$;

COMMENT ON FUNCTION public.get_member_properties_list(integer, integer, text, text, text, text) IS
  'Paginated property list for the current member. p_scope: my | all | all-companies | company uuid.';

CREATE OR REPLACE FUNCTION public.get_member_property_statistics(
  p_scope text DEFAULT 'my'::text
)
RETURNS TABLE(
  total_properties bigint,
  unpublished_properties bigint,
  active_properties bigint,
  archived_properties bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_member_id uuid;
  v_scope text := coalesce(nullif(trim(p_scope), ''), 'my');
  v_company_id uuid := null;
begin
  v_member_id := public.current_member_id();
  if v_member_id is null then
    raise exception 'Forbidden: no member for current user';
  end if;

  if v_scope not in ('my', 'all', 'all-companies') then
    begin
      v_company_id := v_scope::uuid;
    exception when invalid_text_representation then
      return query select 0::bigint, 0::bigint, 0::bigint, 0::bigint;
      return;
    end;

    if not exists (
      select 1
      from public."CompanyMembers" cm
      where cm."CompanyId" = v_company_id
        and cm."MemberId" = v_member_id
        and cm."IsDeleted" = false
    ) then
      return query select 0::bigint, 0::bigint, 0::bigint, 0::bigint;
      return;
    end if;
  end if;

  return query
  with owned as (
    select ep."Id"
    from public."EstateProperties" ep
    join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and (
        (
          v_scope = 'my'
          and o."OwnerType" = 'member'
          and o."MemberId" = v_member_id
        )
        or (
          v_scope = 'all-companies'
          and o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = v_member_id
              and cm."IsDeleted" = false
          )
        )
        or (
          v_scope = 'all'
          and (
            (o."OwnerType" = 'member' and o."MemberId" = v_member_id)
            or (
              o."OwnerType" = 'company'
              and exists (
                select 1
                from public."CompanyMembers" cm
                where cm."CompanyId" = o."CompanyId"
                  and cm."MemberId" = v_member_id
                  and cm."IsDeleted" = false
              )
            )
          )
        )
        or (
          v_company_id is not null
          and o."OwnerType" = 'company'
          and o."CompanyId" = v_company_id
        )
      )
  ),
  totals as (
    select count(*)::bigint as total_properties from owned
  ),
  active as (
    select count(distinct l."EstatePropertyId")::bigint as active_properties
    from public."Listings" l
    join owned o on o."Id" = l."EstatePropertyId"
    where l."IsDeleted" = false
      and l."IsActive" = true
      and l."IsPropertyVisible" = true
  ),
  latest_listing as (
    select distinct on (l."EstatePropertyId")
      l."EstatePropertyId",
      l."IsPropertyVisible"
    from public."Listings" l
    join owned o on o."Id" = l."EstatePropertyId"
    where l."IsDeleted" = false
    order by l."EstatePropertyId", l."Created" desc
  ),
  unpublished as (
    select count(*)::bigint as unpublished_properties
    from owned ep
    left join latest_listing ll on ll."EstatePropertyId" = ep."Id"
    where coalesce(ll."IsPropertyVisible", false) = false
  )
  select
    t.total_properties,
    u.unpublished_properties,
    a.active_properties,
    greatest(t.total_properties - a.active_properties, 0) as archived_properties
  from totals t
  cross join active a
  cross join unpublished u;
end;
$$;

COMMENT ON FUNCTION public.get_member_property_statistics(text) IS
  'Property statistics for the current member. p_scope: my | all | all-companies | company uuid.';

REVOKE ALL ON FUNCTION public.get_member_properties_list(integer, integer, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_member_property_statistics(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_member_properties_list(integer, integer, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_property_statistics(text) TO authenticated;
