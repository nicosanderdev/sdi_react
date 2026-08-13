-- Align property create limits to Plans (no hardcoded ceilings),
-- set Plan BASE-Inicial to 20/15/20, add MaxPhotosPerProperty for later enforcement.

ALTER TABLE public."Plans"
  ADD COLUMN IF NOT EXISTS "MaxPhotosPerProperty" integer;

COMMENT ON COLUMN public."Plans"."MaxPhotosPerProperty" IS
  'Optional per-plan photo cap per property. Null means use the global hard maximum of 30.';

UPDATE public."Plans"
SET
  "MaxProperties" = 20,
  "MaxPublishedProperties" = 15,
  "ListingLimit" = 20,
  "LastModified" = now()
WHERE "Name" = 'Plan BASE-Inicial'
  AND "IsDeleted" = false;


CREATE OR REPLACE FUNCTION public.assert_published_property_within_plan(
  p_subject_type text,
  p_subject_id uuid,
  p_estate_property_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit integer;
  v_published_count integer;
  v_already_published boolean := false;
BEGIN
  IF p_subject_type NOT IN ('member', 'company') THEN
    RAISE EXCEPTION 'Invalid billing subject type: %', p_subject_type;
  END IF;

  SELECT coalesce(p."MaxPublishedProperties", p."ListingLimit")
    INTO v_limit
  FROM public."BillingPlanAssignments" bpa
  JOIN public."Plans" p
    ON p."Id" = bpa."PlanId"
   AND coalesce(p."IsActiveV2", p."IsActive", true) = true
   AND p."IsDeleted" = false
  WHERE bpa."SubjectType" = p_subject_type
    AND bpa."MemberOrCompanyId" = p_subject_id
    AND bpa."IsActive" = true
    AND bpa."StartDate" <= now()
    AND (bpa."EndDate" IS NULL OR bpa."EndDate" >= now())
  ORDER BY bpa."StartDate" DESC
  LIMIT 1;

  -- No active plan or null published limit => unlimited
  IF v_limit IS NULL THEN
    RETURN;
  END IF;

  IF p_estate_property_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public."Listings" l
      WHERE l."EstatePropertyId" = p_estate_property_id
        AND l."IsDeleted" = false
        AND l."IsPropertyVisible" = true
        AND l."IsActive" = true
    ) INTO v_already_published;
  END IF;

  IF v_already_published THEN
    RETURN;
  END IF;

  IF p_subject_type = 'member' THEN
    SELECT count(*)::integer INTO v_published_count
    FROM public."EstateProperties" ep
    INNER JOIN public."Owners" o ON ep."OwnerId" = o."Id" AND o."IsDeleted" = false
    INNER JOIN public."Listings" l ON l."EstatePropertyId" = ep."Id" AND l."IsDeleted" = false
    WHERE ep."IsDeleted" = false
      AND o."OwnerType" = 'member'
      AND o."MemberId" = p_subject_id
      AND l."IsPropertyVisible" = true
      AND l."IsActive" = true;
  ELSE
    SELECT count(*)::integer INTO v_published_count
    FROM public."EstateProperties" ep
    INNER JOIN public."Owners" o ON ep."OwnerId" = o."Id" AND o."IsDeleted" = false
    INNER JOIN public."Listings" l ON l."EstatePropertyId" = ep."Id" AND l."IsDeleted" = false
    WHERE ep."IsDeleted" = false
      AND o."OwnerType" = 'company'
      AND o."CompanyId" = p_subject_id
      AND l."IsPropertyVisible" = true
      AND l."IsActive" = true;
  END IF;

  IF v_published_count >= v_limit THEN
    RAISE EXCEPTION 'Published property limit exceeded. You have % published properties but your plan allows maximum %.',
      v_published_count, v_limit;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_published_property_within_plan(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_published_property_within_plan(text, uuid, uuid) TO service_role;


-- Recreate create_estate_property overloads without hardcoded ceilings
CREATE OR REPLACE FUNCTION public.create_estate_property(p_member_id uuid, p_street_name text, p_house_number text, p_neighborhood text, p_city text, p_state text, p_zip_code text, p_country text, p_location_lat double precision, p_location_lng double precision, p_property_category integer, p_area_value double precision, p_area_unit integer, p_bedrooms integer, p_bathrooms integer, p_garage_spaces integer, p_has_laundry_room boolean, p_has_pool boolean, p_has_balcony boolean, p_is_furnished boolean, p_capacity integer, p_location_category integer, p_view_type integer, p_allows_financing boolean, p_is_new_construction boolean, p_has_mortgage boolean, p_hoa_fees double precision, p_min_contract_months integer, p_requires_guarantee boolean, p_guarantee_type text, p_allows_pets boolean, p_max_guests integer, p_has_catering boolean, p_has_sound_system boolean, p_closing_hour text, p_allowed_events_description text, p_min_stay_days integer, p_max_stay_days integer, p_lead_time_days integer, p_buffer_days integer, p_extension_type text DEFAULT NULL::text, p_amenity_ids uuid[] DEFAULT NULL::uuid[]) RETURNS jsonb
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
  v_company_id := null;

  if v_member_id is null then
    raise exception 'Member ID is required to create an estate property.';
  end if;

  begin
    v_owner_id := get_or_create_owner(v_member_id, v_company_id, null);
  exception when undefined_function then
    v_owner_id := coalesce(v_member_id, v_company_id);
  end;

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

CREATE OR REPLACE FUNCTION public.create_estate_property(p_member_id uuid, p_street_name text, p_house_number text, p_neighborhood text, p_city text, p_state text, p_zip_code text, p_country text, p_location_lat double precision, p_location_lng double precision, p_property_category integer, p_area_value double precision, p_area_unit integer, p_bedrooms integer, p_bathrooms integer, p_garage_spaces integer, p_has_laundry_room boolean, p_has_pool boolean, p_has_balcony boolean, p_is_furnished boolean, p_capacity integer, p_location_category integer, p_view_type integer, p_allows_financing boolean, p_is_new_construction boolean, p_has_mortgage boolean, p_hoa_fees double precision, p_min_contract_months integer, p_requires_guarantee boolean, p_guarantee_type text, p_allows_pets boolean, p_max_guests integer, p_has_catering boolean, p_has_sound_system boolean, p_closing_hour text, p_allowed_events_description text, p_min_stay_days integer, p_max_stay_days integer, p_lead_time_days integer, p_buffer_days integer, p_extension_type text DEFAULT NULL::text, p_amenity_ids uuid[] DEFAULT NULL::uuid[], p_amenity_links jsonb DEFAULT NULL::jsonb) RETURNS jsonb
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
  v_company_id := null;

  if v_member_id is null then
    raise exception 'Member ID is required to create an estate property.';
  end if;

  begin
    v_owner_id := get_or_create_owner(v_member_id, v_company_id, null);
  exception when undefined_function then
    v_owner_id := coalesce(v_member_id, v_company_id);
  end;

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
