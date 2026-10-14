-- Staff preview links for Casas (SummerRent) and Espacios (EventVenue).
-- The raw token is returned once. Only its sha256 hash is stored.
-- Public property RPCs stay limited to active, visible listings.

CREATE TABLE public."PropertyPreviewTokens" (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TokenHash" text NOT NULL,
  "EstatePropertyId" uuid NOT NULL,
  "ListingType" public."ListingType" NOT NULL,
  "ExpiresAt" timestamptz NOT NULL,
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  "CreatedBy" uuid NOT NULL,
  CONSTRAINT "CK_PropertyPreviewTokens_ListingType"
    CHECK ("ListingType" IN ('SummerRent', 'EventVenue'))
);

CREATE UNIQUE INDEX "UX_PropertyPreviewTokens_TokenHash"
  ON public."PropertyPreviewTokens" ("TokenHash");

ALTER TABLE public."PropertyPreviewTokens" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."PropertyPreviewTokens" FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public."PropertyPreviewTokens" IS
  'Bearer grants for a 2-hour staff preview of one property on one guest site. Permission is checked when the token is created.';

CREATE OR REPLACE FUNCTION public.caller_can_preview_estate_property(p_estate_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      public.is_property_owner(auth.uid(), p_estate_property_id)
      OR EXISTS (
        SELECT 1
        FROM public."EstateProperties" ep
        JOIN public."Owners" o
          ON o."Id" = ep."OwnerId"
         AND o."IsDeleted" = false
        JOIN public."CompanyMembers" cm
          ON cm."CompanyId" = o."CompanyId"
         AND cm."IsDeleted" = false
        JOIN public."Members" m
          ON m."Id" = cm."MemberId"
         AND m."IsDeleted" = false
        WHERE ep."Id" = p_estate_property_id
          AND ep."IsDeleted" = false
          AND o."OwnerType" = 'company'
          AND m."UserId" = auth.uid()
      )
    );
$$;

COMMENT ON FUNCTION public.caller_can_preview_estate_property(uuid) IS
  'True for a platform admin, the member owner, or any member of the owning company.';

