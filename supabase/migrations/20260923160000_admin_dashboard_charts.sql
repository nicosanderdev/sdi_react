-- Snapshot counts for the admin global dashboard charts.
-- Plans and properties ignore the period and site filter.
-- Visit charts use the same period and site filter as get_admin_guest_visit_overview.
-- An active property is a non-deleted estate with a non-deleted, active listing
-- of that type (Listings.IsActive). A property with both guest listings counts in both.

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_charts(
  p_period text DEFAULT 'last30days'::text,
  p_listing_type text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start date;
  v_today date;
  v_listing public."ListingType";
  v_count_visits boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  v_count_visits := public.guest_listing_filter_is_valid(p_listing_type);
  v_listing := CASE
    WHEN v_count_visits THEN public.guest_listing_filter_value(p_listing_type)
    ELSE NULL
  END;
  v_start := public.guest_visit_period_start(p_period);
  v_today := public.guest_visit_local_date(now());

  RETURN (
    WITH ranked AS (
      SELECT
        bpa."MemberOrCompanyId" AS member_id,
        p."Id" AS plan_id,
        row_number() OVER (
          PARTITION BY bpa."MemberOrCompanyId"
          ORDER BY bpa."StartDate" DESC, bpa."Created" DESC
        ) AS rn
      FROM public."BillingPlanAssignments" bpa
      JOIN public."Plans" p
        ON p."Id" = bpa."PlanId"
       AND p."Audience" = 'member'
       AND p."IsDeleted" = false
      JOIN public."Members" m
        ON m."Id" = bpa."MemberOrCompanyId"
       AND m."IsDeleted" = false
      WHERE bpa."SubjectType" = 'member'
        AND bpa."IsActive" = true
    ),
    current_plan AS (
      SELECT member_id, plan_id
      FROM ranked
      WHERE rn = 1
    ),
    plan_rows AS (
      SELECT
        p."Key" AS key,
        p."Name" AS name,
        count(cp.member_id)::bigint AS users
      FROM public."Plans" p
      LEFT JOIN current_plan cp ON cp.plan_id = p."Id"
      WHERE p."Audience" = 'member'
        AND p."IsDeleted" = false
      GROUP BY p."Id", p."Key", p."Name"
    ),
    unassigned AS (
      SELECT count(*)::bigint AS users
      FROM public."Members" m
      WHERE m."IsDeleted" = false
        AND NOT EXISTS (
          SELECT 1 FROM current_plan cp WHERE cp.member_id = m."Id"
        )
    ),
    property_counts AS (
      SELECT l."ListingType"::text AS listing_type, count(DISTINCT ep."Id")::bigint AS properties
      FROM public."EstateProperties" ep
      JOIN public."Listings" l
        ON l."EstatePropertyId" = ep."Id"
      WHERE ep."IsDeleted" = false
        AND l."IsDeleted" = false
        AND l."IsActive" = true
        AND l."ListingType" IN ('SummerRent'::public."ListingType", 'EventVenue'::public."ListingType")
      GROUP BY l."ListingType"
    ),
    property_views AS (
      SELECT pvl."ListingType"::text AS listing_type, count(*)::bigint AS views
      FROM public."PropertyVisitLogs" pvl
      WHERE v_count_visits
        AND pvl."IsDeleted" = false
        AND pvl."VisitDate" >= v_start
        AND pvl."VisitDate" <= v_today
        AND (v_listing IS NULL OR pvl."ListingType" = v_listing)
      GROUP BY pvl."ListingType"
    ),
    page_counts AS (
      SELECT
        pvl."PageKey" AS page_key,
        pvl."ListingType"::text AS listing_type,
        count(*)::bigint AS views
      FROM public."PageVisitLogs" pvl
      WHERE v_count_visits
        AND pvl."IsDeleted" = false
        AND pvl."PageKey" IN ('home', 'search', 'about', 'how_it_works', 'contact')
        AND pvl."VisitDate" >= v_start
        AND pvl."VisitDate" <= v_today
        AND (v_listing IS NULL OR pvl."ListingType" = v_listing)
      GROUP BY pvl."PageKey", pvl."ListingType"
    ),
    traffic_counts AS (
      SELECT pvl."TrafficSource" AS source, count(*)::bigint AS visits
      FROM public."PageVisitLogs" pvl
      WHERE v_count_visits
        AND pvl."IsDeleted" = false
        AND pvl."VisitDate" >= v_start
        AND pvl."VisitDate" <= v_today
        AND (v_listing IS NULL OR pvl."ListingType" = v_listing)
      GROUP BY pvl."TrafficSource"
    )
    SELECT jsonb_build_object(
      'plans', (
        SELECT coalesce(
          (SELECT jsonb_agg(
            jsonb_build_object('key', pr.key, 'name', pr.name, 'users', pr.users)
            ORDER BY pr.key
          ) FROM plan_rows pr),
          '[]'::jsonb
        ) || jsonb_build_array(
          jsonb_build_object(
            'key', NULL,
            'name', 'Sin plan',
            'users', (SELECT u.users FROM unassigned u)
          )
        )
      ),
      'properties', (
        SELECT coalesce(jsonb_object_agg(t.listing_type, coalesce(pc.properties, 0)), '{}'::jsonb)
        FROM (VALUES ('SummerRent'), ('EventVenue')) AS t(listing_type)
        LEFT JOIN property_counts pc ON pc.listing_type = t.listing_type
      ),
      'propertyViewsBySite', (
        SELECT coalesce(jsonb_object_agg(t.listing_type, coalesce(pv.views, 0)), '{}'::jsonb)
        FROM (VALUES ('SummerRent'), ('EventVenue')) AS t(listing_type)
        LEFT JOIN property_views pv ON pv.listing_type = t.listing_type
      ),
      'pageViews', (
        SELECT coalesce(jsonb_agg(
          jsonb_build_object(
            'pageKey', pages.page_key,
            'SummerRent', coalesce(sr.views, 0),
            'EventVenue', coalesce(ev.views, 0)
          )
          ORDER BY pages.ord
        ), '[]'::jsonb)
        FROM (
          VALUES
            ('home', 1),
            ('search', 2),
            ('about', 3),
            ('how_it_works', 4),
            ('contact', 5)
        ) AS pages(page_key, ord)
        LEFT JOIN page_counts sr
          ON sr.page_key = pages.page_key AND sr.listing_type = 'SummerRent'
        LEFT JOIN page_counts ev
          ON ev.page_key = pages.page_key AND ev.listing_type = 'EventVenue'
      ),
      'traffic', (
        SELECT coalesce(jsonb_object_agg(src.source, coalesce(tc.visits, 0)), '{}'::jsonb)
        FROM (
          VALUES ('direct'), ('organic'), ('social'), ('referral'), ('paid'), ('email')
        ) AS src(source)
        LEFT JOIN traffic_counts tc ON tc.source = src.source
      )
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_admin_dashboard_charts(text, text) IS
  'Admin dashboard chart snapshots: personal-plan user counts, active SummerRent/EventVenue properties, and guest-visit breakdowns for the period and site filter.';

REVOKE ALL ON FUNCTION public.get_admin_dashboard_charts(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_charts(text, text) TO authenticated, service_role;
