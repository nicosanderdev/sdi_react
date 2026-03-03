-- Migration: Update get_dashboard_summary messages metric to count
-- threads started by messages received by the current user.

CREATE OR REPLACE FUNCTION "public"."get_dashboard_summary"(
    "p_period" "text",
    "p_company_id" "text" DEFAULT NULL::"text",
    "p_user_id" "text" DEFAULT NULL::"text"
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
    -- Parse period to get date ranges
    SELECT start_date, end_date
    INTO v_current_start_date, v_current_end_date
    FROM parse_period(p_period);

    -- Calculate previous period (same duration before current period)
    SELECT
        v_current_start_date - (v_current_end_date - v_current_start_date + INTERVAL '1 second'),
        v_current_start_date - INTERVAL '1 second'
    INTO v_previous_start_date, v_previous_end_date;

    -- Resolve current member ID from user ID
    SELECT "Id"
    INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id::UUID
      AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Get accessible company IDs for the user (for property-related stats)
    IF p_company_id IS NOT NULL THEN
        -- If specific company requested, validate user has access
        SELECT ARRAY[uc."CompanyId"]
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = v_member_id
          AND uc."CompanyId" = p_company_id::UUID
          AND uc."IsDeleted" = false
        INTO v_user_companies;
    ELSE
        -- Get all accessible companies for the user
        SELECT ARRAY_AGG(uc."CompanyId")
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = v_member_id
          AND uc."IsDeleted" = false
        INTO v_user_companies;
    END IF;

    -- Get current period visit count
    SELECT COUNT(*) INTO v_current_visits
    FROM "PropertyVisitLogs" pvl
    JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
    WHERE pvl."VisitedOnUtc" >= v_current_start_date
      AND pvl."VisitedOnUtc" <= v_current_end_date
      AND ep."OwnerId" = ANY(v_user_companies);

    -- Get previous period visit count
    SELECT COUNT(*) INTO v_previous_visits
    FROM "PropertyVisitLogs" pvl
    JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
    WHERE pvl."VisitedOnUtc" >= v_previous_start_date
      AND pvl."VisitedOnUtc" <= v_previous_end_date
      AND ep."OwnerId" = ANY(v_user_companies);

    /*
      Messages metric:
      Count unique threads for which the first message received by the
      current user falls within the period. Threads may be direct
      (no PropertyId) or property-related. For property threads we
      respect company scoping via v_user_companies; direct threads
      are always included.
    */

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

    -- Get total active properties
    SELECT COUNT(*) INTO v_total_active_properties
    FROM "EstateProperties" ep
    JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId"
    WHERE ep."IsDeleted" = false
      AND epv."IsDeleted" = false
      AND epv."IsFeatured" = true
      AND epv."IsPropertyVisible" = true
      AND ep."OwnerId" = ANY(v_user_companies);

    -- Calculate visits stat
    v_visits_stat := calculate_stat(v_current_visits, v_previous_visits);

    -- Calculate messages stat using thread-based counts
    v_messages_stat := calculate_stat(v_current_messages, v_previous_messages);

    -- Total properties stat (no trend calculation)
    v_total_properties_stat := jsonb_build_object(
        'currentPeriod', v_total_active_properties,
        'percentageChange', 0,
        'changeDirection', 'neutral'
    );

    -- Calculate conversion rate (messages/visits)
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

