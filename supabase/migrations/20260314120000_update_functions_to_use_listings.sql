-- ============================================================================
-- Update RPCs to use Listings instead of EstatePropertyValues
-- Apply this migration after the Listings table and refactor are in place.
-- ============================================================================

-- 1) get_admin_properties_list: one listing per property (latest by Created)
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
            ep."Title",
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
            ep."Created",
            ep."LastModified"
        FROM "EstateProperties" ep
        JOIN latest_listing ll ON ep."Id" = ll."EstatePropertyId"
        JOIN "Owners" o ON ep."OwnerId" = o."Id" AND o."IsDeleted" = false
        LEFT JOIN "Members" m ON o."OwnerType" = 'member' AND o."MemberId" = m."Id" AND m."IsDeleted" = false
        LEFT JOIN "Companies" c ON o."OwnerType" = 'company' AND o."CompanyId" = c."Id" AND c."IsDeleted" = false
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
             ep."Title" ILIKE '%' || p_search || '%' OR
             CASE
                 WHEN o."OwnerType" = 'member' THEN CONCAT(m."FirstName", ' ', m."LastName")
                 WHEN o."OwnerType" = 'company' THEN c."Name"
                 ELSE ''
             END ILIKE '%' || p_search || '%' OR
             ep."City" ILIKE '%' || p_search || '%' OR
             ep."State" ILIKE '%' || p_search || '%')
        ORDER BY ep."Created" DESC
    ),
    total_count AS (
        SELECT COUNT(*)::bigint AS count FROM filtered_properties
    )
    SELECT
        fp."Id",
        fp."Title",
        fp.owner_name,
        fp.owner_email,
        fp."City",
        fp."State",
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

