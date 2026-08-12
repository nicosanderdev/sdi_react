-- Guard update_estate_property image replace against photo caps before soft-delete.

CREATE OR REPLACE FUNCTION public.update_estate_property(p_property_id text, p_user_id text, p_street_name text DEFAULT NULL::text, p_house_number text DEFAULT NULL::text, p_neighborhood text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_zip_code text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_location_lat double precision DEFAULT NULL::double precision, p_location_lng double precision DEFAULT NULL::double precision, p_title text DEFAULT NULL::text, p_property_type integer DEFAULT NULL::integer, p_area_value double precision DEFAULT NULL::double precision, p_area_unit integer DEFAULT NULL::integer, p_bedrooms integer DEFAULT NULL::integer, p_bathrooms integer DEFAULT NULL::integer, p_has_garage boolean DEFAULT NULL::boolean, p_garage_spaces integer DEFAULT NULL::integer, p_description text DEFAULT NULL::text, p_available_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_currency integer DEFAULT NULL::integer, p_sale_price double precision DEFAULT NULL::double precision, p_rent_price double precision DEFAULT NULL::double precision, p_has_common_expenses boolean DEFAULT NULL::boolean, p_common_expenses_value double precision DEFAULT NULL::double precision, p_is_electricity_included boolean DEFAULT NULL::boolean, p_is_water_included boolean DEFAULT NULL::boolean, p_is_price_visible boolean DEFAULT NULL::boolean, p_status integer DEFAULT NULL::integer, p_is_active boolean DEFAULT NULL::boolean, p_is_property_visible boolean DEFAULT NULL::boolean, p_property_images jsonb DEFAULT NULL::jsonb, p_property_documents jsonb DEFAULT NULL::jsonb, p_property_videos jsonb DEFAULT NULL::jsonb, p_amenity_ids jsonb DEFAULT NULL::jsonb, p_amenity_links jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_property_id uuid := p_property_id::uuid;
  v_listing_id uuid;
  v_link jsonb;
  v_amenity_id uuid;
  v_descriptions jsonb;
  v_image_record jsonb;
  v_document_record jsonb;
  v_video_record jsonb;
  v_result jsonb;
begin
  if not exists (
    select 1 from public."EstateProperties" ep
    where ep."Id" = v_property_id and ep."IsDeleted" = false
  ) then
    raise exception 'Property not found or already deleted';
  end if;

  if not public.is_property_owner(p_user_id::uuid, v_property_id) then
    raise exception 'User does not own this property';
  end if;

  update public."EstateProperties"
  set
    "StreetName" = coalesce(p_street_name, "StreetName"),
    "HouseNumber" = coalesce(p_house_number, "HouseNumber"),
    "Neighborhood" = coalesce(p_neighborhood, "Neighborhood"),
    "City" = coalesce(p_city, "City"),
    "State" = coalesce(p_state, "State"),
    "ZipCode" = coalesce(p_zip_code, "ZipCode"),
    "Country" = coalesce(p_country, "Country"),
    "LocationLatitude" = coalesce(p_location_lat, "LocationLatitude"),
    "LocationLongitude" = coalesce(p_location_lng, "LocationLongitude"),
    "AreaValue" = coalesce(p_area_value, "AreaValue"),
    "AreaUnit" = coalesce(p_area_unit, "AreaUnit"),
    "Bedrooms" = coalesce(p_bedrooms, "Bedrooms"),
    "Bathrooms" = coalesce(p_bathrooms, "Bathrooms"),
    "HasGarage" = coalesce(p_has_garage, "HasGarage"),
    "GarageSpaces" = coalesce(p_garage_spaces, "GarageSpaces")
  where "Id" = v_property_id;

  select l."Id"
  into v_listing_id
  from public."Listings" l
  where l."EstatePropertyId" = v_property_id
    and l."IsDeleted" = false
  order by l."IsFeatured" desc nulls last, l."Created" desc
  limit 1;

  if v_listing_id is not null then
    update public."Listings"
    set
      "Title" = coalesce(p_title, "Title"),
      "Description" = coalesce(p_description, "Description"),
      "AvailableFrom" = coalesce(p_available_from, "AvailableFrom"),
      "Currency" = coalesce(p_currency, "Currency"),
      "SalePrice" = coalesce(p_sale_price, "SalePrice"),
      "RentPrice" = coalesce(p_rent_price, "RentPrice"),
      "HasCommonExpenses" = coalesce(p_has_common_expenses, "HasCommonExpenses"),
      "CommonExpensesValue" = coalesce(p_common_expenses_value, "CommonExpensesValue"),
      "IsElectricityIncluded" = coalesce(p_is_electricity_included, "IsElectricityIncluded"),
      "IsWaterIncluded" = coalesce(p_is_water_included, "IsWaterIncluded"),
      "IsPriceVisible" = coalesce(p_is_price_visible, "IsPriceVisible"),
      "Status" = coalesce(p_status, "Status"),
      "IsActive" = coalesce(p_is_active, "IsActive"),
      "IsPropertyVisible" = coalesce(p_is_property_visible, "IsPropertyVisible"),
      "LastModified" = now(),
      "LastModifiedBy" = p_user_id
    where "Id" = v_listing_id;
  end if;

  if p_property_images is not null then
    if jsonb_typeof(p_property_images) = 'array' then
      perform public.assert_estate_property_photo_count_allowed(
        v_property_id,
        jsonb_array_length(p_property_images)
      );
    end if;

    update public."PropertyImages"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_images) = 'array' and jsonb_array_length(p_property_images) > 0 then
      for v_image_record in select * from jsonb_array_elements(p_property_images)
      loop
        insert into public."PropertyImages" (
          "Id", "EstatePropertyId", "Url", "AltText", "IsMain", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy", "DisplayOrder"
        ) values (
          coalesce(nullif(v_image_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_image_record->>'url',
          coalesce(v_image_record->>'altText', ''),
          coalesce((v_image_record->>'isMain')::boolean, false),
          false,
          now(), p_user_id, now(), p_user_id,
          coalesce((v_image_record->>'displayOrder')::integer, 0)
        );
      end loop;
    end if;
  end if;

  if p_property_documents is not null then
    update public."PropertyDocuments"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_documents) = 'array' and jsonb_array_length(p_property_documents) > 0 then
      for v_document_record in select * from jsonb_array_elements(p_property_documents)
      loop
        insert into public."PropertyDocuments" (
          "Id", "EstatePropertyId", "Url", "Name", "FileType", "IsPublic", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy"
        ) values (
          coalesce(nullif(v_document_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_document_record->>'url',
          coalesce(v_document_record->>'name', ''),
          coalesce(v_document_record->>'fileType', 'pdf'),
          coalesce((v_document_record->>'isPublic')::boolean, true),
          false,
          now(), p_user_id, now(), p_user_id
        );
      end loop;
    end if;
  end if;

  if p_property_videos is not null then
    update public."PropertyVideos"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_videos) = 'array' and jsonb_array_length(p_property_videos) > 0 then
      for v_video_record in select * from jsonb_array_elements(p_property_videos)
      loop
        insert into public."PropertyVideos" (
          "Id", "EstatePropertyId", "Url", "Title", "Description", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy"
        ) values (
          coalesce(nullif(v_video_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_video_record->>'url',
          coalesce(v_video_record->>'title', ''),
          coalesce(v_video_record->>'description', ''),
          false,
          now(), p_user_id, now(), p_user_id
        );
      end loop;
    end if;
  end if;

  if p_amenity_links is not null or p_amenity_ids is not null then
    delete from public."EstatePropertyAmenity"
    where "EstatePropertyId" = v_property_id;

    if p_amenity_links is not null
       and jsonb_typeof(p_amenity_links) = 'array'
       and jsonb_array_length(p_amenity_links) > 0 then
      for v_link in select * from jsonb_array_elements(p_amenity_links)
      loop
        v_amenity_id := nullif(trim(both from coalesce(v_link->>'amenityId', v_link->>'amenity_id', '')), '')::uuid;
        if v_amenity_id is null then
          continue;
        end if;
        v_descriptions := public.sanitize_amenity_localized_descriptions(v_link->'descriptions');
        insert into public."EstatePropertyAmenity" (
          "EstatePropertyId", "AmenityId", "LocalizedDescriptions", "CreatedAtUtc", "DeletedAtUtc"
        ) values (
          v_property_id, v_amenity_id, v_descriptions, now(), null
        );
      end loop;
    elsif p_amenity_ids is not null
          and jsonb_typeof(p_amenity_ids) = 'array'
          and jsonb_array_length(p_amenity_ids) > 0 then
      for v_amenity_id in
        select nullif(trim(both from value), '')::uuid
        from jsonb_array_elements_text(p_amenity_ids) as t(value)
        where nullif(trim(both from value), '') is not null
      loop
        insert into public."EstatePropertyAmenity" (
          "EstatePropertyId", "AmenityId", "LocalizedDescriptions", "CreatedAtUtc", "DeletedAtUtc"
        ) values (
          v_property_id, v_amenity_id, '{}'::jsonb, now(), null
        );
      end loop;
    end if;
  end if;

  select jsonb_build_object(
    'id', ep."Id",
    'streetName', ep."StreetName",
    'houseNumber', ep."HouseNumber",
    'neighborhood', ep."Neighborhood",
    'city', ep."City",
    'state', ep."State",
    'zipCode', ep."ZipCode",
    'country', ep."Country",
    'location', jsonb_build_object('lat', ep."LocationLatitude", 'lng', ep."LocationLongitude"),
    'title', l."Title",
    'areaValue', ep."AreaValue",
    'areaUnit', ep."AreaUnit",
    'bedrooms', ep."Bedrooms",
    'bathrooms', ep."Bathrooms",
    'hasGarage', ep."HasGarage",
    'garageSpaces', ep."GarageSpaces",
    'description', l."Description",
    'availableFrom', l."AvailableFrom",
    'ownerId', ep."OwnerId",
    'currency', l."Currency",
    'salePrice', l."SalePrice",
    'rentPrice', l."RentPrice",
    'hasCommonExpenses', l."HasCommonExpenses",
    'commonExpensesValue', l."CommonExpensesValue",
    'isElectricityIncluded', l."IsElectricityIncluded",
    'isWaterIncluded', l."IsWaterIncluded",
    'isPriceVisible', l."IsPriceVisible",
    'status', l."Status",
    'isActive', l."IsActive",
    'isPropertyVisible', l."IsPropertyVisible",
    'created', ep."Created"
  )
  into v_result
  from public."EstateProperties" ep
  left join public."Listings" l on l."Id" = v_listing_id
  where ep."Id" = v_property_id;

  return v_result;
exception
  when others then
    raise exception 'Failed to update estate property: %', sqlerrm;
end;
$$;

CREATE OR REPLACE FUNCTION public.update_estate_property(p_property_id text, p_user_id text, p_street_name text DEFAULT NULL::text, p_house_number text DEFAULT NULL::text, p_neighborhood text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_zip_code text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_location_lat double precision DEFAULT NULL::double precision, p_location_lng double precision DEFAULT NULL::double precision, p_title text DEFAULT NULL::text, p_property_type integer DEFAULT NULL::integer, p_area_value double precision DEFAULT NULL::double precision, p_area_unit integer DEFAULT NULL::integer, p_bedrooms integer DEFAULT NULL::integer, p_bathrooms integer DEFAULT NULL::integer, p_has_garage boolean DEFAULT NULL::boolean, p_garage_spaces integer DEFAULT NULL::integer, p_description text DEFAULT NULL::text, p_available_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_currency integer DEFAULT NULL::integer, p_sale_price double precision DEFAULT NULL::double precision, p_rent_price double precision DEFAULT NULL::double precision, p_has_common_expenses boolean DEFAULT NULL::boolean, p_common_expenses_value double precision DEFAULT NULL::double precision, p_is_electricity_included boolean DEFAULT NULL::boolean, p_is_water_included boolean DEFAULT NULL::boolean, p_is_price_visible boolean DEFAULT NULL::boolean, p_status integer DEFAULT NULL::integer, p_is_active boolean DEFAULT NULL::boolean, p_is_property_visible boolean DEFAULT NULL::boolean, p_property_images jsonb DEFAULT NULL::jsonb, p_property_documents jsonb DEFAULT NULL::jsonb, p_property_videos jsonb DEFAULT NULL::jsonb, p_amenity_ids jsonb DEFAULT NULL::jsonb, p_amenity_links jsonb DEFAULT NULL::jsonb, p_policies jsonb DEFAULT NULL::jsonb, p_content_sections jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_property_id uuid := p_property_id::uuid;
  v_listing_id uuid;
  v_link jsonb;
  v_amenity_id uuid;
  v_descriptions jsonb;
  v_image_record jsonb;
  v_document_record jsonb;
  v_video_record jsonb;
  v_result jsonb;
begin
  if not exists (
    select 1 from public."EstateProperties" ep
    where ep."Id" = v_property_id and ep."IsDeleted" = false
  ) then
    raise exception 'Property not found or already deleted';
  end if;

  if not public.is_property_owner(p_user_id::uuid, v_property_id) then
    raise exception 'User does not own this property';
  end if;

  update public."EstateProperties"
  set
    "StreetName" = coalesce(p_street_name, "StreetName"),
    "HouseNumber" = coalesce(p_house_number, "HouseNumber"),
    "Neighborhood" = coalesce(p_neighborhood, "Neighborhood"),
    "City" = coalesce(p_city, "City"),
    "State" = coalesce(p_state, "State"),
    "ZipCode" = coalesce(p_zip_code, "ZipCode"),
    "Country" = coalesce(p_country, "Country"),
    "LocationLatitude" = coalesce(p_location_lat, "LocationLatitude"),
    "LocationLongitude" = coalesce(p_location_lng, "LocationLongitude"),
    "AreaValue" = coalesce(p_area_value, "AreaValue"),
    "AreaUnit" = coalesce(p_area_unit, "AreaUnit"),
    "Bedrooms" = coalesce(p_bedrooms, "Bedrooms"),
    "Bathrooms" = coalesce(p_bathrooms, "Bathrooms"),
    "HasGarage" = coalesce(p_has_garage, "HasGarage"),
    "GarageSpaces" = coalesce(p_garage_spaces, "GarageSpaces")
  where "Id" = v_property_id;

  select l."Id"
  into v_listing_id
  from public."Listings" l
  where l."EstatePropertyId" = v_property_id
    and l."IsDeleted" = false
  order by l."IsFeatured" desc nulls last, l."Created" desc
  limit 1;

  if v_listing_id is not null then
    update public."Listings"
    set
      "Title" = coalesce(p_title, "Title"),
      "Description" = coalesce(p_description, "Description"),
      "AvailableFrom" = coalesce(p_available_from, "AvailableFrom"),
      "Currency" = coalesce(p_currency, "Currency"),
      "SalePrice" = coalesce(p_sale_price, "SalePrice"),
      "RentPrice" = coalesce(p_rent_price, "RentPrice"),
      "HasCommonExpenses" = coalesce(p_has_common_expenses, "HasCommonExpenses"),
      "CommonExpensesValue" = coalesce(p_common_expenses_value, "CommonExpensesValue"),
      "IsElectricityIncluded" = coalesce(p_is_electricity_included, "IsElectricityIncluded"),
      "IsWaterIncluded" = coalesce(p_is_water_included, "IsWaterIncluded"),
      "IsPriceVisible" = coalesce(p_is_price_visible, "IsPriceVisible"),
      "Status" = coalesce(p_status, "Status"),
      "IsActive" = coalesce(p_is_active, "IsActive"),
      "IsPropertyVisible" = coalesce(p_is_property_visible, "IsPropertyVisible"),
      "LastModified" = now(),
      "LastModifiedBy" = p_user_id
    where "Id" = v_listing_id;
  end if;

  if p_property_images is not null then
    if jsonb_typeof(p_property_images) = 'array' then
      perform public.assert_estate_property_photo_count_allowed(
        v_property_id,
        jsonb_array_length(p_property_images)
      );
    end if;

    update public."PropertyImages"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_images) = 'array' and jsonb_array_length(p_property_images) > 0 then
      for v_image_record in select * from jsonb_array_elements(p_property_images)
      loop
        insert into public."PropertyImages" (
          "Id", "EstatePropertyId", "Url", "AltText", "IsMain", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy", "DisplayOrder"
        ) values (
          coalesce(nullif(v_image_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_image_record->>'url',
          coalesce(v_image_record->>'altText', ''),
          coalesce((v_image_record->>'isMain')::boolean, false),
          false,
          now(), p_user_id, now(), p_user_id,
          coalesce((v_image_record->>'displayOrder')::integer, 0)
        );
      end loop;
    end if;
  end if;

  if p_property_documents is not null then
    update public."PropertyDocuments"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_documents) = 'array' and jsonb_array_length(p_property_documents) > 0 then
      for v_document_record in select * from jsonb_array_elements(p_property_documents)
      loop
        insert into public."PropertyDocuments" (
          "Id", "EstatePropertyId", "Url", "Name", "FileType", "IsPublic", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy"
        ) values (
          coalesce(nullif(v_document_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_document_record->>'url',
          coalesce(v_document_record->>'name', ''),
          coalesce(v_document_record->>'fileType', 'pdf'),
          coalesce((v_document_record->>'isPublic')::boolean, true),
          false,
          now(), p_user_id, now(), p_user_id
        );
      end loop;
    end if;
  end if;

  if p_property_videos is not null then
    update public."PropertyVideos"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_videos) = 'array' and jsonb_array_length(p_property_videos) > 0 then
      for v_video_record in select * from jsonb_array_elements(p_property_videos)
      loop
        insert into public."PropertyVideos" (
          "Id", "EstatePropertyId", "Url", "Title", "Description", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy"
        ) values (
          coalesce(nullif(v_video_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_video_record->>'url',
          coalesce(v_video_record->>'title', ''),
          coalesce(v_video_record->>'description', ''),
          false,
          now(), p_user_id, now(), p_user_id
        );
      end loop;
    end if;
  end if;

  if p_amenity_links is not null or p_amenity_ids is not null then
    delete from public."EstatePropertyAmenity"
    where "EstatePropertyId" = v_property_id;

    if p_amenity_links is not null
       and jsonb_typeof(p_amenity_links) = 'array'
       and jsonb_array_length(p_amenity_links) > 0 then
      for v_link in select * from jsonb_array_elements(p_amenity_links)
      loop
        v_amenity_id := nullif(trim(both from coalesce(v_link->>'amenityId', v_link->>'amenity_id', '')), '')::uuid;
        if v_amenity_id is null then
          continue;
        end if;
        v_descriptions := public.sanitize_amenity_localized_descriptions(v_link->'descriptions');
        insert into public."EstatePropertyAmenity" (
          "EstatePropertyId", "AmenityId", "LocalizedDescriptions", "CreatedAtUtc", "DeletedAtUtc"
        ) values (
          v_property_id, v_amenity_id, v_descriptions, now(), null
        );
      end loop;
    elsif p_amenity_ids is not null
          and jsonb_typeof(p_amenity_ids) = 'array'
          and jsonb_array_length(p_amenity_ids) > 0 then
      for v_amenity_id in
        select nullif(trim(both from value), '')::uuid
        from jsonb_array_elements_text(p_amenity_ids) as t(value)
        where nullif(trim(both from value), '') is not null
      loop
        insert into public."EstatePropertyAmenity" (
          "EstatePropertyId", "AmenityId", "LocalizedDescriptions", "CreatedAtUtc", "DeletedAtUtc"
        ) values (
          v_property_id, v_amenity_id, '{}'::jsonb, now(), null
        );
      end loop;
    end if;
  end if;

  if p_policies is not null then
    perform public.replace_estate_property_policies(v_property_id, p_policies);
  end if;

  if p_content_sections is not null then
    perform public.replace_estate_property_content_sections(v_property_id, p_content_sections);
  end if;

  select jsonb_build_object(
    'id', ep."Id",
    'streetName', ep."StreetName",
    'houseNumber', ep."HouseNumber",
    'neighborhood', ep."Neighborhood",
    'city', ep."City",
    'state', ep."State",
    'zipCode', ep."ZipCode",
    'country', ep."Country",
    'location', jsonb_build_object('lat', ep."LocationLatitude", 'lng', ep."LocationLongitude"),
    'title', l."Title",
    'areaValue', ep."AreaValue",
    'areaUnit', ep."AreaUnit",
    'bedrooms', ep."Bedrooms",
    'bathrooms', ep."Bathrooms",
    'hasGarage', ep."HasGarage",
    'garageSpaces', ep."GarageSpaces",
    'description', l."Description",
    'availableFrom', l."AvailableFrom",
    'ownerId', ep."OwnerId",
    'currency', l."Currency",
    'salePrice', l."SalePrice",
    'rentPrice', l."RentPrice",
    'hasCommonExpenses', l."HasCommonExpenses",
    'commonExpensesValue', l."CommonExpensesValue",
    'isElectricityIncluded', l."IsElectricityIncluded",
    'isWaterIncluded', l."IsWaterIncluded",
    'isPriceVisible', l."IsPriceVisible",
    'status', l."Status",
    'isActive', l."IsActive",
    'isPropertyVisible', l."IsPropertyVisible",
    'created', ep."Created"
  )
  into v_result
  from public."EstateProperties" ep
  left join public."Listings" l on l."Id" = v_listing_id
  where ep."Id" = v_property_id;

  return v_result;
exception
  when others then
    raise exception 'Failed to update estate property: %', sqlerrm;
end;
$$;
