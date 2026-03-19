-- Fix: get_admin_properties_list referenced EstateProperties."Title" (which may not exist after refactor)
-- Use the latest Listing title instead: Listings."Title".

BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_properties_list(
    p_page integer DEFAULT 1,
    p_limit integer DEFAULT 20,
    p_user_id uuid DEFAULT NULL::uuid,
    p_status text DEFAULT NULL::text,
    p_location text DEFAULT NULL::text,
    p_search text DEFAULT NULL::text
)
RETURNS TABLE(
    id uuid,
    title character varying,
    owner_name text,
    owner_email character varying,
    city character varying,
    state character varying,
    status integer,
    is_active boolean,
    is_property_visible boolean,
    created timestamp with time zone,
    last_modified timestamp with time zone,
    total_count bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH latest_listing AS (
        SELECT DISTINCT ON (l."EstatePropertyId")
            l."EstatePropertyId",
            l."Title",
            l."Status",
            l."IsActive",
            l."IsPropertyVisible"
        FROM "Listings" l
        WHERE l."IsDeleted" = false
        ORDER BY l."EstatePropertyId", l."Created" DESC
    ),
    filtered_properties AS (
        SELECT
            ep."Id",
            ll."Title" AS "Title",
            CASE
                WHEN o."OwnerType" = 'member' THEN CONCAT(m."FirstName", ' ', m."LastName")
                WHEN o."OwnerType" = 'company' THEN c."Name"
                ELSE 'Unknown Owner'
            END AS owner_name,
            CASE
                WHEN o."OwnerType" = 'member' THEN m."Email"
                WHEN o."OwnerType" = 'company' THEN c."BillingEmail"
                ELSE NULL
            END AS owner_email,
            ep."City",
            ep."State",
            ll."Status",
            ll."IsActive",
            ll."IsPropertyVisible",
            COALESCE(re."Created", ev."Created", sr."Created") AS "Created",
            COALESCE(re."LastModified", ev."LastModified", sr."LastModified") AS "LastModified"
        FROM "EstateProperties" ep
        JOIN latest_listing ll ON ep."Id" = ll."EstatePropertyId"
        JOIN "Owners" o ON ep."OwnerId" = o."Id" AND o."IsDeleted" = false
        LEFT JOIN "Members" m ON o."OwnerType" = 'member' AND o."MemberId" = m."Id" AND m."IsDeleted" = false
        LEFT JOIN "Companies" c ON o."OwnerType" = 'company' AND o."CompanyId" = c."Id" AND c."IsDeleted" = false
        LEFT JOIN "RealEstateExtension" re ON re."EstatePropertyId" = ep."Id"
        LEFT JOIN "EventVenueExtension" ev ON ev."EstatePropertyId" = ep."Id"
        LEFT JOIN "SummerRentExtension" sr ON sr."EstatePropertyId" = ep."Id"
        WHERE ep."IsDeleted" = false
        AND (p_user_id IS NULL OR (
            (o."OwnerType" = 'member' AND o."MemberId" = p_user_id) OR
            (o."OwnerType" = 'company' AND EXISTS (
                SELECT 1 FROM "UserCompanies" uc
                WHERE uc."CompanyId" = o."CompanyId"
                AND uc."MemberId" = p_user_id
                AND uc."IsDeleted" = false
            ))
        ))
        AND (p_status IS NULL OR ll."Status" = CASE
            WHEN p_status = 'sale' THEN 0
            WHEN p_status = 'rent' THEN 1
            WHEN p_status = 'reserved' THEN 2
            WHEN p_status = 'sold' THEN 3
            WHEN p_status = 'unavailable' THEN 4
            ELSE ll."Status"
        END)
        AND (p_location IS NULL OR
            ep."City" ILIKE '%' || p_location || '%' OR
            ep."State" ILIKE '%' || p_location || '%' OR
            CONCAT(ep."City", ', ', ep."State") ILIKE '%' || p_location || '%')
        AND (p_search IS NULL OR
            ll."Title" ILIKE '%' || p_search || '%' OR
            CASE
                WHEN o."OwnerType" = 'member' THEN CONCAT(m."FirstName", ' ', m."LastName")
                WHEN o."OwnerType" = 'company' THEN c."Name"
                ELSE ''
            END ILIKE '%' || p_search || '%' OR
            ep."City" ILIKE '%' || p_search || '%' OR
            ep."State" ILIKE '%' || p_search || '%')
        ORDER BY COALESCE(re."Created", ev."Created", sr."Created") DESC
    ),
    total_count AS (
        SELECT COUNT(*)::bigint AS count FROM filtered_properties
    )
    SELECT
        fp."Id",
        fp."Title"::character varying,
        fp.owner_name,
        fp.owner_email::character varying,
        fp."City"::character varying,
        fp."State"::character varying,
        fp."Status",
        fp."IsActive",
        fp."IsPropertyVisible",
        fp."Created",
        fp."LastModified",
        tc.count
    FROM filtered_properties fp
    CROSS JOIN total_count tc
    LIMIT p_limit
    OFFSET ((p_page - 1) * p_limit);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_property_detail(
    p_property_id uuid
)
RETURNS TABLE(
    id uuid,
    -- address
    street_name character varying,
    house_number character varying,
    neighborhood character varying,
    city character varying,
    state character varying,
    zip_code character varying,
    country character varying,
    location_latitude numeric,
    location_longitude numeric,

    -- structural
    category integer,
    area_value numeric,
    area_unit integer,
    bedrooms integer,
    bathrooms integer,
    garage_spaces integer,

    -- infrastructure
    hasLaundryRoom boolean,
    hasPool boolean,
    hasBalcony boolean,
    isFurnished boolean,
    capacity integer,

    -- location and view categories
    location_category integer,
    view_type integer,

    -- relationships
    owner_id uuid,

    -- real estate extension
    allowsFinancing boolean,
    isNewConstruction boolean,
    hasMortgage boolean,
    hoaFees numeric,
    minContractMonths integer,
    requiresGuarantee boolean,
    guaranteeType text,
    allowsPets boolean,
    
    -- event venue extension
    maxGuests integer,
    hasCatering boolean,
    hasSoundSystem boolean,
    closingHour text,
    allowedEventsDescription text,

    -- summer rent extension
    minStayDays integer,
    maxStayDays integer,
    leadTimeDays integer,
    bufferDays integer,

    -- audit
    isDeleted boolean, -- from EstateProperties table
    created timestamp with time zone, -- from the extensions tables
    createdBy text, -- from the extensions tables
    lastModified timestamp with time zone, -- from the extensions tables
    lastModifiedBy text -- from the extensions tables
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ep."Id",
        ep."StreetName"::character varying,
        ep."HouseNumber"::character varying,
        ep."Neighborhood"::character varying,
        ep."City"::character varying,
        ep."State"::character varying,
        ep."ZipCode"::character varying,
        ep."Country"::character varying,
        ep."LocationLatitude",
        ep."LocationLongitude",
        CASE re."Category"
            WHEN 'Casa'::public."PropertyCategory" THEN 0
            WHEN 'Apartamento'::public."PropertyCategory" THEN 1
            WHEN 'Terreno'::public."PropertyCategory" THEN 2
            WHEN 'Chacra'::public."PropertyCategory" THEN 3
            WHEN 'Campo'::public."PropertyCategory" THEN 4
            ELSE NULL
        END,
        ep."AreaValue",
        ep."AreaUnit",
        ep."Bedrooms",
        ep."Bathrooms",
        ep."GarageSpaces",
        ep."HasLaundryRoom",
        ep."HasPool",
        ep."HasBalcony",
        ep."IsFurnished",
        ep."Capacity",
        CASE ep."LocationCategory"
            WHEN 'rural'::public."LocationCategory" THEN 0
            WHEN 'city'::public."LocationCategory" THEN 1
            WHEN 'near_shore'::public."LocationCategory" THEN 2
            ELSE NULL
        END,
        CASE ep."ViewType"
            WHEN 'city'::public."ViewType" THEN 0
            WHEN 'mountain'::public."ViewType" THEN 1
            WHEN 'rural'::public."ViewType" THEN 2
            WHEN 'sea'::public."ViewType" THEN 3
            ELSE NULL
        END,
        ep."OwnerId",
        re."AllowsFinancing",
        re."IsNewConstruction",
        re."HasMortgage",
        re."HOAFees",
        re."MinContractMonths",
        re."RequiresGuarantee",
        re."GuaranteeType",
        re."AllowsPets",
        ev."MaxGuests",
        ev."HasCatering",
        ev."HasSoundSystem",
        ev."ClosingHour"::text,
        ev."AllowedEventsDescription",
        sr."MinStayDays",
        sr."MaxStayDays",
        sr."LeadTimeDays",
        sr."BufferDays",
        ep."IsDeleted",
        COALESCE(re."Created", ev."Created", sr."Created"),
        COALESCE(re."CreatedBy", ev."CreatedBy", sr."CreatedBy"),
        COALESCE(re."LastModified", ev."LastModified", sr."LastModified"),
        COALESCE(re."LastModifiedBy", ev."LastModifiedBy", sr."LastModifiedBy")
    FROM "EstateProperties" ep
    LEFT JOIN "RealEstateExtension" re ON re."EstatePropertyId" = ep."Id"
    LEFT JOIN "EventVenueExtension" ev ON ev."EstatePropertyId" = ep."Id"
    LEFT JOIN "SummerRentExtension" sr ON sr."EstatePropertyId" = ep."Id"
    WHERE ep."Id" = p_property_id
      AND ep."IsDeleted" = false;
END;
$$;

-- ============================================================================
-- Property views RPCs (analytics_events-backed)
-- These replace the obsolete property view RPCs used by ReportService.
-- ============================================================================

-- Per-property views: daily breakdown for a single property (requires user access).
CREATE OR REPLACE FUNCTION public.get_property_views(
    p_property_id uuid,
    p_period text,
    p_user_id uuid
)
RETURNS TABLE(date date, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
    v_member_id uuid;
    v_user_companies uuid[];
BEGIN
    SELECT start_date, end_date
    INTO v_start_date, v_end_date
    FROM public.parse_period(p_period);

    SELECT "Id"
    INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id
      AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    SELECT COALESCE(ARRAY_AGG(uc."CompanyId"), ARRAY[]::uuid[])
    INTO v_user_companies
    FROM "UserCompanies" uc
    WHERE uc."MemberId" = v_member_id
      AND uc."IsDeleted" = false;

    RETURN QUERY
    SELECT
        (ae.created_at AT TIME ZONE 'UTC')::date AS date,
        COUNT(*)::bigint AS count
    FROM public.analytics_events ae
    WHERE ae.event_name = 'property_view'
      AND ae.property_id = p_property_id::text
      AND ae.created_at >= v_start_date
      AND ae.created_at <= v_end_date
      AND EXISTS (
        SELECT 1
        FROM "EstateProperties" ep
        JOIN "Owners" o ON o."Id" = ep."OwnerId"
        WHERE ep."Id" = p_property_id
          AND ep."IsDeleted" = false
          AND o."IsDeleted" = false
          AND (
            (o."OwnerType" = 'member' AND o."MemberId" = v_member_id)
            OR
            (o."OwnerType" = 'company' AND o."CompanyId" = ANY(v_user_companies))
          )
      )
    GROUP BY (ae.created_at AT TIME ZONE 'UTC')::date
    ORDER BY (ae.created_at AT TIME ZONE 'UTC')::date;
END;
$$;

-- Per-property views by source for a single property (requires user access).
CREATE OR REPLACE FUNCTION public.get_property_views_by_source(
    p_property_id uuid,
    p_period text,
    p_user_id uuid
)
RETURNS TABLE(source text, visits bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
    v_member_id uuid;
    v_user_companies uuid[];
BEGIN
    SELECT start_date, end_date
    INTO v_start_date, v_end_date
    FROM public.parse_period(p_period);

    SELECT "Id"
    INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id
      AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    SELECT COALESCE(ARRAY_AGG(uc."CompanyId"), ARRAY[]::uuid[])
    INTO v_user_companies
    FROM "UserCompanies" uc
    WHERE uc."MemberId" = v_member_id
      AND uc."IsDeleted" = false;

    RETURN QUERY
    SELECT
        COALESCE(ae.source, 'website') AS source,
        COUNT(*)::bigint AS visits
    FROM public.analytics_events ae
    WHERE ae.event_name = 'property_view'
      AND ae.property_id = p_property_id::text
      AND ae.created_at >= v_start_date
      AND ae.created_at <= v_end_date
      AND EXISTS (
        SELECT 1
        FROM "EstateProperties" ep
        JOIN "Owners" o ON o."Id" = ep."OwnerId"
        WHERE ep."Id" = p_property_id
          AND ep."IsDeleted" = false
          AND o."IsDeleted" = false
          AND (
            (o."OwnerType" = 'member' AND o."MemberId" = v_member_id)
            OR
            (o."OwnerType" = 'company' AND o."CompanyId" = ANY(v_user_companies))
          )
      )
    GROUP BY COALESCE(ae.source, 'website')
    ORDER BY visits DESC;
END;
$$;

COMMIT;