-- 2) get_admin_property_detail: one listing per property (latest by Created)
CREATE OR REPLACE FUNCTION public.get_admin_property_detail(p_property_id uuid)
RETURNS TABLE(
    id uuid,
    title character varying,
    street_name character varying,
    house_number character varying,
    neighborhood character varying,
    city character varying,
    state character varying,
    zip_code character varying,
    country character varying,
    location_latitude numeric,
    location_longitude numeric,
    type integer,
    area_value numeric,
    area_unit integer,
    bedrooms integer,
    bathrooms integer,
    has_garage boolean,
    garage_spaces integer,
    description character varying,
    available_from timestamp with time zone,
    capacity integer,
    currency integer,
    sale_price numeric,
    rent_price numeric,
    has_common_expenses boolean,
    common_expenses_value numeric,
    is_electricity_included boolean,
    is_water_included boolean,
    is_price_visible boolean,
    status integer,
    is_active boolean,
    is_property_visible boolean,
    is_featured boolean,
    owner_id uuid,
    owner_name text,
    owner_email character varying,
    created timestamp with time zone,
    last_modified timestamp with time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ep."Id",
        ep."Title",
        ep."StreetName",
        ep."HouseNumber",
        ep."Neighborhood",
        ep."City",
        ep."State",
        ep."ZipCode",
        ep."Country",
        ep."LocationLatitude",
        ep."LocationLongitude",
        ep."Type",
        ep."AreaValue",
        ep."AreaUnit",
        ep."Bedrooms",
        ep."Bathrooms",
        ep."HasGarage",
        ep."GarageSpaces",
        l."Description",
        l."AvailableFrom",
        l."Capacity",
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
        ep."OwnerId",
        CASE
            WHEN o."OwnerType" = 'member' THEN CONCAT(m."FirstName", ' ', m."LastName")
            WHEN o."OwnerType" = 'company' THEN c."Name"
            ELSE 'Unknown Owner'
        END,
        CASE
            WHEN o."OwnerType" = 'member' THEN m."Email"
            WHEN o."OwnerType" = 'company' THEN c."BillingEmail"
            ELSE NULL
        END,
        ep."Created",
        ep."LastModified"
    FROM "EstateProperties" ep
    JOIN LATERAL (
        SELECT *
        FROM "Listings"
        WHERE "EstatePropertyId" = ep."Id" AND "IsDeleted" = false
        ORDER BY "Created" DESC
        LIMIT 1
    ) l ON true
    JOIN "Owners" o ON ep."OwnerId" = o."Id" AND o."IsDeleted" = false
    LEFT JOIN "Members" m ON o."OwnerType" = 'member' AND o."MemberId" = m."Id" AND m."IsDeleted" = false
    LEFT JOIN "Companies" c ON o."OwnerType" = 'company' AND o."CompanyId" = c."Id" AND c."IsDeleted" = false
    WHERE ep."Id" = p_property_id AND ep."IsDeleted" = false;
END;
$$;

-- 3) get_admin_property_statistics: count by latest listing per property
CREATE OR REPLACE FUNCTION public.get_admin_property_statistics()
RETURNS TABLE(
    total_properties bigint,
    incomplete_properties bigint,
    never_published bigint,
    active_properties bigint,
    archived_properties bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH latest_listing AS (
        SELECT DISTINCT ON (l."EstatePropertyId")
            l."EstatePropertyId",
            l."IsActive",
            l."IsPropertyVisible"
        FROM "Listings" l
        WHERE l."IsDeleted" = false
        ORDER BY l."EstatePropertyId", l."Created" DESC
    )
    SELECT
        (SELECT COUNT(*)::bigint FROM "EstateProperties" WHERE "IsDeleted" = false),
        (SELECT COUNT(*)::bigint
         FROM "EstateProperties" ep
         JOIN latest_listing ll ON ep."Id" = ll."EstatePropertyId"
         WHERE ep."IsDeleted" = false AND ll."IsActive" = false),
        (SELECT COUNT(*)::bigint
         FROM "EstateProperties" ep
         JOIN latest_listing ll ON ep."Id" = ll."EstatePropertyId"
         WHERE ep."IsDeleted" = false AND ll."IsPropertyVisible" = false AND ll."IsActive" = true),
        (SELECT COUNT(*)::bigint
         FROM "EstateProperties" ep
         JOIN latest_listing ll ON ep."Id" = ll."EstatePropertyId"
         WHERE ep."IsDeleted" = false AND ll."IsPropertyVisible" = true AND ll."IsActive" = true),
        (SELECT COUNT(*)::bigint
         FROM "EstateProperties" ep
         JOIN latest_listing ll ON ep."Id" = ll."EstatePropertyId"
         WHERE ep."IsDeleted" = false AND ll."IsActive" = false AND ll."IsPropertyVisible" = false);
END;
$$;

-- 4) admin_hide_property: update all listings for the property
CREATE OR REPLACE FUNCTION public.admin_hide_property(
    p_property_id uuid,
    p_reason text DEFAULT NULL::text
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_user_id uuid;
    v_updated integer;
BEGIN
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'User not authenticated';
        RETURN;
    END IF;

    UPDATE "Listings"
    SET
        "IsPropertyVisible" = false,
        "LastModified" = now(),
        "LastModifiedBy" = v_current_user_id::text
    WHERE "EstatePropertyId" = p_property_id AND "IsDeleted" = false;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
        RETURN QUERY SELECT false, 'Property not found or already hidden';
        RETURN;
    END IF;

    INSERT INTO "PropertyModerationActions" (
        "PropertyId",
        "ActionType",
        "Reason",
        "PerformedBy",
        "PerformedAt"
    ) VALUES (
        p_property_id,
        'hide',
        p_reason,
        v_current_user_id,
        now()
    );

    RETURN QUERY SELECT true, 'Property hidden successfully';
END;
$$;

-- 5) admin_mark_property_invalid: update all listings for the property
CREATE OR REPLACE FUNCTION public.admin_mark_property_invalid(
    p_property_id uuid,
    p_reason text,
    p_mark_as_spam boolean DEFAULT false
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_user_id uuid;
    v_action_type text;
    v_updated integer;
BEGIN
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'User not authenticated';
        RETURN;
    END IF;

    v_action_type := CASE WHEN p_mark_as_spam THEN 'mark_spam' ELSE 'mark_invalid' END;

    UPDATE "Listings"
    SET
        "Status" = 4,
        "IsPropertyVisible" = false,
        "IsActive" = false,
        "LastModified" = now(),
        "LastModifiedBy" = v_current_user_id::text
    WHERE "EstatePropertyId" = p_property_id AND "IsDeleted" = false;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
        RETURN QUERY SELECT false, 'Property not found';
        RETURN;
    END IF;

    INSERT INTO "PropertyModerationActions" (
        "PropertyId",
        "ActionType",
        "Reason",
        "PerformedBy",
        "PerformedAt"
    ) VALUES (
        p_property_id,
        v_action_type,
        p_reason,
        v_current_user_id,
        now()
    );

    RETURN QUERY SELECT true, CASE WHEN p_mark_as_spam THEN 'Property marked as spam' ELSE 'Property marked as invalid' END;
END;
$$;

-- 6) admin_delete_property: soft-delete listings then hard-delete property
CREATE OR REPLACE FUNCTION public.admin_delete_property(
    p_property_id uuid,
    p_reason text
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_user_id uuid;
BEGIN
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'User not authenticated';
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "EstateProperties" WHERE "Id" = p_property_id AND "IsDeleted" = false) THEN
        RETURN QUERY SELECT false, 'Property not found or already deleted';
        RETURN;
    END IF;

    INSERT INTO "PropertyModerationActions" (
        "PropertyId",
        "ActionType",
        "Reason",
        "PerformedBy",
        "PerformedAt"
    ) VALUES (
        p_property_id,
        'delete',
        p_reason,
        v_current_user_id,
        now()
    );

    UPDATE "Listings"
    SET
        "IsDeleted" = true,
        "LastModified" = now(),
        "LastModifiedBy" = v_current_user_id::text
    WHERE "EstatePropertyId" = p_property_id;

    DELETE FROM "EstateProperties" WHERE "Id" = p_property_id;

    RETURN QUERY SELECT true, 'Property permanently deleted';