CREATE OR REPLACE FUNCTION public.current_guest_listing_id(
  p_estate_property_id uuid,
  p_listing_type public."ListingType"
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT l."Id"
  FROM public."Listings" l
  WHERE l."EstatePropertyId" = p_estate_property_id
    AND l."IsDeleted" = false
    AND l."ListingType" = p_listing_type
  ORDER BY l."IsActive" DESC, l."Created" DESC NULLS LAST
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_guest_listing_id(uuid, public."ListingType") IS
  'The listing the panel edits for that site: the active row, or the newest non-deleted row when none is active.';

CREATE OR REPLACE FUNCTION public.list_property_preview_targets(p_estate_property_id uuid)
RETURNS TABLE (
  listing_type text,
  hidden_from_guests boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_type public."ListingType";
  v_listing_id uuid;
  v_active boolean;
  v_visible boolean;
BEGIN
  IF NOT public.caller_can_preview_estate_property(p_estate_property_id) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  FOREACH v_type IN ARRAY ARRAY['SummerRent', 'EventVenue']::public."ListingType"[]
  LOOP
    v_listing_id := NULL;
    v_active := NULL;
    v_visible := NULL;

    SELECT l."Id", l."IsActive", l."IsPropertyVisible"
      INTO v_listing_id, v_active, v_visible
    FROM public."Listings" l
    WHERE l."Id" = public.current_guest_listing_id(p_estate_property_id, v_type);

    IF v_listing_id IS NULL THEN
      CONTINUE;
    END IF;

    listing_type := v_type::text;
    hidden_from_guests := NOT (COALESCE(v_active, false) AND COALESCE(v_visible, false));
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_property_preview_token(
  p_estate_property_id uuid,
  p_listing_type text
)
RETURNS TABLE (
  token text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_listing_type public."ListingType";
  v_raw_token text;
  v_token_hash text;
  v_expires_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.caller_can_preview_estate_property(p_estate_property_id) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_listing_type := p_listing_type::public."ListingType";
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'listing_not_previewable' USING ERRCODE = '22023';
  END;

  IF v_listing_type NOT IN ('SummerRent', 'EventVenue') THEN
    RAISE EXCEPTION 'listing_not_previewable' USING ERRCODE = '22023';
  END IF;

  IF public.current_guest_listing_id(p_estate_property_id, v_listing_type) IS NULL THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_raw_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');
  v_expires_at := now() + interval '2 hours';

  INSERT INTO public."PropertyPreviewTokens" (
    "TokenHash",
    "EstatePropertyId",
    "ListingType",
    "ExpiresAt",
    "CreatedBy"
  ) VALUES (
    v_token_hash,
    p_estate_property_id,
    v_listing_type,
    v_expires_at,
    auth.uid()
  );

  token := v_raw_token;
  expires_at := v_expires_at;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_property_preview_token(p_token text)
RETURNS TABLE (
  status text,
  listing_type text,
  estate_property_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_hash text;
  v_property_id uuid;
  v_listing_type public."ListingType";
  v_expires_at timestamptz;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) = 0 THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  v_hash := encode(digest(btrim(p_token), 'sha256'), 'hex');

  SELECT t."EstatePropertyId", t."ListingType", t."ExpiresAt"
    INTO v_property_id, v_listing_type, v_expires_at
  FROM public."PropertyPreviewTokens" t
  WHERE t."TokenHash" = v_hash;

  IF v_property_id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public."EstateProperties" ep
    WHERE ep."Id" = v_property_id
      AND ep."IsDeleted" = false
  ) OR public.current_guest_listing_id(v_property_id, v_listing_type) IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'ok'::text, v_listing_type::text, v_property_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_summer_rent_property_preview(p_token text)
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
  "Amenities" jsonb,
  "Policies" jsonb,
  "ContentSections" jsonb,
  "Images" jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
  v_listing_type text;
  v_property_id uuid;
BEGIN
  SELECT r.status, r.listing_type, r.estate_property_id
    INTO v_status, v_listing_type, v_property_id
  FROM public.resolve_property_preview_token(p_token) r;

  IF v_status IS DISTINCT FROM 'ok' OR v_listing_type IS DISTINCT FROM 'SummerRent' THEN
    RETURN;
  END IF;

  RETURN QUERY
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
    coalesce(a_names."AmenityNames", array[]::text[]) AS "AmenityNames",
    public.build_property_amenities_json(ep."Id") AS "Amenities",
    public.build_property_policies_json(ep."Id", 'SummerRent'::public."ListingType") AS "Policies",
    public.build_property_content_sections_json(ep."Id", 'SummerRent'::public."PropertyType") AS "ContentSections",
    public.build_property_images_json(ep."Id") AS "Images"
  FROM public."EstateProperties" ep
  JOIN public."Listings" l
    ON l."Id" = public.current_guest_listing_id(ep."Id", 'SummerRent'::public."ListingType")
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
     AND a."PropertyType" = 'SummerRent'::public."PropertyType"
    WHERE epa."DeletedAtUtc" IS NULL
    GROUP BY epa."EstatePropertyId"
  ) AS a_names
    ON a_names."EstatePropertyId" = ep."Id"
  WHERE ep."IsDeleted" = false
    AND ep."Id" = v_property_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_venue_property_preview(p_token text)
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
  "Amenities" jsonb,
  "Policies" jsonb,
  "ContentSections" jsonb,
  "Images" jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
  v_listing_type text;
  v_property_id uuid;
BEGIN
  SELECT r.status, r.listing_type, r.estate_property_id
    INTO v_status, v_listing_type, v_property_id
  FROM public.resolve_property_preview_token(p_token) r;

  IF v_status IS DISTINCT FROM 'ok' OR v_listing_type IS DISTINCT FROM 'EventVenue' THEN
    RETURN;
  END IF;

  RETURN QUERY
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
    coalesce(a_names."AmenityNames", array[]::text[]) AS "AmenityNames",
    public.build_property_amenities_json(ep."Id") AS "Amenities",
    public.build_property_policies_json(ep."Id", 'EventVenue'::public."ListingType") AS "Policies",
    public.build_property_content_sections_json(ep."Id", 'EventVenue'::public."PropertyType") AS "ContentSections",
    public.build_property_images_json(ep."Id") AS "Images"
  FROM public."EstateProperties" ep
  JOIN public."Listings" l
    ON l."Id" = public.current_guest_listing_id(ep."Id", 'EventVenue'::public."ListingType")
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
    AND ep."Id" = v_property_id;
END;
$$;

REVOKE ALL ON FUNCTION public.caller_can_preview_estate_property(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_guest_listing_id(uuid, public."ListingType") FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_property_preview_targets(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_property_preview_token(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_property_preview_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_summer_rent_property_preview(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_event_venue_property_preview(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_property_preview_targets(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_property_preview_token(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_property_preview_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_summer_rent_property_preview(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_venue_property_preview(text) TO anon, authenticated;
