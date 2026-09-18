-- Homepage "featured" listings: top-scored public properties, not Listings.IsFeatured.
-- Listings.IsFeatured remains the canonical listing version (see p_only_featured on list RPCs).
-- Ranking uses PropertySearchScores.Scores.offline_base_score from daily-property-search-scores.
-- Sample p_limit (default 6, clamped 1–20) uniformly from the top 10; order is random each call.

-- ---------------------------------------------------------------------------
-- EventVenue
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.get_public_featured_event_venue_properties(
  p_limit integer DEFAULT 6
)
RETURNS TABLE(
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
  "MainImageUrl" text,
  "MainImageAltText" text
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ranked."EstatePropertyId",
    ranked."OwnerId",
    ranked."Neighborhood",
    ranked."City",
    ranked."State",
    ranked."Country",
    ranked."LocationLatitude",
    ranked."LocationLongitude",
    ranked."AreaValue",
    ranked."AreaUnit",
    ranked."Bedrooms",
    ranked."Bathrooms",
    ranked."HasGarage",
    ranked."GarageSpaces",
    ranked."HasLaundryRoom",
    ranked."HasPool",
    ranked."HasBalcony",
    ranked."IsFurnished",
    ranked."Capacity",
    ranked."LocationCategory",
    ranked."ViewType",
    ranked."ListingId",
    ranked."ListingType",
    ranked."Title",
    ranked."ListingDescription",
    ranked."AvailableFrom",
    ranked."ListingCapacity",
    ranked."Currency",
    ranked."SalePrice",
    ranked."RentPrice",
    ranked."HasCommonExpenses",
    ranked."CommonExpensesValue",
    ranked."IsElectricityIncluded",
    ranked."IsWaterIncluded",
    ranked."IsPriceVisible",
    ranked."Status",
    ranked."IsActive",
    ranked."IsPropertyVisible",
    ranked."IsFeatured",
    ranked."BlockedForBooking",
    ranked."MaxGuests",
    ranked."HasCatering",
    ranked."HasSoundSystem",
    ranked."ClosingHour",
    ranked."AllowedEventsDescription",
    ranked."AmenityNames",
    ranked."MainImageUrl",
    ranked."MainImageAltText"
  FROM (
    SELECT
      ep."Id" AS "EstatePropertyId",
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
      l."Id" AS "ListingId",
      l."ListingType",
      l."Title",
      l."Description" AS "ListingDescription",
      l."AvailableFrom",
      l."Capacity" AS "ListingCapacity",
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
      COALESCE(a_names."AmenityNames", ARRAY[]::text[]) AS "AmenityNames",
      (mi.main_image ->> 'url') AS "MainImageUrl",
      (mi.main_image ->> 'altText') AS "MainImageAltText"
    FROM public."EstateProperties" ep
    JOIN public."Listings" l
      ON l."EstatePropertyId" = ep."Id"
     AND l."IsDeleted" = false
     AND l."IsActive" = true
     AND l."IsPropertyVisible" = true
     AND l."IsFeatured" = true
     AND l."BlockedForBooking" = false
     AND l."ListingType" = 'EventVenue'::public."ListingType"
    JOIN public."PropertySearchScores" pss
      ON pss."EstatePropertyId" = ep."Id"
     AND pss."ListingType" = 'EventVenue'
    LEFT JOIN public."EventVenueExtension" ev
      ON ev."EstatePropertyId" = ep."Id"
    LEFT JOIN LATERAL (
      SELECT public.build_property_main_image_json(ep."Id") AS main_image
    ) mi ON true
    LEFT JOIN (
      SELECT
        epa."EstatePropertyId",
        array_agg(a."Name" ORDER BY a."Name") AS "AmenityNames"
      FROM public."EstatePropertyAmenity" epa
      JOIN public."Amenities" a
        ON a."Id" = epa."AmenityId"
       AND a."IsDeleted" = false
       AND a."PropertyType" = 'EventVenue'::public."PropertyType"
      WHERE epa."DeletedAtUtc" IS NULL
      GROUP BY epa."EstatePropertyId"
    ) AS a_names
      ON a_names."EstatePropertyId" = ep."Id"
    WHERE ep."IsDeleted" = false
    ORDER BY
      (pss."Scores" ->> 'offline_base_score')::numeric DESC NULLS LAST,
      ep."Id" ASC
    LIMIT 10
  ) ranked
  ORDER BY random()
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 6), 20));
$$;

COMMENT ON FUNCTION public.get_public_featured_event_venue_properties(integer) IS
  'Homepage strip: sample p_limit (default 6, clamped 1–20) from the top 10 public EventVenue listings by PropertySearchScores.offline_base_score. Canonical listing via Listings.IsFeatured; not a p_only_featured alias.';

