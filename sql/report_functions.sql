-- PostgreSQL Functions for Reports
-- Execute these in your Supabase SQL Editor

-- Function to get dashboard summary with period comparisons
CREATE OR REPLACE FUNCTION get_dashboard_summary(
    p_period TEXT,
    p_company_id TEXT DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_start_date TIMESTAMP WITH TIME ZONE;
    v_current_end_date TIMESTAMP WITH TIME ZONE;
    v_previous_start_date TIMESTAMP WITH TIME ZONE;
    v_previous_end_date TIMESTAMP WITH TIME ZONE;
    v_user_companies TEXT[];
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
    -- Parse period to get date ranges
    SELECT start_date, end_date
    INTO v_current_start_date, v_current_end_date
    FROM parse_period(p_period);

    -- Calculate previous period (same duration before current period)
    SELECT
        v_current_start_date - (v_current_end_date - v_current_start_date + INTERVAL '1 second'),
        v_current_start_date - INTERVAL '1 second'
    INTO v_previous_start_date, v_previous_end_date;

    -- Get accessible company IDs for the user
    IF p_company_id IS NOT NULL THEN
        -- If specific company requested, validate user has access
        SELECT ARRAY[uc."CompanyId"]
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = (SELECT "Id" FROM "Members" WHERE "UserId" = p_user_id AND "IsDeleted" = false)
        AND uc."CompanyId" = p_company_id::UUID
        AND uc."IsDeleted" = false
        INTO v_user_companies;
    ELSE
        -- Get all accessible companies for the user
        SELECT ARRAY_AGG(uc."CompanyId"::TEXT)
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = (SELECT "Id" FROM "Members" WHERE "UserId" = p_user_id AND "IsDeleted" = false)
        AND uc."IsDeleted" = false
        INTO v_user_companies;
    END IF;

    -- Get current period visit count
    SELECT COUNT(*) INTO v_current_visits
    FROM "PropertyVisitLogs" pvl
    JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
    WHERE pvl."VisitedOnUtc" >= v_current_start_date
    AND pvl."VisitedOnUtc" <= v_current_end_date
    AND ep."OwnerId" = ANY(v_user_companies::UUID[]);

    -- Get previous period visit count
    SELECT COUNT(*) INTO v_previous_visits
    FROM "PropertyVisitLogs" pvl
    JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
    WHERE pvl."VisitedOnUtc" >= v_previous_start_date
    AND pvl."VisitedOnUtc" <= v_previous_end_date
    AND ep."OwnerId" = ANY(v_user_companies::UUID[]);

    -- Get current period message count
    SELECT COUNT(*) INTO v_current_messages
    FROM "PropertyMessageLogs" pml
    JOIN "EstateProperties" ep ON pml."PropertyId" = ep."Id"
    WHERE pml."SentOnUtc" >= v_current_start_date
    AND pml."SentOnUtc" <= v_current_end_date
    AND ep."OwnerId" = ANY(v_user_companies::UUID[]);

    -- Get previous period message count
    SELECT COUNT(*) INTO v_previous_messages
    FROM "PropertyMessageLogs" pml
    JOIN "EstateProperties" ep ON pml."PropertyId" = ep."Id"
    WHERE pml."SentOnUtc" >= v_previous_start_date
    AND pml."SentOnUtc" <= v_previous_end_date
    AND ep."OwnerId" = ANY(v_user_companies::UUID[]);

    -- Get total active properties
    SELECT COUNT(*) INTO v_total_active_properties
    FROM "EstateProperties" ep
    JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId"
    WHERE ep."IsDeleted" = false
    AND epv."IsDeleted" = false
    AND epv."IsFeatured" = true
    AND epv."IsPropertyVisible" = true
    AND ep."OwnerId" = ANY(v_user_companies::UUID[]);

    -- Calculate visits stat
    v_visits_stat := calculate_stat(v_current_visits, v_previous_visits);

    -- Calculate messages stat
    v_messages_stat := calculate_stat(v_current_messages, v_previous_messages);

    -- Total properties stat (no trend calculation)
    v_total_properties_stat := jsonb_build_object(
        'currentPeriod', v_total_active_properties,
        'percentageChange', 0,
        'changeDirection', 'neutral'
    );

    -- Calculate conversion rate (messages/visits)
    IF v_current_visits > 0 OR v_previous_visits > 0 THEN
        v_conversion_rate_stat := calculate_conversion_stat(v_current_messages, v_current_visits, v_previous_messages, v_previous_visits);
    ELSE
        v_conversion_rate_stat := NULL;
    END IF;

    RETURN jsonb_build_object(
        'visits', v_visits_stat,
        'messages', v_messages_stat,
        'totalProperties', v_total_properties_stat,
        'conversionRate', v_conversion_rate_stat
    );
END;
$$;

-- Function to calculate stat with percentage change
CREATE OR REPLACE FUNCTION calculate_stat(current_val BIGINT, previous_val BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_percentage_change DECIMAL(10,2);
    v_change_direction TEXT := 'neutral';
BEGIN
    IF previous_val > 0 THEN
        v_percentage_change := ((current_val::DECIMAL - previous_val::DECIMAL) / previous_val::DECIMAL) * 100;
    ELSIF current_val > 0 THEN
        v_percentage_change := 100; -- Infinite increase from 0
    ELSE
        v_percentage_change := 0;
    END IF;

    IF v_percentage_change > 0.5 THEN
        v_change_direction := 'increase';
    ELSIF v_percentage_change < -0.5 THEN
        v_change_direction := 'decrease';
    END IF;

    RETURN jsonb_build_object(
        'currentPeriod', current_val,
        'percentageChange', v_percentage_change,
        'changeDirection', v_change_direction
    );
END;
$$;

-- Function to calculate conversion rate stat
CREATE OR REPLACE FUNCTION calculate_conversion_stat(
    current_messages BIGINT,
    current_visits BIGINT,
    previous_messages BIGINT,
    previous_visits BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_rate DECIMAL(10,2);
    v_previous_rate DECIMAL(10,2);
    v_percentage_change DECIMAL(10,2);
    v_change_direction TEXT := 'neutral';
BEGIN
    -- Calculate rates
    v_current_rate := CASE WHEN current_visits > 0 THEN (current_messages::DECIMAL / current_visits::DECIMAL) * 100 ELSE 0 END;
    v_previous_rate := CASE WHEN previous_visits > 0 THEN (previous_messages::DECIMAL / previous_visits::DECIMAL) * 100 ELSE 0 END;

    -- Calculate percentage change
    IF v_previous_rate > 0 THEN
        v_percentage_change := ((v_current_rate - v_previous_rate) / v_previous_rate) * 100;
    ELSIF v_current_rate > 0 THEN
        v_percentage_change := 100;
    ELSE
        v_percentage_change := 0;
    END IF;

    IF v_percentage_change > 0.5 THEN
        v_change_direction := 'increase';
    ELSIF v_percentage_change < -0.5 THEN
        v_change_direction := 'decrease';
    END IF;

    RETURN jsonb_build_object(
        'currentPeriod', ROUND(v_current_rate)::BIGINT,
        'percentageChange', v_percentage_change,
        'changeDirection', v_change_direction
    );
END;
$$;

-- Function to parse period string to date range
CREATE OR REPLACE FUNCTION parse_period(p_period TEXT)
RETURNS TABLE(start_date TIMESTAMP WITH TIME ZONE, end_date TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := NOW();
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    CASE LOWER(p_period)
        WHEN 'last7days' THEN
            v_end_date := v_now;
            v_start_date := v_now - INTERVAL '7 days';
        WHEN 'last30days' THEN
            v_end_date := v_now;
            v_start_date := v_now - INTERVAL '30 days';
        WHEN 'last90days' THEN
            v_end_date := v_now;
            v_start_date := v_now - INTERVAL '90 days';
        WHEN 'thisyear' THEN
            v_start_date := DATE_TRUNC('year', v_now);
            v_end_date := v_now;
        ELSE
            -- Default to last 30 days
            v_end_date := v_now;
            v_start_date := v_now - INTERVAL '30 days';
    END CASE;

    RETURN QUERY SELECT v_start_date, v_end_date;
END;
$$;

-- Function to get visits by property with pagination
CREATE OR REPLACE FUNCTION get_visits_by_property(
    p_period TEXT,
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 10,
    p_company_id TEXT DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
    v_user_companies TEXT[];
    v_offset INTEGER;
    v_total_count BIGINT;
    v_result_data JSONB[];
    v_item JSONB;
BEGIN
    -- Parse period to get date range
    SELECT start_date, end_date
    INTO v_start_date, v_end_date
    FROM parse_period(p_period);

    -- Get accessible company IDs for the user
    IF p_company_id IS NOT NULL THEN
        SELECT ARRAY[uc."CompanyId"]
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = (SELECT "Id" FROM "Members" WHERE "UserId" = p_user_id AND "IsDeleted" = false)
        AND uc."CompanyId" = p_company_id::UUID
        AND uc."IsDeleted" = false
        INTO v_user_companies;
    ELSE
        SELECT ARRAY_AGG(uc."CompanyId"::TEXT)
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = (SELECT "Id" FROM "Members" WHERE "UserId" = p_user_id AND "IsDeleted" = false)
        AND uc."IsDeleted" = false
        INTO v_user_companies;
    END IF;

    -- Calculate offset
    v_offset := (p_page - 1) * p_limit;

    -- Get total count
    SELECT COUNT(DISTINCT pvl."PropertyId")
    INTO v_total_count
    FROM "PropertyVisitLogs" pvl
    JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
    WHERE pvl."VisitedOnUtc" >= v_start_date
    AND pvl."VisitedOnUtc" <= v_end_date
    AND ep."OwnerId" = ANY(v_user_companies::UUID[]);

    -- Get paginated results
    SELECT ARRAY_AGG(
        jsonb_build_object(
            'propertyId', ep."Id"::TEXT,
            'propertyTitle', ep."Title",
            'address', COALESCE(ep."StreetName", '') || ' ' || COALESCE(ep."HouseNumber", ''),
            'visitCount', stats.visit_count,
            'price', COALESCE(epv."RentPrice"::TEXT, epv."SalePrice"::TEXT),
            'status', CASE epv."Status"
                WHEN 0 THEN 'Sale'
                WHEN 1 THEN 'Rent'
                WHEN 2 THEN 'Reserved'
                WHEN 3 THEN 'Sold'
                WHEN 4 THEN 'Unavailable'
                ELSE 'Unknown'
            END,
            'messages', stats.message_count,
            'visitsTrend', 'flat', -- Placeholder for trend calculation
            'messagesTrend', 'flat', -- Placeholder for trend calculation
            'conversion', '0%', -- Placeholder for conversion calculation
            'conversionTrend', 'flat' -- Placeholder for conversion trend
        )
    )
    INTO v_result_data
    FROM (
        SELECT
            pvl."PropertyId",
            COUNT(*) as visit_count,
            COALESCE((
                SELECT COUNT(*)
                FROM "PropertyMessageLogs" pml
                WHERE pml."PropertyId" = pvl."PropertyId"
                AND pml."SentOnUtc" >= v_start_date
                AND pml."SentOnUtc" <= v_end_date
            ), 0) as message_count
        FROM "PropertyVisitLogs" pvl
        JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
        WHERE pvl."VisitedOnUtc" >= v_start_date
        AND pvl."VisitedOnUtc" <= v_end_date
        AND ep."OwnerId" = ANY(v_user_companies::UUID[])
        GROUP BY pvl."PropertyId"
        ORDER BY visit_count DESC
        LIMIT p_limit
        OFFSET v_offset
    ) stats
    JOIN "EstateProperties" ep ON stats."PropertyId" = ep."Id"
    LEFT JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId"
        AND epv."IsFeatured" = true
        AND epv."IsDeleted" = false;

    RETURN jsonb_build_object(
        'data', v_result_data,
        'total', v_total_count,
        'page', p_page,
        'limit', p_limit
    );
END;
$$;