END;
$$;

-- 7) get_owner_onboarding_state: published count via Listings
CREATE OR REPLACE FUNCTION public.get_owner_onboarding_state(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_user_id uuid;
    v_row record;
    v_published_count bigint;
    v_plan_key int;
    v_plan_published int;
BEGIN
    SELECT "UserId" INTO v_user_id FROM public."Members" WHERE "Id" = p_member_id AND "IsDeleted" = false;
    IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('error', 'unauthorized');
    END IF;

    SELECT COUNT(DISTINCT ep."Id")::bigint INTO v_published_count
    FROM public."EstateProperties" ep
    INNER JOIN public."Listings" l ON l."EstatePropertyId" = ep."Id" AND l."IsDeleted" = false
    WHERE ep."OwnerId" = p_member_id AND ep."IsDeleted" = false
      AND l."IsPropertyVisible" = true AND l."IsActive" = true;

    SELECT p."Key", p."MaxPublishedProperties" INTO v_plan_key, v_plan_published
    FROM public."Subscriptions" s
    INNER JOIN public."Plans" p ON p."Id" = s."PlanId"
    WHERE s."OwnerId" = v_user_id AND s."Status" = 1 AND s."IsDeleted" = false
    ORDER BY s."CreatedAt" DESC
    LIMIT 1;

    IF v_plan_published IS NULL THEN
        v_plan_published := 5;
        v_plan_key := 0;
    END IF;

    SELECT
        oo."CurrentStep",
        oo."CompletedAt",
        oo."DismissedAt",
        m."EmailVerifiedAt" IS NOT NULL AS email_verified,
        m."PhoneVerifiedAt" IS NOT NULL AS phone_verified
    INTO v_row
    FROM public."Members" m
    LEFT JOIN public."OwnerOnboarding" oo ON oo."MemberId" = m."Id" AND oo."IsDeleted" = false
    WHERE m."Id" = p_member_id AND m."IsDeleted" = false;

    IF v_row IS NULL THEN
        RETURN jsonb_build_object(
            'current_step', 0,
            'completed_at', NULL,
            'dismissed_at', NULL,
            'published_properties_count', COALESCE(v_published_count, 0),
            'email_verified', false,
            'phone_verified', false,
            'plan_published_limit', v_plan_published,
            'plan_key', COALESCE(v_plan_key, 0)
        );
    END IF;

    RETURN jsonb_build_object(
        'current_step', COALESCE(v_row."CurrentStep", 0),
        'completed_at', v_row."CompletedAt",
        'dismissed_at', v_row."DismissedAt",
        'published_properties_count', COALESCE(v_published_count, 0),
        'email_verified', COALESCE(v_row.email_verified, false),
        'phone_verified', COALESCE(v_row.phone_verified, false),
        'plan_published_limit', v_plan_published,
        'plan_key', COALESCE(v_plan_key, 0)
    );
END;
$$;

-- 8) get_dashboard_summary: v_total_active_properties via Listings
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
    p_period text,
    p_company_id text DEFAULT NULL::text,
    p_user_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_start_date TIMESTAMP WITH TIME ZONE;
    v_current_end_date TIMESTAMP WITH TIME ZONE;
    v_previous_start_date TIMESTAMP WITH TIME ZONE;
    v_previous_end_date TIMESTAMP WITH TIME ZONE;
    v_user_companies UUID[];
    v_member_id UUID;
    v_current_visits BIGINT;
    v_previous_visits BIGINT;
    v_current_messages BIGINT;
    v_previous_messages BIGINT;
    v_total_active_properties BIGINT;
    v_visits_stat JSONB;
    v_messages_stat JSONB;
    v_total_properties_stat JSONB;
    v_conversion_rate_stat JSONB;
