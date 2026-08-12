-- Company-owned property create: optional p_company_id, company plan limits,
-- member-owned-only personal create counts, and read access for company Members.

DROP FUNCTION IF EXISTS public.create_estate_property(uuid, text, text, text, text, text, text, text, double precision, double precision, integer, double precision, integer, integer, integer, integer, boolean, boolean, boolean, boolean, integer, integer, integer, boolean, boolean, boolean, double precision, integer, boolean, text, boolean, integer, boolean, boolean, text, text, integer, integer, integer, integer, text, uuid[]);
DROP FUNCTION IF EXISTS public.create_estate_property(uuid, text, text, text, text, text, text, text, double precision, double precision, integer, double precision, integer, integer, integer, integer, boolean, boolean, boolean, boolean, integer, integer, integer, boolean, boolean, boolean, double precision, integer, boolean, text, boolean, integer, boolean, boolean, text, text, integer, integer, integer, integer, text, uuid[], jsonb);

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
     and coalesce(p."IsActiveV2", p."IsActive", true) = true
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
     and coalesce(p."IsActiveV2", p."IsActive", true) = true
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
      and coalesce(p."IsActiveV2", p."IsActive", true) = true
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
     and coalesce(p."IsActiveV2", p."IsActive", true) = true
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
     and coalesce(p."IsActiveV2", p."IsActive", true) = true
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
      and coalesce(p."IsActiveV2", p."IsActive", true) = true
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

DROP POLICY IF EXISTS "EstateProperties_user_select" ON public."EstateProperties";
CREATE POLICY "EstateProperties_user_select"
  ON public."EstateProperties"
  FOR SELECT
  TO authenticated
  USING (
    ("IsDeleted" = false)
    AND (
      public.user_can_manage_estate_property("Id")
      OR public.user_can_read_owner_record("OwnerId")
    )
  );

DROP POLICY IF EXISTS "Listings_user_select" ON public."Listings";
CREATE POLICY "Listings_user_select"
  ON public."Listings"
  FOR SELECT
  TO authenticated
  USING (
    ("IsDeleted" = false)
    AND (
      public.user_can_manage_estate_property("EstatePropertyId")
      OR EXISTS (
        SELECT 1 FROM public."EstateProperties" ep
        WHERE ep."Id" = "EstatePropertyId"
          AND ep."IsDeleted" = false
          AND public.user_can_read_owner_record(ep."OwnerId")
      )
    )
  );

DROP POLICY IF EXISTS "PropertyImages_user_select" ON public."PropertyImages";
CREATE POLICY "PropertyImages_user_select"
  ON public."PropertyImages"
  FOR SELECT
  TO authenticated
  USING (
    ("IsDeleted" = false)
    AND (
      public.user_can_manage_estate_property("EstatePropertyId")
      OR EXISTS (
        SELECT 1 FROM public."EstateProperties" ep
        WHERE ep."Id" = "EstatePropertyId"
          AND ep."IsDeleted" = false
          AND public.user_can_read_owner_record(ep."OwnerId")
      )
    )
  );
