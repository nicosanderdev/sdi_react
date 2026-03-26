-- Manual migration: create public event venue RPCs
-- Apply manually in your database environment.

CREATE OR REPLACE FUNCTION public.get_public_event_venue_properties(
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_min_guests integer DEFAULT NULL::integer,
  p_location text DEFAULT NULL::text,
  p_only_featured boolean DEFAULT false
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
  "AmenityNames" text[]
)
LANGUAGE sql
STABLE
AS $$
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
    COALESCE(a_names."AmenityNames", ARRAY[]::text[]) AS "AmenityNames"
  FROM public."EstateProperties" ep
  JOIN public."Listings" l
    ON l."EstatePropertyId" = ep."Id"
   AND l."IsDeleted" = false
   AND l."IsActive" = true
   AND l."IsPropertyVisible" = true
   AND l."ListingType" = 'EventVenue'::public."ListingType"
  LEFT JOIN public."EventVenueExtension" ev
    ON ev."EstatePropertyId" = ep."Id"
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
    AND (p_min_price IS NULL OR l."RentPrice" >= p_min_price)
    AND (p_max_price IS NULL OR l."RentPrice" <= p_max_price)
    AND (
      p_min_guests IS NULL
      OR COALESCE(ev."MaxGuests", l."Capacity", ep."Capacity", ep."Bedrooms" * 2) >= p_min_guests
    )
    AND (
      p_location IS NULL
      OR (
        ep."City" ILIKE '%' || p_location || '%'
        OR ep."State" ILIKE '%' || p_location || '%'
        OR ep."Neighborhood" ILIKE '%' || p_location || '%'
      )
    )
    AND (NOT p_only_featured OR l."IsFeatured" = true);
$$;

CREATE OR REPLACE FUNCTION public.get_public_event_venue_property_by_id(
  p_property_id uuid
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
  "AmenityNames" text[]
)
LANGUAGE sql
STABLE
AS $$
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
    COALESCE(a_names."AmenityNames", ARRAY[]::text[]) AS "AmenityNames"
  FROM public."EstateProperties" ep
  JOIN public."Listings" l
    ON l."EstatePropertyId" = ep."Id"
   AND l."IsDeleted" = false
   AND l."IsActive" = true
   AND l."IsPropertyVisible" = true
   AND l."ListingType" = 'EventVenue'::public."ListingType"
  LEFT JOIN public."EventVenueExtension" ev
    ON ev."EstatePropertyId" = ep."Id"
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
    AND ep."Id" = p_property_id;
$$;