BEGIN
    SELECT start_date, end_date
    INTO v_current_start_date, v_current_end_date
    FROM parse_period(p_period);

    SELECT
        v_current_start_date - (v_current_end_date - v_current_start_date + INTERVAL '1 second'),
        v_current_start_date - INTERVAL '1 second'
    INTO v_previous_start_date, v_previous_end_date;

    SELECT "Id"
    INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id::UUID
      AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    IF p_company_id IS NOT NULL THEN
        SELECT ARRAY[uc."CompanyId"]
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = v_member_id
          AND uc."CompanyId" = p_company_id::UUID
          AND uc."IsDeleted" = false
        INTO v_user_companies;
    ELSE
        SELECT ARRAY_AGG(uc."CompanyId")
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = v_member_id
          AND uc."IsDeleted" = false
        INTO v_user_companies;
    END IF;

    SELECT COUNT(*) INTO v_current_visits
    FROM "PropertyVisitLogs" pvl
    JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
    WHERE pvl."VisitedOnUtc" >= v_current_start_date
      AND pvl."VisitedOnUtc" <= v_current_end_date
      AND ep."OwnerId" = ANY(v_user_companies);

    SELECT COUNT(*) INTO v_previous_visits
    FROM "PropertyVisitLogs" pvl
    JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
    WHERE pvl."VisitedOnUtc" >= v_previous_start_date
      AND pvl."VisitedOnUtc" <= v_previous_end_date
      AND ep."OwnerId" = ANY(v_user_companies);

    WITH member_threads AS (
        SELECT
            mt."Id" AS thread_id,
            MIN(mr."ReceivedAtUtc") AS first_received_at
        FROM "MessageRecipients" mr
        JOIN "Messages" m ON mr."MessageId" = m."Id"
        JOIN "MessageThreads" mt ON m."ThreadId" = mt."Id"
        LEFT JOIN "EstateProperties" ep ON mt."PropertyId" = ep."Id"
        WHERE mr."RecipientId" = v_member_id
          AND mr."IsDeleted" = false
          AND m."IsDeleted" = false
          AND mt."IsDeleted" = false
          AND (
                mt."PropertyId" IS NULL
                OR ep."OwnerId" = ANY(v_user_companies)
          )
        GROUP BY mt."Id"
    )
    SELECT COUNT(*) INTO v_current_messages
    FROM member_threads
    WHERE first_received_at >= v_current_start_date
      AND first_received_at <= v_current_end_date;

    WITH member_threads AS (
        SELECT
            mt."Id" AS thread_id,
            MIN(mr."ReceivedAtUtc") AS first_received_at
        FROM "MessageRecipients" mr
        JOIN "Messages" m ON mr."MessageId" = m."Id"
        JOIN "MessageThreads" mt ON m."ThreadId" = mt."Id"
        LEFT JOIN "EstateProperties" ep ON mt."PropertyId" = ep."Id"
        WHERE mr."RecipientId" = v_member_id
          AND mr."IsDeleted" = false
          AND m."IsDeleted" = false
          AND mt."IsDeleted" = false
          AND (
                mt."PropertyId" IS NULL
                OR ep."OwnerId" = ANY(v_user_companies)
          )
        GROUP BY mt."Id"
    )
    SELECT COUNT(*) INTO v_previous_messages
    FROM member_threads
    WHERE first_received_at >= v_previous_start_date
      AND first_received_at <= v_previous_end_date;

    SELECT COUNT(DISTINCT ep."Id")::BIGINT INTO v_total_active_properties
    FROM "EstateProperties" ep
    JOIN "Listings" l ON ep."Id" = l."EstatePropertyId" AND l."IsDeleted" = false
    WHERE ep."IsDeleted" = false
      AND l."IsPropertyVisible" = true
      AND l."IsActive" = true
      AND ep."OwnerId" = ANY(v_user_companies);

    v_visits_stat := calculate_stat(v_current_visits, v_previous_visits);
    v_messages_stat := calculate_stat(v_current_messages, v_previous_messages);
    v_total_properties_stat := jsonb_build_object(
        'currentPeriod', v_total_active_properties,
        'percentageChange', 0,
        'changeDirection', 'neutral'
    );
    IF v_current_visits > 0 OR v_previous_visits > 0 THEN
        v_conversion_rate_stat := calculate_conversion_stat(
            v_current_messages,
            v_current_visits,
            v_previous_messages,
            v_previous_visits
        );
    ELSE
        v_conversion_rate_stat := jsonb_build_object(
            'currentPeriod', 0,
            'percentageChange', 0,
            'changeDirection', 'neutral'
        );
    END IF;

    RETURN jsonb_build_object(
        'visits', v_visits_stat,
        'messages', v_messages_stat,
        'totalProperties', v_total_properties_stat,
        'conversionRate', v_conversion_rate_stat
    );
END;
$$;

