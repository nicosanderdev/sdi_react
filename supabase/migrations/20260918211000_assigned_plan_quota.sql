-- Assignment-wins: property create quota uses the assigned plan even if inactive.
CREATE OR REPLACE FUNCTION public.create_estate_property(p_member_id uuid, p_street_name text, p_house_number text, p_neighborhood text, p_city text, p_state text, p_zip_code text, p_country text, p_location_lat double precision, p_location_lng double precision, p_property_category integer, p_area_value double precision, p_area_unit integer, p_bedrooms integer, p_bathrooms integer, p_garage_spaces integer, p_has_laundry_room boolean, p_has_pool boolean, p_has_balcony boolean, p_is_furnished boolean, p_capacity integer, p_location_category integer, p_view_type integer, p_allows_financing boolean, p_is_new_construction boolean, p_has_mortgage boolean, p_hoa_fees double precision, p_min_contract_months integer, p_requires_guarantee boolean, p_guarantee_type text, p_allows_pets boolean, p_max_guests integer, p_has_catering boolean, p_has_sound_system boolean, p_closing_hour text, p_allowed_events_description text, p_min_stay_days integer, p_max_stay_days integer, p_lead_time_days integer, p_buffer_days integer, p_extension_type text DEFAULT NULL::text, p_amenity_ids uuid[] DEFAULT NULL::uuid[], p_company_id uuid DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_property_id uuid;
  v_owner_id uuid;
  v_member_id uuid;
  v_company_id uuid;
  v_result jsonb;
  v_existing_property_count integer;
  v_subscription_plan_max_properties integer;
  -- plan max properties; null means unlimited
  v_effective_extension_type text;
begin
  v_member_id := p_member_id;
  v_company_id := p_company_id;

  if v_member_id is null then
    raise exception 'Member ID is required to create an estate property.';
  end if;

  if v_company_id is not null then
    if not public.is_company_manager(v_company_id) and not public.is_admin() then
      raise exception 'Only company Admin or Manager can create company-owned properties.';
    end if;
    v_owner_id := public.get_or_create_owner(null, v_company_id, 'company');

    select count(*) into v_existing_property_count
    from public."EstateProperties" ep
    inner join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and o."OwnerType" = 'company'
      and o."CompanyId" = v_company_id;

    select coalesce(p."ListingLimit", p."MaxProperties")
      into v_subscription_plan_max_properties
    from public."BillingPlanAssignments" bpa
    join public."Plans" p
      on p."Id" = bpa."PlanId"
     and p."IsDeleted" = false
    where bpa."SubjectType" = 'company'
      and bpa."MemberOrCompanyId" = v_company_id
      and bpa."IsActive" = true
      and bpa."StartDate" <= now()
      and (bpa."EndDate" is null or bpa."EndDate" >= now())
    order by bpa."StartDate" desc
    limit 1;

    if v_subscription_plan_max_properties is not null
       and v_existing_property_count >= v_subscription_plan_max_properties then
      raise exception 'Property limit exceeded. You have % properties but your plan allows maximum %. Please upgrade your subscription or delete existing properties to create new ones.',
        v_existing_property_count, v_subscription_plan_max_properties;
    end if;
  else
    v_owner_id := public.get_or_create_owner(v_member_id, null, 'member');

    select count(*) into v_existing_property_count
    from public."EstateProperties" ep
    inner join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and o."OwnerType" = 'member'
      and o."MemberId" = v_member_id;

    select coalesce(p."ListingLimit", p."MaxProperties")
      into v_subscription_plan_max_properties
    from public."BillingPlanAssignments" bpa
    join public."Plans" p
      on p."Id" = bpa."PlanId"
     and p."IsDeleted" = false
    where bpa."SubjectType" = 'member'
      and bpa."MemberOrCompanyId" = v_member_id
      and bpa."IsActive" = true
      and bpa."StartDate" <= now()
      and (bpa."EndDate" is null or bpa."EndDate" >= now())
    order by bpa."StartDate" desc
    limit 1;

    if v_subscription_plan_max_properties is not null
       and v_existing_property_count >= v_subscription_plan_max_properties then
      raise exception 'Property limit exceeded. You have % properties but your plan allows maximum %. Please upgrade your subscription or delete existing properties to create new ones.',
        v_existing_property_count, v_subscription_plan_max_properties;
    end if;
  end if;

  begin
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

    -- Plan limit lookup migrated from MemberPlans to BillingPlanAssignments.
    -- Plan limit: ListingLimit / MaxProperties from active member plan. NULL = unlimited.
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
      and p."IsDeleted" = false
    where m."Id" = v_member_id
      and m."IsDeleted" = false;

    if v_subscription_plan_max_properties is not null
       and v_existing_property_count >= v_subscription_plan_max_properties then
      raise exception 'Property limit exceeded. You have % properties but your plan allows maximum %. Please upgrade your subscription or delete existing properties to create new ones.',
        v_existing_property_count, v_subscription_plan_max_properties;
    end if;
  end;

  v_property_id := gen_random_uuid();

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
    "AreaValue",
    "AreaUnit",
    "Bedrooms",
    "Bathrooms",
    "HasGarage",
    "GarageSpaces",
    "OwnerId",
    "IsDeleted",
    "HasLaundryRoom",
    "HasPool",
    "HasBalcony",
    "IsFurnished",
    "Capacity",
    "LocationCategory",
    "ViewType"
  ) values (
    v_property_id,
    p_street_name,
    p_house_number,
    p_neighborhood,
    p_city,
    p_state,
    p_zip_code,
    p_country,
    p_location_lat,
    p_location_lng,
    p_area_value,
    p_area_unit,
    p_bedrooms,
    p_bathrooms,
    (p_garage_spaces is not null and p_garage_spaces > 0),
    p_garage_spaces,
    v_owner_id,
    false,
    coalesce(p_has_laundry_room, false),
    coalesce(p_has_pool, false),
    coalesce(p_has_balcony, false),
    coalesce(p_is_furnished, false),
    p_capacity,
    case coalesce(p_location_category, 1)
      when 0 then 'rural'::public."LocationCategory"
      when 1 then 'city'::public."LocationCategory"
      when 2 then 'near_shore'::public."LocationCategory"
      else 'city'::public."LocationCategory"
    end,
    case coalesce(p_view_type, 0)
      when 0 then 'city'::public."ViewType"
      when 1 then 'mountain'::public."ViewType"
      when 2 then 'rural'::public."ViewType"
      when 3 then 'sea'::public."ViewType"
      else 'city'::public."ViewType"
    end
  );

  v_effective_extension_type := coalesce(p_extension_type, 'RealEstate');

  if lower(v_effective_extension_type) = 'realestate' then
    insert into public."RealEstateExtension" (
      "EstatePropertyId",
      "AllowsFinancing",
      "IsNewConstruction",
      "HasMortgage",
      "HOAFees",
      "MinContractMonths",
      "RequiresGuarantee",
      "GuaranteeType",
      "AllowsPets",
      "Category"
    ) values (
      v_property_id,
      p_allows_financing,
      p_is_new_construction,
      p_has_mortgage,
      p_hoa_fees,
      p_min_contract_months,
      p_requires_guarantee,
      p_guarantee_type,
      p_allows_pets,
      case coalesce(p_property_category, 0)
        when 0 then 'Casa'::public."PropertyCategory"
        when 1 then 'Apartamento'::public."PropertyCategory"
        when 2 then 'Terreno'::public."PropertyCategory"
        when 3 then 'Chacra'::public."PropertyCategory"
        when 4 then 'Campo'::public."PropertyCategory"
        else 'Casa'::public."PropertyCategory"
      end
    );
  elsif lower(v_effective_extension_type) = 'eventvenue' then
    insert into public."EventVenueExtension" (
      "EstatePropertyId",
      "MaxGuests",
      "HasCatering",
      "HasSoundSystem",
      "ClosingHour",
      "AllowedEventsDescription",
      "Created",
      "LastModified"
    ) values (
      v_property_id,
      p_max_guests,
      p_has_catering,
      p_has_sound_system,
      nullif(p_closing_hour, '')::time,
      p_allowed_events_description,
      now(),
      now()
    );
  elsif lower(v_effective_extension_type) = 'summerrent' then
    insert into public."SummerRentExtension" (
      "EstatePropertyId",
      "MinStayDays",
      "MaxStayDays",
      "LeadTimeDays",
      "BufferDays"
    ) values (
      v_property_id,
      p_min_stay_days,
      p_max_stay_days,
      p_lead_time_days,
      p_buffer_days
    );
  end if;

  if p_amenity_ids is not null and array_length(p_amenity_ids, 1) > 0 then
    insert into public."EstatePropertyAmenity" (
      "EstatePropertyId",
      "AmenityId",
      "CreatedAtUtc",
      "DeletedAtUtc"
    )
    select
      v_property_id,
      amenity_id,
      now(),
      null
    from unnest(p_amenity_ids) as amenity_id;
  end if;

  v_result := jsonb_build_object(
    'id', v_property_id,
    'streetName', p_street_name,
    'houseNumber', p_house_number,
    'neighborhood', p_neighborhood,
    'city', p_city,
    'state', p_state,
    'zipCode', p_zip_code,
    'country', p_country,
    'location', jsonb_build_object('lat', p_location_lat, 'lng', p_location_lng),
    'areaValue', p_area_value,
    'areaUnit', p_area_unit,
    'bedrooms', p_bedrooms,
    'bathrooms', p_bathrooms,
    'hasGarage', (p_garage_spaces is not null and p_garage_spaces > 0),
    'garageSpaces', p_garage_spaces,
    'hasLaundryRoom', p_has_laundry_room,
    'hasPool', p_has_pool,
    'hasBalcony', p_has_balcony,
    'isFurnished', p_is_furnished,
    'capacity', p_capacity,
    'locationCategory', p_location_category,
    'viewType', p_view_type,
    'ownerId', v_owner_id,
    'created', now()
  );

  return v_result;