REVOKE ALL ON FUNCTION public.get_public_featured_event_venue_properties(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_featured_event_venue_properties(integer)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- SummerRent
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.get_public_featured_summer_rent_properties(
  p_limit integer DEFAULT 6
)
RETURNS TABLE(
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
  "MainImageUrl" text,
  "MainImageAltText" text
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ranked."EstatePropertyId",
    ranked."OwnerId",
    ranked."Neighborhood",
    ranked."City",
    ranked."State",
    ranked."Country",
    ranked."LocationLatitude",
    ranked."LocationLongitude",
    ranked."AreaValue",
    ranked."AreaUnit",
    ranked."Bedrooms",
    ranked."Bathrooms",
    ranked."HasGarage",
    ranked."GarageSpaces",
    ranked."HasLaundryRoom",
    ranked."HasPool",
    ranked."HasBalcony",
    ranked."IsFurnished",
    ranked."Capacity",
    ranked."LocationCategory",
    ranked."ViewType",
    ranked."MinStayDays",
    ranked."MaxStayDays",
    ranked."LeadTimeDays",
    ranked."BufferDays",
    ranked."ListingId",
    ranked."ListingType",
    ranked."Title",
    ranked."ListingDescription",
    ranked."AvailableFrom",
    ranked."ListingCapacity",
    ranked."Currency",
    ranked."SalePrice",
    ranked."RentPrice",
    ranked."HasCommonExpenses",
    ranked."CommonExpensesValue",
    ranked."IsElectricityIncluded",
    ranked."IsWaterIncluded",
    ranked."IsPriceVisible",
    ranked."Status",
    ranked."IsActive",
    ranked."IsPropertyVisible",
    ranked."IsFeatured",
    ranked."BlockedForBooking",
    ranked."AmenityNames",
    ranked."MainImageUrl",
    ranked."MainImageAltText"
  FROM (
    SELECT
      ep."Id" AS "EstatePropertyId",
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
      l."Id" AS "ListingId",
      l."ListingType",
      l."Title",
      l."Description" AS "ListingDescription",
      l."AvailableFrom",
      l."Capacity" AS "ListingCapacity",
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
      COALESCE(a_names."AmenityNames", ARRAY[]::text[]) AS "AmenityNames",
      (mi.main_image ->> 'url') AS "MainImageUrl",
      (mi.main_image ->> 'altText') AS "MainImageAltText"
    FROM public."EstateProperties" ep
    JOIN public."Listings" l
      ON l."EstatePropertyId" = ep."Id"
     AND l."IsDeleted" = false
     AND l."IsActive" = true
     AND l."IsPropertyVisible" = true
     AND l."IsFeatured" = true
     AND l."BlockedForBooking" = false
     AND l."ListingType" = 'SummerRent'::public."ListingType"
    JOIN public."PropertySearchScores" pss
      ON pss."EstatePropertyId" = ep."Id"
     AND pss."ListingType" = 'SummerRent'
    LEFT JOIN public."SummerRentExtension" sx
      ON sx."EstatePropertyId" = ep."Id"
    LEFT JOIN LATERAL (
      SELECT public.build_property_main_image_json(ep."Id") AS main_image
    ) mi ON true
    LEFT JOIN (
      SELECT
        epa."EstatePropertyId",
        array_agg(a."Name" ORDER BY a."Name") AS "AmenityNames"
      FROM public."EstatePropertyAmenity" epa
      JOIN public."Amenities" a
        ON a."Id" = epa."AmenityId"
       AND a."IsDeleted" = false
       AND a."PropertyType" = 'SummerRent'::public."PropertyType"
      WHERE epa."DeletedAtUtc" IS NULL
      GROUP BY epa."EstatePropertyId"
    ) AS a_names
      ON a_names."EstatePropertyId" = ep."Id"
    WHERE ep."IsDeleted" = false
    ORDER BY
      (pss."Scores" ->> 'offline_base_score')::numeric DESC NULLS LAST,
      ep."Id" ASC
    LIMIT 10
  ) ranked
  ORDER BY random()
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 6), 20));
$$;

COMMENT ON FUNCTION public.get_public_featured_summer_rent_properties(integer) IS
  'Homepage strip: sample p_limit (default 6, clamped 1–20) from the top 10 public SummerRent listings by PropertySearchScores.offline_base_score. Canonical listing via Listings.IsFeatured; not a p_only_featured alias.';

REVOKE ALL ON FUNCTION public.get_public_featured_summer_rent_properties(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_featured_summer_rent_properties(integer)
  TO anon, authenticated, service_role;