-- 9) get_visits_by_property: lateral join to one listing (featured preferred, then latest)
CREATE OR REPLACE FUNCTION public.get_visits_by_property(
    p_period text,
    p_page integer DEFAULT 1,
    p_limit integer DEFAULT 10,
    p_company_id text DEFAULT NULL::text,
    p_user_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
    v_user_companies UUID[];
    v_offset INTEGER;
    v_total_count BIGINT;
    v_result_data JSONB[];
    v_item JSONB;
BEGIN
    SELECT start_date, end_date
    INTO v_start_date, v_end_date
    FROM parse_period(p_period);

    IF p_company_id IS NOT NULL THEN
        SELECT ARRAY[uc."CompanyId"]
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = (SELECT "Id" FROM "Members" WHERE "UserId" = p_user_id::UUID AND "IsDeleted" = false)
        AND uc."CompanyId" = p_company_id::UUID
        AND uc."IsDeleted" = false
        INTO v_user_companies;
    ELSE
        SELECT ARRAY_AGG(uc."CompanyId")
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = (SELECT "Id" FROM "Members" WHERE "UserId" = p_user_id::UUID AND "IsDeleted" = false)
        AND uc."IsDeleted" = false
        INTO v_user_companies;
    END IF;

    v_offset := (p_page - 1) * p_limit;

    SELECT COUNT(DISTINCT pvl."PropertyId")
    INTO v_total_count
    FROM "PropertyVisitLogs" pvl
    JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
    WHERE pvl."VisitedOnUtc" >= v_start_date
    AND pvl."VisitedOnUtc" <= v_end_date
    AND ep."OwnerId" = ANY(v_user_companies);

    SELECT ARRAY_AGG(
        jsonb_build_object(
            'propertyId', ep."Id"::TEXT,
            'propertyTitle', ep."Title",
            'address', COALESCE(ep."StreetName", '') || ' ' || COALESCE(ep."HouseNumber", ''),
            'visitCount', stats.visit_count,
            'price', COALESCE(l."RentPrice"::TEXT, l."SalePrice"::TEXT),
            'status', CASE l."Status"
                WHEN 0 THEN 'Sale'
                WHEN 1 THEN 'Rent'
                WHEN 2 THEN 'Reserved'
                WHEN 3 THEN 'Sold'
                WHEN 4 THEN 'Unavailable'
                ELSE 'Unknown'
            END,
            'messages', stats.message_count,
            'visitsTrend', 'flat',
            'messagesTrend', 'flat',
            'conversion', '0%',
            'conversionTrend', 'flat'
        )
    )
    INTO v_result_data
    FROM (
        SELECT
            pvl."PropertyId",
            COUNT(*) AS visit_count,
            COALESCE((
                SELECT COUNT(*)
                FROM "PropertyMessageLogs" pml
                WHERE pml."PropertyId" = pvl."PropertyId"
                AND pml."SentOnUtc" >= v_start_date
                AND pml."SentOnUtc" <= v_end_date
            ), 0) AS message_count
        FROM "PropertyVisitLogs" pvl
        JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
        WHERE pvl."VisitedOnUtc" >= v_start_date
        AND pvl."VisitedOnUtc" <= v_end_date
        AND ep."OwnerId" = ANY(v_user_companies)
        GROUP BY pvl."PropertyId"
        ORDER BY visit_count DESC
        LIMIT p_limit
        OFFSET v_offset
    ) stats
    JOIN "EstateProperties" ep ON stats."PropertyId" = ep."Id"
    LEFT JOIN LATERAL (
        SELECT "RentPrice", "SalePrice", "Status"
        FROM "Listings"
        WHERE "EstatePropertyId" = ep."Id" AND "IsDeleted" = false
        ORDER BY "IsFeatured" DESC, "Created" DESC
        LIMIT 1
    ) l ON true;

    RETURN jsonb_build_object(
        'data', COALESCE(v_result_data, ARRAY[]::jsonb[]),
        'total', v_total_count,
        'page', p_page,
        'limit', p_limit
    );
END;
$$;

-- 10) duplicate_estate_property: copy from Listings (latest), include ListingType and BlockedForBooking
CREATE OR REPLACE FUNCTION public.duplicate_estate_property(
    p_original_property_id text,
    p_user_id text,
    p_new_title text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_original_property RECORD;
    v_new_property_id UUID;
    v_member_id UUID;
    v_company_id UUID;
    v_owner_id UUID;
    v_new_title TEXT;
BEGIN
    SELECT
        "StreetName", "HouseNumber", "Neighborhood", "City", "State", "ZipCode", "Country",
        "LocationLatitude", "LocationLongitude", "Title", "Type", "AreaValue", "AreaUnit",
        "Bedrooms", "Bathrooms", "HasGarage", "GarageSpaces", "OwnerId"
    INTO v_original_property
    FROM "EstateProperties"
    WHERE "Id" = p_original_property_id::UUID;

    SELECT id, company_id INTO v_member_id, v_company_id
    FROM members
    WHERE id::text = p_user_id;

    BEGIN
        v_owner_id := get_or_create_owner(v_member_id, v_company_id, NULL);
    EXCEPTION WHEN undefined_function THEN
        v_owner_id := COALESCE(v_member_id, v_company_id);
    END;

    v_new_title := COALESCE(p_new_title, v_original_property."Title" || ' (Copy)');
    v_new_property_id := gen_random_uuid();

    INSERT INTO "EstateProperties" (
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
    ) VALUES (
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
        NOW(),
        NOW()
    );

    INSERT INTO "Listings" (
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
    SELECT
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
        COALESCE(src."BlockedForBooking", false),
        false,
        NOW(),
        p_user_id,
        NOW(),
        p_user_id
    FROM "Listings" src
    WHERE src."EstatePropertyId" = p_original_property_id::UUID
      AND src."IsDeleted" = false
    ORDER BY src."Created" DESC
    LIMIT 1;

    INSERT INTO "PropertyImages" ("Id", "EstatePropertyId", "Url", "IsMain", "Order", "CreatedAtUtc")
    SELECT gen_random_uuid(), v_new_property_id, "Url", "IsMain", "Order", NOW()
    FROM "PropertyImages"
    WHERE "EstatePropertyId" = p_original_property_id::UUID;

    INSERT INTO "PropertyDocuments" ("Id", "EstatePropertyId", "Title", "Url", "CreatedAtUtc")
    SELECT gen_random_uuid(), v_new_property_id, "Title", "Url", NOW()
    FROM "PropertyDocuments"
    WHERE "EstatePropertyId" = p_original_property_id::UUID;

    INSERT INTO "PropertyVideos" ("Id", "EstatePropertyId", "Url", "Title", "ThumbnailUrl", "CreatedAtUtc")
    SELECT gen_random_uuid(), v_new_property_id, "Url", "Title", "ThumbnailUrl", NOW()
    FROM "PropertyVideos"
    WHERE "EstatePropertyId" = p_original_property_id::UUID;

    INSERT INTO "EstatePropertyAmenity" ("EstatePropertyId", "AmenityId", "CreatedAtUtc")
    SELECT v_new_property_id, "AmenityId", NOW()
    FROM "EstatePropertyAmenity"
    WHERE "EstatePropertyId" = p_original_property_id::UUID;

    RETURN get_estate_property_by_id(v_new_property_id::text);
END;
$$;

-- 11) update_estate_property (first overload: no are_pets_allowed/capacity): update latest listing or insert
CREATE OR REPLACE FUNCTION public.update_estate_property(
    p_property_id text,
    p_user_id text,
    p_street_name text DEFAULT NULL::text,
    p_house_number text DEFAULT NULL::text,
    p_neighborhood text DEFAULT NULL::text,
    p_city text DEFAULT NULL::text,
    p_state text DEFAULT NULL::text,
    p_zip_code text DEFAULT NULL::text,
    p_country text DEFAULT NULL::text,
    p_location_lat double precision DEFAULT NULL::double precision,
    p_location_lng double precision DEFAULT NULL::double precision,
    p_title text DEFAULT NULL::text,
    p_property_type integer DEFAULT NULL::integer,
    p_area_value double precision DEFAULT NULL::double precision,
    p_area_unit integer DEFAULT NULL::integer,
    p_bedrooms integer DEFAULT NULL::integer,
    p_bathrooms integer DEFAULT NULL::integer,
    p_has_garage boolean DEFAULT NULL::boolean,
    p_garage_spaces integer DEFAULT NULL::integer,
    p_description text DEFAULT NULL::text,
    p_available_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_currency integer DEFAULT NULL::integer,
    p_sale_price double precision DEFAULT NULL::double precision,
    p_rent_price double precision DEFAULT NULL::double precision,
    p_has_common_expenses boolean DEFAULT NULL::boolean,
    p_common_expenses_value double precision DEFAULT NULL::double precision,
    p_is_electricity_included boolean DEFAULT NULL::boolean,
    p_is_water_included boolean DEFAULT NULL::boolean,
    p_is_price_visible boolean DEFAULT NULL::boolean,
    p_status integer DEFAULT NULL::integer,
    p_is_active boolean DEFAULT NULL::boolean,
    p_is_property_visible boolean DEFAULT NULL::boolean,
    p_property_images jsonb DEFAULT NULL::jsonb,
    p_property_documents jsonb DEFAULT NULL::jsonb,
    p_property_videos jsonb DEFAULT NULL::jsonb,
    p_property_amenities jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_image_record JSONB;
    v_document_record JSONB;
    v_video_record JSONB;
    v_amenity_record JSONB;
    v_listing_id uuid;
BEGIN
    UPDATE "EstateProperties"
    SET
        "StreetName" = COALESCE(p_street_name, "StreetName"),
        "HouseNumber" = COALESCE(p_house_number, "HouseNumber"),
        "Neighborhood" = COALESCE(p_neighborhood, "Neighborhood"),
        "City" = COALESCE(p_city, "City"),
        "State" = COALESCE(p_state, "State"),
        "ZipCode" = COALESCE(p_zip_code, "ZipCode"),
        "Country" = COALESCE(p_country, "Country"),
        "LocationLatitude" = COALESCE(p_location_lat, "LocationLatitude"),
        "LocationLongitude" = COALESCE(p_location_lng, "LocationLongitude"),
        "Title" = COALESCE(p_title, "Title"),
        "Type" = COALESCE(p_property_type, "Type"),
        "AreaValue" = COALESCE(p_area_value, "AreaValue"),
        "AreaUnit" = COALESCE(p_area_unit, "AreaUnit"),
        "Bedrooms" = COALESCE(p_bedrooms, "Bedrooms"),
        "Bathrooms" = COALESCE(p_bathrooms, "Bathrooms"),
        "HasGarage" = COALESCE(p_has_garage, "HasGarage"),
        "GarageSpaces" = COALESCE(p_garage_spaces, "GarageSpaces"),
        "LastModified" = NOW(),
        "LastModifiedBy" = p_user_id
    WHERE "Id" = p_property_id::UUID;

    SELECT l."Id" INTO v_listing_id
    FROM "Listings" l
    WHERE l."EstatePropertyId" = p_property_id::UUID AND l."IsDeleted" = false
    ORDER BY l."Created" DESC
    LIMIT 1;

    IF v_listing_id IS NOT NULL THEN
        UPDATE "Listings"
        SET
            "Description" = COALESCE(p_description, "Description"),
            "AvailableFrom" = COALESCE(p_available_from, "AvailableFrom"),
            "Currency" = COALESCE(p_currency, "Currency"),
            "SalePrice" = COALESCE(p_sale_price, "SalePrice"),
            "RentPrice" = COALESCE(p_rent_price, "RentPrice"),
            "HasCommonExpenses" = COALESCE(p_has_common_expenses, "HasCommonExpenses"),
            "CommonExpensesValue" = COALESCE(p_common_expenses_value, "CommonExpensesValue"),
            "IsElectricityIncluded" = COALESCE(p_is_electricity_included, "IsElectricityIncluded"),
            "IsWaterIncluded" = COALESCE(p_is_water_included, "IsWaterIncluded"),
            "IsPriceVisible" = COALESCE(p_is_price_visible, "IsPriceVisible"),
            "Status" = COALESCE(p_status, "Status"),
            "IsActive" = COALESCE(p_is_active, "IsActive"),
            "IsPropertyVisible" = COALESCE(p_is_property_visible, "IsPropertyVisible"),
            "LastModified" = NOW(),
            "LastModifiedBy" = p_user_id
        WHERE "Id" = v_listing_id;
    ELSE
        INSERT INTO "Listings" (
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
            "IsDeleted",
            "Created",
            "CreatedBy",
            "LastModified",
            "LastModifiedBy"
        ) VALUES (
            gen_random_uuid(),
            p_property_id::UUID,
            'RealEstate'::"ListingType",
            p_description,
            COALESCE(p_available_from, NOW()),
            1,
            COALESCE(p_currency, 0),
            p_sale_price,
            p_rent_price,
            COALESCE(p_has_common_expenses, false),
            p_common_expenses_value,
            p_is_electricity_included,
            p_is_water_included,
            COALESCE(p_is_price_visible, true),
            COALESCE(p_status, 0),
            COALESCE(p_is_active, true),
            COALESCE(p_is_property_visible, true),
            false,
            false,
            NOW(),
            p_user_id,
            NOW(),
            p_user_id
        );
    END IF;

    IF p_property_images IS NOT NULL THEN
        DELETE FROM "PropertyImages" WHERE "EstatePropertyId" = p_property_id::UUID;
        IF jsonb_array_length(p_property_images) > 0 THEN
            FOR v_image_record IN SELECT value FROM jsonb_array_elements(p_property_images)
            LOOP
                INSERT INTO "PropertyImages" (
                    "Id", "EstatePropertyId", "Url", "IsMain", "Order", "CreatedAtUtc"
                ) VALUES (
                    gen_random_uuid(),
                    p_property_id::UUID,
                    v_image_record->>'url',
                    CASE WHEN (v_image_record->>'isMain')::boolean THEN true ELSE false END,
                    COALESCE((v_image_record->>'order')::integer, 0),
                    NOW()
                );
            END LOOP;
        END IF;
    END IF;

    IF p_property_documents IS NOT NULL THEN
        DELETE FROM "PropertyDocuments" WHERE "EstatePropertyId" = p_property_id::UUID;
        IF jsonb_array_length(p_property_documents) > 0 THEN
            FOR v_document_record IN SELECT value FROM jsonb_array_elements(p_property_documents)
            LOOP
                INSERT INTO "PropertyDocuments" (
                    "Id", "EstatePropertyId", "Title", "Url", "CreatedAtUtc"
                ) VALUES (
                    gen_random_uuid(),
                    p_property_id::UUID,
                    v_document_record->>'title',
                    v_document_record->>'url',
                    NOW()
                );
            END LOOP;
        END IF;
    END IF;

    IF p_property_videos IS NOT NULL THEN
        DELETE FROM "PropertyVideos" WHERE "EstatePropertyId" = p_property_id::UUID;
        IF jsonb_array_length(p_property_videos) > 0 THEN
            FOR v_video_record IN SELECT value FROM jsonb_array_elements(p_property_videos)
            LOOP
                INSERT INTO "PropertyVideos" (
                    "Id", "EstatePropertyId", "Url", "Title", "ThumbnailUrl", "CreatedAtUtc"
                ) VALUES (
                    gen_random_uuid(),
                    p_property_id::UUID,
                    v_video_record->>'url',
                    v_video_record->>'title',
                    v_video_record->>'thumbnailUrl',
                    NOW()
                );
            END LOOP;
        END IF;
    END IF;

    IF p_property_amenities IS NOT NULL THEN
        DELETE FROM "EstatePropertyAmenity" WHERE "EstatePropertyId" = p_property_id::UUID;
        IF jsonb_array_length(p_property_amenities) > 0 THEN
            FOR v_amenity_record IN SELECT value FROM jsonb_array_elements(p_property_amenities)
            LOOP
                INSERT INTO "EstatePropertyAmenity" (
                    "EstatePropertyId", "AmenityId", "CreatedAtUtc"
                ) VALUES (
                    p_property_id::UUID,
                    (v_amenity_record->>'id')::uuid,
                    NOW()
                );
            END LOOP;
        END IF;
    END IF;

    SELECT jsonb_build_object(
        'id', ep."Id",
        'streetName', ep."StreetName",
        'houseNumber', ep."HouseNumber",
        'neighborhood', ep."Neighborhood",
        'city', ep."City",
        'state', ep."State",
        'zipCode', ep."ZipCode",
        'country', ep."Country",
        'location', jsonb_build_object('lat', ep."LocationLatitude", 'lng', ep."LocationLongitude"),
        'title', ep."Title",
        'type', ep."Type",
        'areaValue', ep."AreaValue",
        'areaUnit', ep."AreaUnit",
        'bedrooms', ep."Bedrooms",
        'bathrooms', ep."Bathrooms",
        'hasGarage', ep."HasGarage",
        'garageSpaces', ep."GarageSpaces",
        'description', l."Description",
        'availableFrom', l."AvailableFrom",
        'currency', CASE l."Currency"
            WHEN 0 THEN 'USD'
            WHEN 1 THEN 'UYU'
            WHEN 2 THEN 'BRL'
            WHEN 3 THEN 'EUR'
            WHEN 4 THEN 'GBP'
            ELSE 'USD'
        END,
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
        'ownerId', ep."OwnerId",
        'created', ep."Created",
        'capacity', l."Capacity",
        'estatePropertyValues', jsonb_build_array(
            jsonb_build_object(
                'id', l."Id",
                'description', l."Description",
                'availableFrom', l."AvailableFrom",
                'capacity', l."Capacity",
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
                'isFeatured', l."IsFeatured",
                'createdAt', l."Created",
                'createdBy', l."CreatedBy",
                'lastModified', l."LastModified",
                'lastModifiedBy', l."LastModifiedBy"
            )
        )
    ) INTO v_result
    FROM "EstateProperties" ep
    JOIN LATERAL (
        SELECT *
        FROM "Listings"
        WHERE "EstatePropertyId" = ep."Id" AND "IsDeleted" = false
        ORDER BY "Created" DESC
        LIMIT 1
    ) l ON true
    WHERE ep."Id" = p_property_id::UUID;

    RETURN v_result;
END;
$$;
