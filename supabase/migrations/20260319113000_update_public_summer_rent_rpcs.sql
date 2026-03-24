-- Update public summer rent RPCs to match the current schema.
-- This migration does not run automatically here; apply manually in your DB workflow.

CREATE OR REPLACE FUNCTION public.get_public_summer_rent_properties(
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms integer DEFAULT NULL,
  p_min_guests integer DEFAULT NULL,
  p_location text DEFAULT NULL,
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
    COALESCE(a_names."AmenityNames", ARRAY[]::text[]) AS "AmenityNames"
  FROM public."EstateProperties" ep
  JOIN public."Listings" l
    ON l."EstatePropertyId" = ep."Id"
   AND l."IsDeleted" = false
   AND l."IsActive" = true
   AND l."IsPropertyVisible" = true
   AND l."ListingType" = 'SummerRent'::public."ListingType"
  LEFT JOIN public."SummerRentExtension" sx
    ON sx."EstatePropertyId" = ep."Id"
  LEFT JOIN (
    SELECT
      epa."EstatePropertyId",
      array_agg(a."Name" ORDER BY a."Name") AS "AmenityNames"
    FROM public."EstatePropertyAmenity" epa
    JOIN public."Amenities" a
      ON a."Id" = epa."AmenityId"
     AND a."IsDeleted" = false
    WHERE epa."DeletedAtUtc" IS NULL
    GROUP BY epa."EstatePropertyId"
  ) AS a_names
    ON a_names."EstatePropertyId" = ep."Id"
  WHERE ep."IsDeleted" = false
    AND (p_min_price IS NULL OR l."RentPrice" >= p_min_price)
    AND (p_max_price IS NULL OR l."RentPrice" <= p_max_price)
    AND (p_min_bedrooms IS NULL OR ep."Bedrooms" >= p_min_bedrooms)
    AND (
      p_min_guests IS NULL
      OR COALESCE(l."Capacity", ep."Capacity", ep."Bedrooms" * 2) >= p_min_guests
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


CREATE OR REPLACE FUNCTION public.get_public_summer_rent_property_by_id(
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
    COALESCE(a_names."AmenityNames", ARRAY[]::text[]) AS "AmenityNames"
  FROM public."EstateProperties" ep
  JOIN public."Listings" l
    ON l."EstatePropertyId" = ep."Id"
   AND l."IsDeleted" = false
   AND l."IsActive" = true
   AND l."IsPropertyVisible" = true
   AND l."ListingType" = 'SummerRent'::public."ListingType"
  LEFT JOIN public."SummerRentExtension" sx
    ON sx."EstatePropertyId" = ep."Id"
  LEFT JOIN (
    SELECT
      epa."EstatePropertyId",
      array_agg(a."Name" ORDER BY a."Name") AS "AmenityNames"
    FROM public."EstatePropertyAmenity" epa
    JOIN public."Amenities" a
      ON a."Id" = epa."AmenityId"
     AND a."IsDeleted" = false
    WHERE epa."DeletedAtUtc" IS NULL
    GROUP BY epa."EstatePropertyId"
  ) AS a_names
    ON a_names."EstatePropertyId" = ep."Id"
  WHERE ep."IsDeleted" = false
    AND ep."Id" = p_property_id;
$$;
