-- Patches derived from tasks/public_schema.sql (latest DB export).
-- Prerequisite: 20260611120000_estate_property_policies_and_localized_sections.sql
-- Manual apply by project owner (idempotent where possible).

begin;

-- ---------------------------------------------------------------------------
-- 1) update_estate_property — add p_policies, p_content_sections
-- ---------------------------------------------------------------------------
drop function if exists public.update_estate_property(
  text, text, text, text, text, text, text, text, text,
  double precision, double precision, double precision,
  integer, integer, integer, boolean, integer,
  text, timestamp with time zone,
  integer, double precision, double precision,
  boolean, double precision, boolean, boolean, boolean,
  integer, boolean, boolean,
  jsonb, jsonb, jsonb, jsonb
);

drop function if exists public.update_estate_property(
  text, text, text, text, text, text, text, text, text,
  double precision, double precision, double precision,
  integer, integer, integer, boolean, integer,
  text, timestamp with time zone,
  integer, double precision, double precision,
  boolean, double precision, boolean, boolean, boolean,
  integer, boolean, boolean,
  jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
);

create or replace function public.update_estate_property(
  p_property_id text,
  p_user_id text,
  p_street_name text default null,
  p_house_number text default null,
  p_neighborhood text default null,
  p_city text default null,
  p_state text default null,
  p_zip_code text default null,
  p_country text default null,
  p_location_lat double precision default null,
  p_location_lng double precision default null,
  p_title text default null,
  p_property_type integer default null,
  p_area_value double precision default null,
  p_area_unit integer default null,
  p_bedrooms integer default null,
  p_bathrooms integer default null,
  p_has_garage boolean default null,
  p_garage_spaces integer default null,
  p_description text default null,
  p_available_from timestamp with time zone default null,
  p_currency integer default null,
  p_sale_price double precision default null,
  p_rent_price double precision default null,
  p_has_common_expenses boolean default null,
  p_common_expenses_value double precision default null,
  p_is_electricity_included boolean default null,
  p_is_water_included boolean default null,
  p_is_price_visible boolean default null,
  p_status integer default null,
  p_is_active boolean default null,
  p_is_property_visible boolean default null,
  p_property_images jsonb default null,
  p_property_documents jsonb default null,
  p_property_videos jsonb default null,
  p_amenity_ids jsonb default null,
  p_amenity_links jsonb default null,
  p_policies jsonb default null,
  p_content_sections jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

-- ---------------------------------------------------------------------------
-- 2) get_public_event_venue_property_by_id — Policies + ContentSections
-- ---------------------------------------------------------------------------
drop function if exists public.get_public_event_venue_property_by_id(uuid);

