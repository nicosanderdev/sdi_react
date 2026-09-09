-- Phase 1 exit fixes: enforce publish caps on create_listing_version,
-- and rebuild duplicate_estate_property with correct member resolution + plan limits.

CREATE OR REPLACE FUNCTION public.create_listing_version(
  p_estate_property_id uuid,
  p_listing_type text,
  p_title text,
  p_description text DEFAULT NULL::text,
  p_available_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_currency integer DEFAULT 0,
  p_sale_price double precision DEFAULT NULL::double precision,
  p_rent_price double precision DEFAULT NULL::double precision,
  p_rent_price_period text DEFAULT NULL::text,
  p_is_price_visible boolean DEFAULT true,
  p_is_active boolean DEFAULT true,
  p_is_property_visible boolean DEFAULT true,
  p_blocked_for_booking boolean DEFAULT false,
  p_base_price numeric DEFAULT NULL::numeric,
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_long_stay_discount_enabled boolean DEFAULT false,
  p_long_stay_min_days integer DEFAULT NULL::integer,
  p_long_stay_discount_percentage numeric DEFAULT NULL::numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_new_listing_id uuid;
  v_rent double precision := p_rent_price;
  v_base numeric := p_base_price;
  v_period public."RentPricePeriod" := null;
  v_owner_type text;
  v_member_id uuid;
  v_company_id uuid;
  v_subject_type text;
  v_subject_id uuid;
  v_will_publish boolean;
begin
  if p_rent_price_period is not null and p_rent_price_period not in ('PerNight', 'PerMonth') then
    raise exception 'Invalid rent price period: %', p_rent_price_period;
  end if;

  if p_rent_price_period is not null then
    v_period := p_rent_price_period::public."RentPricePeriod";
  end if;

  if v_base is not null and v_rent is null then
    v_rent := v_base::double precision;
  elsif v_rent is not null and v_base is null then
    v_base := v_rent::numeric;
  end if;

  v_will_publish := coalesce(p_is_active, false) and coalesce(p_is_property_visible, false);

  if v_will_publish then
    select o."OwnerType", o."MemberId", o."CompanyId"
      into v_owner_type, v_member_id, v_company_id
    from public."EstateProperties" ep
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    where ep."Id" = p_estate_property_id
      and ep."IsDeleted" = false;

    if v_owner_type = 'company' and v_company_id is not null then
      v_subject_type := 'company';
      v_subject_id := v_company_id;
    elsif v_member_id is not null then
      v_subject_type := 'member';
      v_subject_id := v_member_id;
    end if;

    if v_subject_type is not null and v_subject_id is not null then
      perform public.assert_published_property_within_plan(
        v_subject_type,
        v_subject_id,
        p_estate_property_id
      );
    end if;
  end if;

  update public."Listings"
  set
    "IsFeatured" = false,
    "IsActive" = false,
    "IsPropertyVisible" = false,
    "LastModified" = now()
  where "EstatePropertyId" = p_estate_property_id
    and "ListingType" = p_listing_type::public."ListingType"
    and "IsDeleted" = false
    and "IsFeatured" = true;

  insert into public."Listings" (
    "EstatePropertyId", "ListingType", "Title", "Description", "AvailableFrom", "Currency",
    "SalePrice", "RentPrice", "RentPricePeriod", "IsPriceVisible", "IsActive", "IsPropertyVisible",
    "IsFeatured", "BlockedForBooking", "BasePrice", "MinPrice", "MaxPrice",
    "LongStayDiscountEnabled", "LongStayMinDays", "LongStayDiscountPercentage",
    "IsDeleted", "Created", "LastModified"
  )
  values (
    p_estate_property_id, p_listing_type::public."ListingType", p_title, p_description,
    coalesce(p_available_from, now()), p_currency, p_sale_price, v_rent, v_period,
    p_is_price_visible, p_is_active, p_is_property_visible, true, p_blocked_for_booking,
    v_base, p_min_price, p_max_price,
    coalesce(p_long_stay_discount_enabled, false), p_long_stay_min_days, p_long_stay_discount_percentage,
    false, now(), now()
  )
  returning "Id" into v_new_listing_id;

  return v_new_listing_id;
end;
$$;


CREATE OR REPLACE FUNCTION public.duplicate_estate_property(
  p_original_property_id text,
  p_user_id text,
  p_new_title text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_original_property record;
  v_new_property_id uuid;
  v_member_id uuid;
  v_owner_id uuid;
  v_new_title text;
  v_old_section_id uuid;
  v_new_section_id uuid;
  v_existing_property_count integer;
  v_subscription_plan_max_properties integer;
  v_source_listing record;
  v_photo_count integer;
  v_photo_cap integer;
  v_plan_photo_cap integer;
begin
  if p_original_property_id is null or p_user_id is null then
    raise exception 'Property id and user id are required to duplicate.';
  end if;

  if not public.is_property_owner(p_user_id::uuid, p_original_property_id::uuid)
     and not public.is_admin() then
    raise exception 'You do not have permission to duplicate this property.';
  end if;

  select
    ep."StreetName", ep."HouseNumber", ep."Neighborhood", ep."City", ep."State", ep."ZipCode", ep."Country",
    ep."LocationLatitude", ep."LocationLongitude", ep."Title", ep."Type", ep."AreaValue", ep."AreaUnit",
    ep."Bedrooms", ep."Bathrooms", ep."HasGarage", ep."GarageSpaces", ep."OwnerId",
    ep."HasLaundryRoom", ep."HasPool", ep."HasBalcony", ep."IsFurnished", ep."Capacity",
    ep."LocationCategory", ep."ViewType"
  into v_original_property
  from public."EstateProperties" ep
  where ep."Id" = p_original_property_id::uuid
    and ep."IsDeleted" = false;

  if not found then
    raise exception 'Property not found.';
  end if;

  select m."Id"
    into v_member_id
  from public."Members" m
  where m."UserId" = p_user_id::uuid
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    raise exception 'Member not found for user.';
  end if;

  -- Create-limit check (member subject), same rules as create_estate_property.
  select count(*) into v_existing_property_count
  from public."EstateProperties" ep
  inner join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
  where ep."IsDeleted" = false
    and (
      (o."OwnerType" = 'member' and o."MemberId" = v_member_id) or
      (o."OwnerType" = 'company' and o."CompanyId" in (
        select cm."CompanyId"
        from public."CompanyMembers" cm
        where cm."MemberId" = v_member_id and cm."IsDeleted" = false
      ))
    );

  select coalesce(p."ListingLimit", p."MaxProperties")
    into v_subscription_plan_max_properties
  from public."Members" m
  left join lateral (
    select bpa."PlanId"
    from public."BillingPlanAssignments" bpa
    where bpa."SubjectType" = 'member'
      and bpa."MemberOrCompanyId" = v_member_id
      and bpa."IsActive" = true
      and bpa."StartDate" <= now()
      and (bpa."EndDate" is null or bpa."EndDate" >= now())
    order by bpa."StartDate" desc
    limit 1
  ) active_plan on true
  left join public."Plans" p
    on p."Id" = active_plan."PlanId"
    and coalesce(p."IsActiveV2", p."IsActive", true) = true
    and p."IsDeleted" = false
  where m."Id" = v_member_id
    and m."IsDeleted" = false;

  if v_subscription_plan_max_properties is not null
     and v_existing_property_count >= v_subscription_plan_max_properties then
    raise exception 'Property limit exceeded. You have % properties but your plan allows maximum %.',
      v_existing_property_count, v_subscription_plan_max_properties;
  end if;

  select l.*
    into v_source_listing
  from public."Listings" l
  where l."EstatePropertyId" = p_original_property_id::uuid
    and l."IsDeleted" = false
  order by l."IsFeatured" desc, l."Created" desc
  limit 1;

  if v_source_listing."Id" is not null
     and coalesce(v_source_listing."IsActive", false)
     and coalesce(v_source_listing."IsPropertyVisible", false) then
    perform public.assert_published_property_within_plan('member', v_member_id, null);
  end if;

  select count(*)::integer into v_photo_count
  from public."PropertyImages" pi
  where pi."EstatePropertyId" = p_original_property_id::uuid
    and pi."IsDeleted" = false;

  select p."MaxPhotosPerProperty"
    into v_plan_photo_cap
  from public."BillingPlanAssignments" bpa
  join public."Plans" p
    on p."Id" = bpa."PlanId"
   and coalesce(p."IsActiveV2", p."IsActive", true) = true
   and p."IsDeleted" = false
  where bpa."SubjectType" = 'member'
    and bpa."MemberOrCompanyId" = v_member_id
    and bpa."IsActive" = true
    and bpa."StartDate" <= now()
    and (bpa."EndDate" is null or bpa."EndDate" >= now())
  order by bpa."StartDate" desc
  limit 1;

  v_photo_cap := least(coalesce(v_plan_photo_cap, 30), 30);
  if v_photo_count > v_photo_cap then
    raise exception 'Photo limit exceeded. Source has % photos but your plan allows a maximum of % per property.',
      v_photo_count, v_photo_cap;
  end if;

  v_owner_id := public.get_or_create_owner(v_member_id, null, null);

  v_new_title := coalesce(p_new_title, v_original_property."Title" || ' (Copy)');
  v_new_property_id := gen_random_uuid();

  insert into public."EstateProperties" (
    "Id",
    "StreetName",
    "HouseNumber",
    "Neighborhood",
    "City",
    "State",
    "ZipCode",
    "Country",
    "LocationLatitude",
    "LocationLongitude",
    "Title",
    "Type",
    "AreaValue",
    "AreaUnit",
    "Bedrooms",
    "Bathrooms",
    "HasGarage",
    "GarageSpaces",
    "OwnerId",
    "HasLaundryRoom",
    "HasPool",
    "HasBalcony",
    "IsFurnished",
    "Capacity",
    "LocationCategory",
    "ViewType",
    "IsDeleted",
    "Created",
    "LastModified"
  ) values (
    v_new_property_id,
    v_original_property."StreetName",
    v_original_property."HouseNumber",
    v_original_property."Neighborhood",
    v_original_property."City",
    v_original_property."State",
    v_original_property."ZipCode",
    v_original_property."Country",
    v_original_property."LocationLatitude",
    v_original_property."LocationLongitude",
    v_new_title,
    v_original_property."Type",
    v_original_property."AreaValue",
    v_original_property."AreaUnit",
    v_original_property."Bedrooms",
    v_original_property."Bathrooms",
    v_original_property."HasGarage",
    v_original_property."GarageSpaces",
    v_owner_id,
    v_original_property."HasLaundryRoom",
    v_original_property."HasPool",
    v_original_property."HasBalcony",
    v_original_property."IsFurnished",
    v_original_property."Capacity",
    v_original_property."LocationCategory",
    v_original_property."ViewType",
    false,
    now(),
    now()
  );

  if v_source_listing."Id" is not null then
    insert into public."Listings" (
      "Id",
      "EstatePropertyId",
      "ListingType",
      "Title",
      "Description",
      "AvailableFrom",
      "Capacity",
      "Currency",
      "SalePrice",
      "RentPrice",
      "RentPricePeriod",
      "IsPriceVisible",
      "Status",
      "IsActive",
      "IsPropertyVisible",
      "IsFeatured",
      "BlockedForBooking",
      "BasePrice",
      "MinPrice",
      "MaxPrice",
      "LongStayDiscountEnabled",
      "LongStayMinDays",
      "LongStayDiscountPercentage",
      "IsDeleted",
      "Created",
      "CreatedBy",
      "LastModified",
      "LastModifiedBy"
    )
    values (
      gen_random_uuid(),
      v_new_property_id,
      v_source_listing."ListingType",
      coalesce(v_source_listing."Title", v_new_title),
      v_source_listing."Description",
      v_source_listing."AvailableFrom",
      v_source_listing."Capacity",
      v_source_listing."Currency",
      v_source_listing."SalePrice",
      v_source_listing."RentPrice",
      v_source_listing."RentPricePeriod",
      coalesce(v_source_listing."IsPriceVisible", true),
      v_source_listing."Status",
      coalesce(v_source_listing."IsActive", false),
      coalesce(v_source_listing."IsPropertyVisible", false),
      true,
      coalesce(v_source_listing."BlockedForBooking", false),
      v_source_listing."BasePrice",
      v_source_listing."MinPrice",
      v_source_listing."MaxPrice",
      coalesce(v_source_listing."LongStayDiscountEnabled", false),
      v_source_listing."LongStayMinDays",
      v_source_listing."LongStayDiscountPercentage",
      false,
      now(),
      p_user_id,
      now(),
      p_user_id
    );
  end if;

  insert into public."PropertyImages" (
    "Id", "EstatePropertyId", "Url", "AltText", "IsMain", "IsDeleted",
    "Created", "CreatedBy", "LastModified", "LastModifiedBy", "DisplayOrder"
  )
  select
    gen_random_uuid(),
    v_new_property_id,
    pi."Url",
    pi."AltText",
    pi."IsMain",
    false,
    now(),
    p_user_id,
    now(),
    p_user_id,
    pi."DisplayOrder"
  from public."PropertyImages" pi
  where pi."EstatePropertyId" = p_original_property_id::uuid
    and pi."IsDeleted" = false;

  insert into public."PropertyDocuments" (
    "Id", "EstatePropertyId", "Url", "Name", "FileType", "IsPublic", "IsDeleted",
    "Created", "CreatedBy", "LastModified", "LastModifiedBy"
  )
  select
    gen_random_uuid(),
    v_new_property_id,
    pd."Url",
    pd."Name",
    pd."FileType",
    coalesce(pd."IsPublic", true),
    false,
    now(),
    p_user_id,
    now(),
    p_user_id
  from public."PropertyDocuments" pd
  where pd."EstatePropertyId" = p_original_property_id::uuid
    and pd."IsDeleted" = false;

  insert into public."PropertyVideos" (
    "Id", "EstatePropertyId", "Url", "Title", "Description", "IsDeleted",
    "Created", "CreatedBy", "LastModified", "LastModifiedBy"
  )
  select
    gen_random_uuid(),
    v_new_property_id,
    pv."Url",
    pv."Title",
    pv."Description",
    false,
    now(),
    p_user_id,
    now(),
    p_user_id
  from public."PropertyVideos" pv
  where pv."EstatePropertyId" = p_original_property_id::uuid
    and pv."IsDeleted" = false;

  insert into public."EstatePropertyAmenity" (
    "EstatePropertyId",
    "AmenityId",
    "LocalizedDescriptions",
    "CreatedAtUtc",
    "DeletedAtUtc"
  )
  select
    v_new_property_id,
    epa."AmenityId",
    epa."LocalizedDescriptions",
    now(),
    null
  from public."EstatePropertyAmenity" epa
  where epa."EstatePropertyId" = p_original_property_id::uuid
    and epa."DeletedAtUtc" is null;

  insert into public."EstatePropertyPolicy" (
    "EstatePropertyId",
    "ListingType",
    "LocalizedTitle",
    "LocalizedDescription",
    "DisplayOrder",
    "IsDeleted",
    "Created",
    "LastModified"
  )
  select
    v_new_property_id,
    epp."ListingType",
    epp."LocalizedTitle",
    epp."LocalizedDescription",
    epp."DisplayOrder",
    false,
    now(),
    now()
  from public."EstatePropertyPolicy" epp
  where epp."EstatePropertyId" = p_original_property_id::uuid
    and epp."IsDeleted" = false;

  for v_old_section_id in
    select s.id
    from public.propertydetailssection s
    where s.propertyid = p_original_property_id::uuid
      and s.isdeleted = false
    order by s.displayorder, s.createdat
  loop
    v_new_section_id := gen_random_uuid();

    insert into public.propertydetailssection (
      id, propertyid, name, description, localizedname, localizeddescription,
      propertytype, layouttype, layoutconfig, displayorder, isdeleted, createdat, updatedat
    )
    select
      v_new_section_id,
      v_new_property_id,
      src.name,
      src.description,
      src.localizedname,
      src.localizeddescription,
      src.propertytype,
      src.layouttype,
      src.layoutconfig,
      src.displayorder,
      false,
      now(),
      now()
    from public.propertydetailssection src
    where src.id = v_old_section_id;

    insert into public.propertysectionimages (
      id, sectionid, propertyimageid, displayorder, createdat, updatedat
    )
    select
      gen_random_uuid(),
      v_new_section_id,
      psi.propertyimageid,
      psi.displayorder,
      now(),
      now()
    from public.propertysectionimages psi
    where psi.sectionid = v_old_section_id;
  end loop;

  return jsonb_build_object(
    'newPropertyId', v_new_property_id,
    'title', v_new_title
  );
end;
$$;

COMMENT ON FUNCTION public.duplicate_estate_property(text, text, text) IS
  'Duplicates an estate property under the caller member owner, enforcing create/publish/photo plan limits.';