exception
  when others then
    raise exception 'Failed to create estate property: %', sqlerrm;
end;
$$;

CREATE OR REPLACE FUNCTION public.create_estate_property(p_member_id uuid, p_street_name text, p_house_number text, p_neighborhood text, p_city text, p_state text, p_zip_code text, p_country text, p_location_lat double precision, p_location_lng double precision, p_property_category integer, p_area_value double precision, p_area_unit integer, p_bedrooms integer, p_bathrooms integer, p_garage_spaces integer, p_has_laundry_room boolean, p_has_pool boolean, p_has_balcony boolean, p_is_furnished boolean, p_capacity integer, p_location_category integer, p_view_type integer, p_allows_financing boolean, p_is_new_construction boolean, p_has_mortgage boolean, p_hoa_fees double precision, p_min_contract_months integer, p_requires_guarantee boolean, p_guarantee_type text, p_allows_pets boolean, p_max_guests integer, p_has_catering boolean, p_has_sound_system boolean, p_closing_hour text, p_allowed_events_description text, p_min_stay_days integer, p_max_stay_days integer, p_lead_time_days integer, p_buffer_days integer, p_extension_type text DEFAULT NULL::text, p_amenity_ids uuid[] DEFAULT NULL::uuid[], p_amenity_links jsonb DEFAULT NULL::jsonb, p_company_id uuid DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_property_id uuid;
  v_owner_id uuid;
  v_member_id uuid;
  v_company_id uuid;
  v_result jsonb;
  v_existing_property_count integer;
  v_subscription_plan_max_properties integer;
  -- plan max properties; null means unlimited
  v_effective_extension_type text;
  v_link jsonb;
  v_amenity_id uuid;
  v_descriptions jsonb;
begin
  v_member_id := p_member_id;
  v_company_id := p_company_id;

  if v_member_id is null then
    raise exception 'Member ID is required to create an estate property.';
  end if;

  if v_company_id is not null then
    if not public.is_company_manager(v_company_id) and not public.is_admin() then
      raise exception 'Only company Admin or Manager can create company-owned properties.';
    end if;
    v_owner_id := public.get_or_create_owner(null, v_company_id, 'company');

    select count(*) into v_existing_property_count
    from public."EstateProperties" ep
    inner join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and o."OwnerType" = 'company'
      and o."CompanyId" = v_company_id;

    select coalesce(p."ListingLimit", p."MaxProperties")
      into v_subscription_plan_max_properties
    from public."BillingPlanAssignments" bpa
    join public."Plans" p
      on p."Id" = bpa."PlanId"
     and p."IsDeleted" = false
    where bpa."SubjectType" = 'company'
      and bpa."MemberOrCompanyId" = v_company_id
      and bpa."IsActive" = true
      and bpa."StartDate" <= now()
      and (bpa."EndDate" is null or bpa."EndDate" >= now())
    order by bpa."StartDate" desc
    limit 1;

    if v_subscription_plan_max_properties is not null
       and v_existing_property_count >= v_subscription_plan_max_properties then
      raise exception 'Property limit exceeded. You have % properties but your plan allows maximum %. Please upgrade your subscription or delete existing properties to create new ones.',
        v_existing_property_count, v_subscription_plan_max_properties;
    end if;
  else
    v_owner_id := public.get_or_create_owner(v_member_id, null, 'member');

    select count(*) into v_existing_property_count
    from public."EstateProperties" ep
    inner join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and o."OwnerType" = 'member'
      and o."MemberId" = v_member_id;

    select coalesce(p."ListingLimit", p."MaxProperties")
      into v_subscription_plan_max_properties
    from public."BillingPlanAssignments" bpa
    join public."Plans" p
      on p."Id" = bpa."PlanId"
     and p."IsDeleted" = false
    where bpa."SubjectType" = 'member'
      and bpa."MemberOrCompanyId" = v_member_id
      and bpa."IsActive" = true
      and bpa."StartDate" <= now()
      and (bpa."EndDate" is null or bpa."EndDate" >= now())
    order by bpa."StartDate" desc
    limit 1;

    if v_subscription_plan_max_properties is not null
       and v_existing_property_count >= v_subscription_plan_max_properties then
      raise exception 'Property limit exceeded. You have % properties but your plan allows maximum %. Please upgrade your subscription or delete existing properties to create new ones.',
        v_existing_property_count, v_subscription_plan_max_properties;
    end if;
  end if;

  begin
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

    -- Plan limit: ListingLimit / MaxProperties from active member plan. NULL = unlimited.
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
      and p."IsDeleted" = false
    where m."Id" = v_member_id
      and m."IsDeleted" = false;

    if v_subscription_plan_max_properties is not null
       and v_existing_property_count >= v_subscription_plan_max_properties then
      raise exception 'Property limit exceeded. You have % properties but your plan allows maximum %. Please upgrade your subscription or delete existing properties to create new ones.',
        v_existing_property_count, v_subscription_plan_max_properties;
    end if;
  end;

  v_property_id := gen_random_uuid();

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
    "AreaValue",
    "AreaUnit",
    "Bedrooms",
    "Bathrooms",
    "HasGarage",
    "GarageSpaces",
    "OwnerId",
    "IsDeleted",
    "HasLaundryRoom",
    "HasPool",
    "HasBalcony",
    "IsFurnished",
    "Capacity",
    "LocationCategory",
    "ViewType"
  ) values (
    v_property_id,
    p_street_name,
    p_house_number,
    p_neighborhood,
    p_city,
    p_state,
    p_zip_code,
    p_country,
    p_location_lat,
    p_location_lng,
    p_area_value,
    p_area_unit,
    p_bedrooms,
    p_bathrooms,
    (p_garage_spaces is not null and p_garage_spaces > 0),
    p_garage_spaces,
    v_owner_id,
    false,
    coalesce(p_has_laundry_room, false),
    coalesce(p_has_pool, false),
    coalesce(p_has_balcony, false),
    coalesce(p_is_furnished, false),
    p_capacity,
    case coalesce(p_location_category, 1)
      when 0 then 'rural'::public."LocationCategory"
      when 1 then 'city'::public."LocationCategory"
      when 2 then 'near_shore'::public."LocationCategory"
      else 'city'::public."LocationCategory"
    end,
    case coalesce(p_view_type, 0)
      when 0 then 'city'::public."ViewType"
      when 1 then 'mountain'::public."ViewType"
      when 2 then 'rural'::public."ViewType"
      when 3 then 'sea'::public."ViewType"
      else 'city'::public."ViewType"
    end
  );

  v_effective_extension_type := coalesce(p_extension_type, 'RealEstate');

  if lower(v_effective_extension_type) = 'realestate' then
    insert into public."RealEstateExtension" (
      "EstatePropertyId",
      "AllowsFinancing",
      "IsNewConstruction",
      "HasMortgage",
      "HOAFees",
      "MinContractMonths",
      "RequiresGuarantee",
      "GuaranteeType",
      "AllowsPets",
      "Category"
    ) values (
      v_property_id,
      p_allows_financing,
      p_is_new_construction,
      p_has_mortgage,
      p_hoa_fees,
      p_min_contract_months,
      p_requires_guarantee,
      p_guarantee_type,
      p_allows_pets,
      case coalesce(p_property_category, 0)
        when 0 then 'Casa'::public."PropertyCategory"
        when 1 then 'Apartamento'::public."PropertyCategory"
        when 2 then 'Terreno'::public."PropertyCategory"
        when 3 then 'Chacra'::public."PropertyCategory"
        when 4 then 'Campo'::public."PropertyCategory"
        else 'Casa'::public."PropertyCategory"
      end
    );
  elsif lower(v_effective_extension_type) = 'eventvenue' then
    insert into public."EventVenueExtension" (
      "EstatePropertyId",
      "MaxGuests",
      "HasCatering",
      "HasSoundSystem",
      "ClosingHour",
      "AllowedEventsDescription",
      "Created",
      "LastModified"
    ) values (
      v_property_id,
      p_max_guests,
      p_has_catering,
      p_has_sound_system,
      nullif(p_closing_hour, '')::time,
      p_allowed_events_description,
      now(),
      now()
    );
  elsif lower(v_effective_extension_type) = 'summerrent' then
    insert into public."SummerRentExtension" (
      "EstatePropertyId",
      "MinStayDays",
      "MaxStayDays",
      "LeadTimeDays",
      "BufferDays"
    ) values (
      v_property_id,
      p_min_stay_days,
      p_max_stay_days,
      p_lead_time_days,
      p_buffer_days
    );
  end if;

  if p_amenity_links is not null and jsonb_typeof(p_amenity_links) = 'array' and jsonb_array_length(p_amenity_links) > 0 then
    for v_link in select * from jsonb_array_elements(p_amenity_links)
    loop
      v_amenity_id := nullif(trim(both from coalesce(v_link->>'amenityId', v_link->>'amenity_id', '')), '')::uuid;
      if v_amenity_id is null then
        continue;
      end if;
      v_descriptions := public.sanitize_amenity_localized_descriptions(v_link->'descriptions');
      insert into public."EstatePropertyAmenity" (
        "EstatePropertyId",
        "AmenityId",
        "LocalizedDescriptions",
        "CreatedAtUtc",
        "DeletedAtUtc"
      ) values (
        v_property_id,
        v_amenity_id,
        v_descriptions,
        now(),
        null
      );
    end loop;
  elsif p_amenity_ids is not null and array_length(p_amenity_ids, 1) > 0 then
    insert into public."EstatePropertyAmenity" (
      "EstatePropertyId",
      "AmenityId",
      "LocalizedDescriptions",
      "CreatedAtUtc",
      "DeletedAtUtc"
    )
    select
      v_property_id,
      amenity_id,
      '{}'::jsonb,
      now(),
      null
    from unnest(p_amenity_ids) as amenity_id;
  end if;

  v_result := jsonb_build_object(
    'id', v_property_id,
    'streetName', p_street_name,
    'houseNumber', p_house_number,
    'neighborhood', p_neighborhood,
    'city', p_city,
    'state', p_state,
    'zipCode', p_zip_code,
    'country', p_country,
    'location', jsonb_build_object('lat', p_location_lat, 'lng', p_location_lng),
    'areaValue', p_area_value,
    'areaUnit', p_area_unit,
    'bedrooms', p_bedrooms,
    'bathrooms', p_bathrooms,
    'hasGarage', (p_garage_spaces is not null and p_garage_spaces > 0),
    'garageSpaces', p_garage_spaces,
    'hasLaundryRoom', p_has_laundry_room,
    'hasPool', p_has_pool,
    'hasBalcony', p_has_balcony,
    'isFurnished', p_is_furnished,
    'capacity', p_capacity,
    'locationCategory', p_location_category,
    'viewType', p_view_type,
    'ownerId', v_owner_id,
    'created', now()
  );

  return v_result;
exception
  when others then
    raise exception 'Failed to create estate property: %', sqlerrm;
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
    "TemplateKey",
    "SlotValues",
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
    epp."TemplateKey",
    epp."SlotValues",
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
      propertytype, layouttype, layoutconfig, displayorder, isdeleted, createdat, updatedat,
      templatekey
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
      now(),
      src.templatekey
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