create function public.get_public_event_venue_property_by_id(p_property_id uuid)
returns table(
  "EstatePropertyId" uuid,
  "OwnerId" uuid,
  "Neighborhood" character varying,
  "City" character varying,
  "State" character varying,
  "Country" character varying,
  "LocationLatitude" numeric,
  "LocationLongitude" numeric,
  "AreaValue" numeric,
  "AreaUnit" integer,
  "Bedrooms" integer,
  "Bathrooms" integer,
  "HasGarage" boolean,
  "GarageSpaces" integer,
  "HasLaundryRoom" boolean,
  "HasPool" boolean,
  "HasBalcony" boolean,
  "IsFurnished" boolean,
  "Capacity" integer,
  "LocationCategory" public."LocationCategory",
  "ViewType" public."ViewType",
  "ListingId" uuid,
  "ListingType" public."ListingType",
  "Title" text,
  "ListingDescription" character varying,
  "AvailableFrom" timestamp with time zone,
  "ListingCapacity" integer,
  "Currency" integer,
  "SalePrice" numeric,
  "RentPrice" numeric,
  "HasCommonExpenses" boolean,
  "CommonExpensesValue" numeric,
  "IsElectricityIncluded" boolean,
  "IsWaterIncluded" boolean,
  "IsPriceVisible" boolean,
  "Status" integer,
  "IsActive" boolean,
  "IsPropertyVisible" boolean,
  "IsFeatured" boolean,
  "BlockedForBooking" boolean,
  "MaxGuests" integer,
  "HasCatering" boolean,
  "HasSoundSystem" boolean,
  "ClosingHour" time without time zone,
  "AllowedEventsDescription" text,
  "AmenityNames" text[],
  "Amenities" jsonb,
  "Policies" jsonb,
  "ContentSections" jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ep."Id" as "EstatePropertyId",
    ep."OwnerId",
    ep."Neighborhood",
    ep."City",
    ep."State",
    ep."Country",
    ep."LocationLatitude",
    ep."LocationLongitude",
    ep."AreaValue",
    ep."AreaUnit",
    ep."Bedrooms",
    ep."Bathrooms",
    ep."HasGarage",
    ep."GarageSpaces",
    ep."HasLaundryRoom",
    ep."HasPool",
    ep."HasBalcony",
    ep."IsFurnished",
    ep."Capacity",
    ep."LocationCategory",
    ep."ViewType",
    l."Id" as "ListingId",
    l."ListingType",
    l."Title",
    l."Description" as "ListingDescription",
    l."AvailableFrom",
    l."Capacity" as "ListingCapacity",
    l."Currency",
    l."SalePrice",
    l."RentPrice",
    l."HasCommonExpenses",
    l."CommonExpensesValue",
    l."IsElectricityIncluded",
    l."IsWaterIncluded",
    l."IsPriceVisible",
    l."Status",
    l."IsActive",
    l."IsPropertyVisible",
    l."IsFeatured",
    l."BlockedForBooking",
    ev."MaxGuests",
    ev."HasCatering",
    ev."HasSoundSystem",
    ev."ClosingHour",
    ev."AllowedEventsDescription",
    coalesce(a_names."AmenityNames", array[]::text[]) as "AmenityNames",
    public.build_property_amenities_json(ep."Id") as "Amenities",
    public.build_property_policies_json(ep."Id", 'EventVenue'::public."ListingType") as "Policies",
    public.build_property_content_sections_json(ep."Id", 'EventVenue'::public."PropertyType") as "ContentSections"
  from public."EstateProperties" ep
  join public."Listings" l
    on l."EstatePropertyId" = ep."Id"
   and l."IsDeleted" = false
   and l."IsActive" = true
   and l."IsPropertyVisible" = true
   and l."ListingType" = 'EventVenue'::public."ListingType"
  left join public."EventVenueExtension" ev
    on ev."EstatePropertyId" = ep."Id"
  left join (
    select
      epa."EstatePropertyId",
      array_agg(a."Name" order by a."Name") as "AmenityNames"
    from public."EstatePropertyAmenity" epa
    join public."Amenities" a
      on a."Id" = epa."AmenityId"
     and a."IsDeleted" = false
     and a."PropertyType" = 'EventVenue'::public."PropertyType"
    where epa."DeletedAtUtc" is null
    group by epa."EstatePropertyId"
  ) as a_names
    on a_names."EstatePropertyId" = ep."Id"
  where ep."IsDeleted" = false
    and ep."Id" = p_property_id;
$$;

-- ---------------------------------------------------------------------------
-- 3) get_public_summer_rent_property_by_id — Policies + ContentSections
-- ---------------------------------------------------------------------------
drop function if exists public.get_public_summer_rent_property_by_id(uuid);

