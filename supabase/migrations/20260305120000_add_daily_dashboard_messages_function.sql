-- Migration: Add get_daily_dashboard_messages function
-- NOTE: This migration only defines the function. Apply it manually in Supabase.

CREATE OR REPLACE FUNCTION "public"."get_daily_dashboard_messages"(
    "p_period" "text",
    "p_company_id" "text" DEFAULT NULL::"text",
    "p_user_id" "text" DEFAULT NULL::"text"
) RETURNS TABLE("date" date, "count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
    v_current_start_date TIMESTAMP WITH TIME ZONE;
    v_current_end_date TIMESTAMP WITH TIME ZONE;
    v_user_companies UUID[];
    v_member_id UUID;
BEGIN
    -- Parse period to get date ranges (reuse same helper as get_dashboard_summary)
    SELECT start_date, end_date
    INTO v_current_start_date, v_current_end_date
    FROM parse_period(p_period);

    -- Resolve current member ID from user ID
    SELECT "Id"
    INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id::UUID
      AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Get accessible company IDs for the user (for property-related threads)
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

    /*
      Messages metric (daily):
      For the current member, we count unique threads where the first
      message received by this user falls within the requested period.
      Threads may be direct (no PropertyId) or property-related. For
      property threads we respect company scoping via v_user_companies;
      direct threads are always included.
    */

    RETURN QUERY
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
    SELECT
        (first_received_at::date) AS "date",
        COUNT(*) AS "count"
    FROM member_threads
    WHERE first_received_at >= v_current_start_date
      AND first_received_at <= v_current_end_date
    GROUP BY (first_received_at::date)
    ORDER BY (first_received_at::date);
END;
$$;

