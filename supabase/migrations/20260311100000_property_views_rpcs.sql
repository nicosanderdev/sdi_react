-- Migration: Add RPCs for property view metrics (timeseries, by source, per-property).
-- Apply this file manually in Supabase. No table changes; PropertyVisitLogs already exists with Source column.

-- Daily views count for dashboard/reports line chart (scoped by user companies).
CREATE OR REPLACE FUNCTION "public"."get_dashboard_views_timeseries"(
    "p_period" "text",
    "p_company_id" "text" DEFAULT NULL::"text",
    "p_user_id" "text" DEFAULT NULL::"text"
) RETURNS TABLE("date" date, "count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
    v_user_companies UUID[];
    v_member_id UUID;
BEGIN
    SELECT start_date, end_date INTO v_start_date, v_end_date FROM parse_period(p_period);

    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id::UUID AND "IsDeleted" = false;

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
        WHERE uc."MemberId" = v_member_id AND uc."IsDeleted" = false
        INTO v_user_companies;
    END IF;

    RETURN QUERY
    SELECT (pvl."VisitedOnUtc"::date) AS "date", COUNT(*)::bigint AS "count"
    FROM "PropertyVisitLogs" pvl
    JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
    WHERE pvl."VisitedOnUtc" >= v_start_date
      AND pvl."VisitedOnUtc" <= v_end_date
      AND pvl."IsDeleted" = false
      AND ep."OwnerId" = ANY(v_user_companies)
    GROUP BY (pvl."VisitedOnUtc"::date)
    ORDER BY 1;
END;
$$;

-- Views grouped by source for dashboard/reports bar chart (scoped by user companies).
CREATE OR REPLACE FUNCTION "public"."get_views_by_source"(
    "p_period" "text",
    "p_company_id" "text" DEFAULT NULL::"text",
    "p_user_id" "text" DEFAULT NULL::"text"
) RETURNS TABLE("source" text, "visits" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
    v_user_companies UUID[];
    v_member_id UUID;
BEGIN
    SELECT start_date, end_date INTO v_start_date, v_end_date FROM parse_period(p_period);

    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id::UUID AND "IsDeleted" = false;

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
        WHERE uc."MemberId" = v_member_id AND uc."IsDeleted" = false
        INTO v_user_companies;
    END IF;

    RETURN QUERY
    SELECT COALESCE(pvl."Source", 'website')::text AS "source", COUNT(*)::bigint AS "visits"
    FROM "PropertyVisitLogs" pvl
    JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
    WHERE pvl."VisitedOnUtc" >= v_start_date
      AND pvl."VisitedOnUtc" <= v_end_date
      AND pvl."IsDeleted" = false
      AND ep."OwnerId" = ANY(v_user_companies)
    GROUP BY pvl."Source"
    ORDER BY 2 DESC;
END;
$$;

-- Per-property: daily views for a single property (user must have access via company).
CREATE OR REPLACE FUNCTION "public"."get_property_views"(
    "p_property_id" "uuid",
    "p_period" "text",
    "p_user_id" "text" DEFAULT NULL::"text"
) RETURNS TABLE("date" date, "count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
    v_user_companies UUID[];
    v_member_id UUID;
    v_owner_id UUID;
BEGIN
    SELECT start_date, end_date INTO v_start_date, v_end_date FROM parse_period(p_period);

    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id::UUID AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    SELECT ep."OwnerId" INTO v_owner_id
    FROM "EstateProperties" ep
    WHERE ep."Id" = p_property_id AND ep."IsDeleted" = false;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    SELECT ARRAY_AGG(uc."CompanyId")
    FROM "UserCompanies" uc
    WHERE uc."MemberId" = v_member_id AND uc."IsDeleted" = false
    INTO v_user_companies;

    IF v_owner_id <> ALL(COALESCE(v_user_companies, ARRAY[]::UUID[])) THEN
        RAISE EXCEPTION 'Access denied to this property';
    END IF;

    RETURN QUERY
    SELECT (pvl."VisitedOnUtc"::date) AS "date", COUNT(*)::bigint AS "count"
    FROM "PropertyVisitLogs" pvl
    WHERE pvl."PropertyId" = p_property_id
      AND pvl."VisitedOnUtc" >= v_start_date
      AND pvl."VisitedOnUtc" <= v_end_date
      AND pvl."IsDeleted" = false
    GROUP BY (pvl."VisitedOnUtc"::date)
    ORDER BY 1;
END;
$$;

-- Per-property: views by source for a single property (user must have access).
CREATE OR REPLACE FUNCTION "public"."get_property_views_by_source"(
    "p_property_id" "uuid",
    "p_period" "text",
    "p_user_id" "text" DEFAULT NULL::"text"
) RETURNS TABLE("source" text, "visits" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
    v_user_companies UUID[];
    v_member_id UUID;
    v_owner_id UUID;
BEGIN
    SELECT start_date, end_date INTO v_start_date, v_end_date FROM parse_period(p_period);

    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id::UUID AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    SELECT ep."OwnerId" INTO v_owner_id
    FROM "EstateProperties" ep
    WHERE ep."Id" = p_property_id AND ep."IsDeleted" = false;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    SELECT ARRAY_AGG(uc."CompanyId")
    FROM "UserCompanies" uc
    WHERE uc."MemberId" = v_member_id AND uc."IsDeleted" = false
    INTO v_user_companies;

    IF v_owner_id <> ALL(COALESCE(v_user_companies, ARRAY[]::UUID[])) THEN
        RAISE EXCEPTION 'Access denied to this property';
    END IF;

    RETURN QUERY
    SELECT COALESCE(pvl."Source", 'website')::text AS "source", COUNT(*)::bigint AS "visits"
    FROM "PropertyVisitLogs" pvl
    WHERE pvl."PropertyId" = p_property_id
      AND pvl."VisitedOnUtc" >= v_start_date
      AND pvl."VisitedOnUtc" <= v_end_date
      AND pvl."IsDeleted" = false
    GROUP BY pvl."Source"
    ORDER BY 2 DESC;
END;
$$;

-- Optional: composite index for per-property date range queries (uncomment if desired).
-- CREATE INDEX IF NOT EXISTS "IX_PropertyVisitLogs_PropertyId_VisitedOnUtc"
--   ON "public"."PropertyVisitLogs" ("PropertyId", "VisitedOnUtc" DESC);

-- Admin-only: property views summary for admin dashboard (no user/company filter).
-- Returns total views in last 30d and optional 7d/30d breakdown for KPI cards.
CREATE OR REPLACE FUNCTION "public"."get_admin_property_views_summary"(
    "p_period_7d" "text" DEFAULT 'last7days'::text,
    "p_period_30d" "text" DEFAULT 'last30days'::text
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
    v_start_7d TIMESTAMP WITH TIME ZONE;
    v_end_7d TIMESTAMP WITH TIME ZONE;
    v_start_30d TIMESTAMP WITH TIME ZONE;
    v_end_30d TIMESTAMP WITH TIME ZONE;
    v_views_7d BIGINT;
    v_views_30d BIGINT;
BEGIN
    SELECT start_date, end_date INTO v_start_7d, v_end_7d FROM parse_period(p_period_7d);
    SELECT start_date, end_date INTO v_start_30d, v_end_30d FROM parse_period(p_period_30d);

    SELECT COUNT(*) INTO v_views_7d
    FROM "PropertyVisitLogs" pvl
    WHERE pvl."VisitedOnUtc" >= v_start_7d AND pvl."VisitedOnUtc" <= v_end_7d AND pvl."IsDeleted" = false;

    SELECT COUNT(*) INTO v_views_30d
    FROM "PropertyVisitLogs" pvl
    WHERE pvl."VisitedOnUtc" >= v_start_30d AND pvl."VisitedOnUtc" <= v_end_30d AND pvl."IsDeleted" = false;

    RETURN jsonb_build_object(
        'totalPropertyViews', v_views_30d,
        'viewsLast7Days', v_views_7d,
        'viewsLast30Days', v_views_30d
    );
END;
$$;