create function public.get_public_summer_rent_property_by_id(p_property_id uuid)
returns table(
  "EstatePropertyId" uuid,
  "OwnerId" uuid,
  "Neighborhood" character varying,
  "City" character varying,
  "State" character varying,
  "Country" character varying,
  "LocationLatitude" numeric,
  "LocationLongitude" numeric,
  "AreaValue" numeric,
  "AreaUnit" integer,
  "Bedrooms" integer,
  "Bathrooms" integer,
  "HasGarage" boolean,
  "GarageSpaces" integer,
  "HasLaundryRoom" boolean,
  "HasPool" boolean,
  "HasBalcony" boolean,
  "IsFurnished" boolean,
  "Capacity" integer,
  "LocationCategory" public."LocationCategory",
  "ViewType" public."ViewType",
  "MinStayDays" integer,
  "MaxStayDays" integer,
  "LeadTimeDays" integer,
  "BufferDays" integer,
  "ListingId" uuid,
  "ListingType" public."ListingType",
  "Title" text,
  "ListingDescription" character varying,
  "AvailableFrom" timestamp with time zone,
  "ListingCapacity" integer,
  "Currency" integer,
  "SalePrice" numeric,
  "RentPrice" numeric,
  "HasCommonExpenses" boolean,
  "CommonExpensesValue" numeric,
  "IsElectricityIncluded" boolean,
  "IsWaterIncluded" boolean,
  "IsPriceVisible" boolean,
  "Status" integer,
  "IsActive" boolean,
  "IsPropertyVisible" boolean,
  "IsFeatured" boolean,
  "BlockedForBooking" boolean,
  "AmenityNames" text[],
  "Amenities" jsonb,
  "Policies" jsonb,
  "ContentSections" jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ep."Id" as "EstatePropertyId",
    ep."OwnerId",
    ep."Neighborhood",
    ep."City",
    ep."State",
    ep."Country",
    ep."LocationLatitude",
    ep."LocationLongitude",
    ep."AreaValue",
    ep."AreaUnit",
    ep."Bedrooms",
    ep."Bathrooms",
    ep."HasGarage",
    ep."GarageSpaces",
    ep."HasLaundryRoom",
    ep."HasPool",
    ep."HasBalcony",
    ep."IsFurnished",
    ep."Capacity",
    ep."LocationCategory",
    ep."ViewType",
    sx."MinStayDays",
    sx."MaxStayDays",
    sx."LeadTimeDays",
    sx."BufferDays",
    l."Id" as "ListingId",
    l."ListingType",
    l."Title",
    l."Description" as "ListingDescription",
    l."AvailableFrom",
    l."Capacity" as "ListingCapacity",
    l."Currency",
    l."SalePrice",
    l."RentPrice",
    l."HasCommonExpenses",
    l."CommonExpensesValue",
    l."IsElectricityIncluded",
    l."IsWaterIncluded",
    l."IsPriceVisible",
    l."Status",
    l."IsActive",
    l."IsPropertyVisible",
    l."IsFeatured",
    l."BlockedForBooking",
    coalesce(a_names."AmenityNames", array[]::text[]) as "AmenityNames",
    public.build_property_amenities_json(ep."Id") as "Amenities",
    public.build_property_policies_json(ep."Id", 'SummerRent'::public."ListingType") as "Policies",
    public.build_property_content_sections_json(ep."Id", 'SummerRent'::public."PropertyType") as "ContentSections"
  from public."EstateProperties" ep
  join public."Listings" l
    on l."EstatePropertyId" = ep."Id"
   and l."IsDeleted" = false
   and l."IsActive" = true
   and l."IsPropertyVisible" = true
   and l."ListingType" = 'SummerRent'::public."ListingType"
  left join public."SummerRentExtension" sx
    on sx."EstatePropertyId" = ep."Id"
  left join (
    select
      epa."EstatePropertyId",
      array_agg(a."Name" order by a."Name") as "AmenityNames"
    from public."EstatePropertyAmenity" epa
    join public."Amenities" a
      on a."Id" = epa."AmenityId"
     and a."IsDeleted" = false
     and a."PropertyType" = 'SummerRent'::public."PropertyType"
    where epa."DeletedAtUtc" is null
    group by epa."EstatePropertyId"
  ) as a_names
    on a_names."EstatePropertyId" = ep."Id"
  where ep."IsDeleted" = false
    and ep."Id" = p_property_id;
$$;

-- ---------------------------------------------------------------------------
-- 4) duplicate_estate_property — copy policies + content sections
-- ---------------------------------------------------------------------------
create or replace function public.duplicate_estate_property(
  p_original_property_id text,
  p_user_id text,
  p_new_title text default null::text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_original_property record;
  v_new_property_id uuid;
  v_member_id uuid;
  v_company_id uuid;
  v_owner_id uuid;
  v_new_title text;
  v_old_section_id uuid;
  v_new_section_id uuid;
begin
  select
    "StreetName", "HouseNumber", "Neighborhood", "City", "State", "ZipCode", "Country",
    "LocationLatitude", "LocationLongitude", "Title", "Type", "AreaValue", "AreaUnit",
    "Bedrooms", "Bathrooms", "HasGarage", "GarageSpaces", "OwnerId"
  into v_original_property
  from "EstateProperties"
  where "Id" = p_original_property_id::uuid;

  select id, company_id into v_member_id, v_company_id
  from members
  where id::text = p_user_id;

  begin
    v_owner_id := get_or_create_owner(v_member_id, v_company_id, null);
  exception when undefined_function then
    v_owner_id := coalesce(v_member_id, v_company_id);
  end;

  v_new_title := coalesce(p_new_title, v_original_property."Title" || ' (Copy)');
  v_new_property_id := gen_random_uuid();

  insert into "EstateProperties" (
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
    now(),
    now()
  );

  insert into "Listings" (
    "Id",
    "EstatePropertyId",
    "ListingType",
    "Description",
    "AvailableFrom",
    "Capacity",
    "Currency",
    "SalePrice",
    "RentPrice",
    "HasCommonExpenses",
    "CommonExpensesValue",
    "IsElectricityIncluded",
    "IsWaterIncluded",
    "IsPriceVisible",
    "Status",
    "IsActive",
    "IsPropertyVisible",
    "IsFeatured",
    "BlockedForBooking",
    "IsDeleted",
    "Created",
    "CreatedBy",
    "LastModified",
    "LastModifiedBy"
  )
  select
    gen_random_uuid(),
    v_new_property_id,
    src."ListingType",
    src."Description",
    src."AvailableFrom",
    src."Capacity",
    src."Currency",
    src."SalePrice",
    src."RentPrice",
    src."HasCommonExpenses",
    src."CommonExpensesValue",
    src."IsElectricityIncluded",
    src."IsWaterIncluded",
    src."IsPriceVisible",
    src."Status",
    src."IsActive",
    src."IsPropertyVisible",
    false,
    coalesce(src."BlockedForBooking", false),
    false,
    now(),
    p_user_id,
    now(),
    p_user_id
  from "Listings" src
  where src."EstatePropertyId" = p_original_property_id::uuid
    and src."IsDeleted" = false
  order by src."Created" desc
  limit 1;

  insert into "PropertyImages" ("Id", "EstatePropertyId", "Url", "IsMain", "Order", "CreatedAtUtc")
  select gen_random_uuid(), v_new_property_id, "Url", "IsMain", "Order", now()
  from "PropertyImages"
  where "EstatePropertyId" = p_original_property_id::uuid;

  insert into "PropertyDocuments" ("Id", "EstatePropertyId", "Title", "Url", "CreatedAtUtc")
  select gen_random_uuid(), v_new_property_id, "Title", "Url", now()
  from "PropertyDocuments"
  where "EstatePropertyId" = p_original_property_id::uuid;

  insert into "PropertyVideos" ("Id", "EstatePropertyId", "Url", "Title", "ThumbnailUrl", "CreatedAtUtc")
  select gen_random_uuid(), v_new_property_id, "Url", "Title", "ThumbnailUrl", now()
  from "PropertyVideos"
  where "EstatePropertyId" = p_original_property_id::uuid;

  insert into "EstatePropertyAmenity" (
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
  from "EstatePropertyAmenity" epa
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

  return get_estate_property_by_id(v_new_property_id::text);
end;
$$;

commit;
