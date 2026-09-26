-- Conversion rate numerator: guest-submitted bookings (OTP verified + details sent),
-- not every booking hold. Hold status 'confirmed' means the guest finished checkout;
-- Bookings.Status Pending/Confirmed is owner/admin and is not required.
-- Denominator stays property views. "holds" / "Inicios de reserva" stay all holds.

CREATE OR REPLACE FUNCTION public.guest_hold_is_submitted_booking(
  p_status text,
  p_otp_verified_at timestamptz
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_status, '') = 'confirmed' AND p_otp_verified_at IS NOT NULL;
$$;

COMMENT ON FUNCTION public.guest_hold_is_submitted_booking(text, timestamptz) IS
  'True when the guest verified OTP and submitted details (confirm_booking_from_hold). Pending owner/admin booking confirmation still counts.';

-- ---------------------------------------------------------------------------
-- Owner dashboard summary
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_period text DEFAULT 'last30days'::text,
  p_company_id uuid DEFAULT NULL::uuid,
  p_user_id uuid DEFAULT NULL::uuid,
  p_property_id uuid DEFAULT NULL::uuid,
  p_listing_type text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_start date;
  v_today date;
  v_listing public."ListingType";
  v_total_properties bigint := 0;
  v_visits bigint := 0;
  v_holds bigint := 0;
  v_submitted bigint := 0;
BEGIN
  IF NOT public.guest_listing_filter_is_valid(p_listing_type) THEN
    RETURN jsonb_build_object(
      'visits', jsonb_build_object('currentPeriod', 0),
      'holds', jsonb_build_object('currentPeriod', 0),
      'messages', jsonb_build_object('currentPeriod', 0),
      'totalProperties', jsonb_build_object('currentPeriod', 0),
      'conversionRate', NULL,
      'propertiesNeedingAttention', '[]'::jsonb
    );
  END IF;

  v_listing := public.guest_listing_filter_value(p_listing_type);

  SELECT m."Id"
  INTO v_member_id
  FROM public."Members" m
  WHERE m."UserId" = coalesce(p_user_id, auth.uid())
    AND m."IsDeleted" = false
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object(
      'visits', jsonb_build_object('currentPeriod', 0),
      'holds', jsonb_build_object('currentPeriod', 0),
      'messages', jsonb_build_object('currentPeriod', 0),
      'totalProperties', jsonb_build_object('currentPeriod', 0),
      'conversionRate', NULL,
      'propertiesNeedingAttention', '[]'::jsonb
    );
  END IF;

  v_start := public.guest_visit_period_start(p_period);
  v_today := public.guest_visit_local_date(now());

  SELECT count(*)::bigint
  INTO v_total_properties
  FROM public.report_accessible_property_ids(v_member_id, p_company_id, p_property_id);

  SELECT count(*)::bigint
  INTO v_visits
  FROM public."PropertyVisitLogs" pvl
  JOIN public.report_accessible_property_ids(v_member_id, p_company_id, p_property_id) ap
    ON ap.id = pvl."PropertyId"
  WHERE pvl."VisitDate" >= v_start
    AND pvl."VisitDate" <= v_today
    AND pvl."IsDeleted" = false
    AND (v_listing IS NULL OR pvl."ListingType" = v_listing);

  SELECT count(*)::bigint
  INTO v_holds
  FROM public.booking_holds bh
  JOIN public.report_accessible_property_ids(v_member_id, p_company_id, p_property_id) ap
    ON ap.id = bh.property_id
  WHERE (bh.created_at AT TIME ZONE 'America/Montevideo')::date >= v_start
    AND (bh.created_at AT TIME ZONE 'America/Montevideo')::date <= v_today
    AND bh.listing_type IN ('SummerRent', 'EventVenue')
    AND (v_listing IS NULL OR bh.listing_type = v_listing::text);

  SELECT count(*)::bigint
  INTO v_submitted
  FROM public.booking_holds bh
  JOIN public.report_accessible_property_ids(v_member_id, p_company_id, p_property_id) ap
    ON ap.id = bh.property_id
  WHERE public.guest_hold_is_submitted_booking(bh.status, bh.otp_verified_at)
    AND (bh.updated_at AT TIME ZONE 'America/Montevideo')::date >= v_start
    AND (bh.updated_at AT TIME ZONE 'America/Montevideo')::date <= v_today
    AND bh.listing_type IN ('SummerRent', 'EventVenue')
    AND (v_listing IS NULL OR bh.listing_type = v_listing::text);

  RETURN jsonb_build_object(
    'visits', jsonb_build_object('currentPeriod', coalesce(v_visits, 0)),
    'holds', jsonb_build_object('currentPeriod', coalesce(v_holds, 0)),
    'messages', jsonb_build_object('currentPeriod', 0),
    'totalProperties', jsonb_build_object('currentPeriod', coalesce(v_total_properties, 0)),
    'conversionRate', CASE
      WHEN coalesce(v_visits, 0) = 0 THEN NULL
      ELSE round(100.0 * coalesce(v_submitted, 0) / v_visits, 1)
    END,
    'propertiesNeedingAttention', '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(text, uuid, uuid, uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Visits by property (conversion uses submitted; holds stays all starts)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_visits_by_property(
  p_period text,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 100,
  p_company_id uuid DEFAULT NULL::uuid,
  p_user_id uuid DEFAULT NULL::uuid,
  p_property_id uuid DEFAULT NULL::uuid,
  p_listing_type text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_start date;
  v_today date;
  v_listing public."ListingType";
  v_offset integer;
  v_total bigint := 0;
  v_data jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.guest_listing_filter_is_valid(p_listing_type) THEN
    RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'limit', p_limit);
  END IF;
  v_listing := public.guest_listing_filter_value(p_listing_type);

  SELECT m."Id"
  INTO v_member_id
  FROM public."Members" m
  WHERE m."UserId" = coalesce(p_user_id, auth.uid())
    AND m."IsDeleted" = false
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'limit', p_limit);
  END IF;

  v_start := public.guest_visit_period_start(p_period);
  v_today := public.guest_visit_local_date(now());
  v_offset := greatest(p_page - 1, 0) * greatest(p_limit, 1);

  SELECT count(*)
  INTO v_total
  FROM public.report_accessible_property_ids(v_member_id, p_company_id, p_property_id);

  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  INTO v_data
  FROM (
    SELECT
      ep."Id"::text AS "propertyId",
      coalesce(
        nullif(trim(l."Title"), ''),
        nullif(trim(concat_ws(' ', ep."StreetName", ep."HouseNumber")), ''),
        'Propiedad'
      ) AS "propertyTitle",
      nullif(trim(concat_ws(', ', ep."Neighborhood", ep."City")), '') AS address,
      CASE coalesce(l."Status", -1)
        WHEN 0 THEN 'En venta'
        WHEN 1 THEN 'En alquiler'
        WHEN 2 THEN 'Reservada'
        WHEN 3 THEN 'Vendida'
        WHEN 4 THEN 'No disponible'
        ELSE NULL
      END AS status,
      CASE
        WHEN l."RentPrice" IS NOT NULL THEN l."RentPrice"::text
        WHEN l."SalePrice" IS NOT NULL THEN l."SalePrice"::text
        ELSE NULL
      END AS price,
      coalesce(stats.visit_count, 0)::int AS "visitCount",
      coalesce(stats.hold_count, 0)::int AS holds,
      coalesce(stats.message_count, 0)::int AS messages,
      public.guest_conversion_label(stats.submitted_count, stats.visit_count) AS conversion,
      'flat'::text AS "visitsTrend",
      'flat'::text AS "messagesTrend",
      'flat'::text AS "conversionTrend",
      coalesce(stats.by_site, '[]'::jsonb) AS "bySite"
    FROM public.report_accessible_property_ids(v_member_id, p_company_id, p_property_id) ap
    JOIN public."EstateProperties" ep ON ep."Id" = ap.id
    LEFT JOIN LATERAL (
      SELECT lst."Title", lst."RentPrice", lst."SalePrice", lst."Status"
      FROM public."Listings" lst
      WHERE lst."EstatePropertyId" = ep."Id"
        AND lst."IsDeleted" = false
        AND (v_listing IS NULL OR lst."ListingType" = v_listing)
      ORDER BY lst."IsFeatured" DESC, lst."Created" DESC
      LIMIT 1
    ) l ON true
    LEFT JOIN LATERAL (
      SELECT
        (
          SELECT count(*)::bigint
          FROM public."PropertyVisitLogs" pvl
          WHERE pvl."PropertyId" = ep."Id"
            AND pvl."VisitedOnUtc" IS NOT NULL
            AND pvl."VisitDate" >= v_start
            AND pvl."VisitDate" <= v_today
            AND pvl."IsDeleted" = false
            AND (v_listing IS NULL OR pvl."ListingType" = v_listing)
        ) AS visit_count,
        (
          SELECT count(*)::bigint
          FROM public.booking_holds bh
          WHERE bh.property_id = ep."Id"
            AND (bh.created_at AT TIME ZONE 'America/Montevideo')::date >= v_start
            AND (bh.created_at AT TIME ZONE 'America/Montevideo')::date <= v_today
            AND bh.listing_type IN ('SummerRent', 'EventVenue')
            AND (v_listing IS NULL OR bh.listing_type = v_listing::text)
        ) AS hold_count,
        (
          SELECT count(*)::bigint
          FROM public.booking_holds bh
          WHERE bh.property_id = ep."Id"
            AND public.guest_hold_is_submitted_booking(bh.status, bh.otp_verified_at)
            AND (bh.updated_at AT TIME ZONE 'America/Montevideo')::date >= v_start
            AND (bh.updated_at AT TIME ZONE 'America/Montevideo')::date <= v_today
            AND bh.listing_type IN ('SummerRent', 'EventVenue')
            AND (v_listing IS NULL OR bh.listing_type = v_listing::text)
        ) AS submitted_count,
        (
          SELECT count(*)::bigint
          FROM public."PropertyMessageLogs" pml
          WHERE pml."PropertyId" = ep."Id"
            AND (pml."SentOnUtc" AT TIME ZONE 'America/Montevideo')::date >= v_start
            AND (pml."SentOnUtc" AT TIME ZONE 'America/Montevideo')::date <= v_today
            AND pml."IsDeleted" = false
        ) AS message_count,
        (
          SELECT coalesce(jsonb_agg(
            jsonb_build_object(
              'listingType', site.listing_type,
              'visitCount', site.visits,
              'holds', site.holds,
              'conversion', public.guest_conversion_label(site.submitted, site.visits)
            )
            ORDER BY site.listing_type
          ), '[]'::jsonb)
          FROM (
            SELECT
              lt.listing_type,
              (
                SELECT count(*)::bigint
                FROM public."PropertyVisitLogs" pvl
                WHERE pvl."PropertyId" = ep."Id"
                  AND pvl."ListingType" = lt.listing_type
                  AND pvl."VisitDate" >= v_start
                  AND pvl."VisitDate" <= v_today
                  AND pvl."IsDeleted" = false
              ) AS visits,
              (
                SELECT count(*)::bigint
                FROM public.booking_holds bh
                WHERE bh.property_id = ep."Id"
                  AND bh.listing_type = lt.listing_type::text
                  AND (bh.created_at AT TIME ZONE 'America/Montevideo')::date >= v_start
                  AND (bh.created_at AT TIME ZONE 'America/Montevideo')::date <= v_today
              ) AS holds,
              (
                SELECT count(*)::bigint
                FROM public.booking_holds bh
                WHERE bh.property_id = ep."Id"
                  AND bh.listing_type = lt.listing_type::text
                  AND public.guest_hold_is_submitted_booking(bh.status, bh.otp_verified_at)
                  AND (bh.updated_at AT TIME ZONE 'America/Montevideo')::date >= v_start
                  AND (bh.updated_at AT TIME ZONE 'America/Montevideo')::date <= v_today
              ) AS submitted
            FROM public.guest_tracked_listing_types() AS lt(listing_type)
            WHERE (v_listing IS NULL OR lt.listing_type = v_listing)
              AND (
                EXISTS (
              SELECT 1
              FROM public."Listings" lst
              WHERE lst."EstatePropertyId" = ep."Id"
                AND lst."ListingType" = lt.listing_type
                AND lst."IsDeleted" = false
            )
            OR (
              SELECT count(*)
              FROM public."PropertyVisitLogs" pvl
              WHERE pvl."PropertyId" = ep."Id"
                AND pvl."ListingType" = lt.listing_type
                AND pvl."IsDeleted" = false
            ) > 0
              )
          ) site
        ) AS by_site
    ) stats ON true
    ORDER BY coalesce(stats.visit_count, 0) DESC, ep."StreetName"
    LIMIT greatest(p_limit, 1)
    OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'limit', p_limit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visits_by_property(text, integer, integer, uuid, uuid, uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admin guest visit overview
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_admin_guest_visit_overview(
  p_period text DEFAULT 'last30days'::text,
  p_listing_type text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start date;
  v_today date;
  v_listing public."ListingType";
  v_property_views bigint := 0;
  v_page_views bigint := 0;
  v_holds bigint := 0;
  v_submitted bigint := 0;
  v_traffic jsonb;
  v_top_viewed jsonb;
  v_top_conversion jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF NOT public.guest_listing_filter_is_valid(p_listing_type) THEN
    RETURN jsonb_build_object(
      'period', p_period,
      'listingType', NULL,
      'propertyViews', 0,
      'pageViews', 0,
      'holds', 0,
      'conversionRate', NULL,
      'traffic', '{}'::jsonb,
      'topViewed', '[]'::jsonb,
      'topConversion', '[]'::jsonb
    );
  END IF;

  v_listing := public.guest_listing_filter_value(p_listing_type);
  v_start := public.guest_visit_period_start(p_period);
  v_today := public.guest_visit_local_date(now());

  SELECT count(*)::bigint
  INTO v_property_views
  FROM public."PropertyVisitLogs" pvl
  WHERE pvl."IsDeleted" = false
    AND pvl."VisitDate" >= v_start
    AND pvl."VisitDate" <= v_today
    AND (v_listing IS NULL OR pvl."ListingType" = v_listing);

  SELECT count(*)::bigint
  INTO v_page_views
  FROM public."PageVisitLogs" pvl
  WHERE pvl."IsDeleted" = false
    AND pvl."VisitDate" >= v_start
    AND pvl."VisitDate" <= v_today
    AND (v_listing IS NULL OR pvl."ListingType" = v_listing);

  SELECT count(*)::bigint
  INTO v_holds
  FROM public.booking_holds bh
  WHERE (bh.created_at AT TIME ZONE 'America/Montevideo')::date >= v_start
    AND (bh.created_at AT TIME ZONE 'America/Montevideo')::date <= v_today
    AND bh.listing_type IN ('SummerRent', 'EventVenue')
    AND (v_listing IS NULL OR bh.listing_type = v_listing::text);

  SELECT count(*)::bigint
  INTO v_submitted
  FROM public.booking_holds bh
  WHERE public.guest_hold_is_submitted_booking(bh.status, bh.otp_verified_at)
    AND (bh.updated_at AT TIME ZONE 'America/Montevideo')::date >= v_start
    AND (bh.updated_at AT TIME ZONE 'America/Montevideo')::date <= v_today
    AND bh.listing_type IN ('SummerRent', 'EventVenue')
    AND (v_listing IS NULL OR bh.listing_type = v_listing::text);

  SELECT coalesce(jsonb_object_agg(bucket.source, bucket.visits), '{}'::jsonb)
  INTO v_traffic
  FROM (
    SELECT src.source, coalesce(counts.visits, 0) AS visits
    FROM (
      SELECT unnest(ARRAY['direct', 'organic', 'social', 'referral', 'paid', 'email']) AS source
    ) src
    LEFT JOIN (
      SELECT pvl."TrafficSource" AS source, count(*)::bigint AS visits
      FROM public."PageVisitLogs" pvl
      WHERE pvl."IsDeleted" = false
        AND pvl."VisitDate" >= v_start
        AND pvl."VisitDate" <= v_today
        AND (v_listing IS NULL OR pvl."ListingType" = v_listing)
      GROUP BY 1
    ) counts ON counts.source = src.source
  ) bucket;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'rank', ranked.rank,
      'propertyId', ranked.property_id,
      'listingType', ranked.listing_type,
      'name', public.guest_property_listing_name(ranked.property_id, ranked.listing_type),
      'visits', ranked.visits
    )
    ORDER BY ranked.rank
  ), '[]'::jsonb)
  INTO v_top_viewed
  FROM (
    SELECT
      row_number() OVER (ORDER BY count(*) DESC, pvl."PropertyId") AS rank,
      pvl."PropertyId" AS property_id,
      pvl."ListingType" AS listing_type,
      count(*)::bigint AS visits
    FROM public."PropertyVisitLogs" pvl
    JOIN public."EstateProperties" ep
      ON ep."Id" = pvl."PropertyId"
     AND ep."IsDeleted" = false
    WHERE pvl."IsDeleted" = false
      AND pvl."VisitDate" >= v_start
      AND pvl."VisitDate" <= v_today
      AND (v_listing IS NULL OR pvl."ListingType" = v_listing)
    GROUP BY pvl."PropertyId", pvl."ListingType"
    ORDER BY count(*) DESC, pvl."PropertyId"
    LIMIT 3
  ) ranked;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'rank', ranked.rank,
      'propertyId', ranked.property_id,
      'listingType', ranked.listing_type,
      'name', public.guest_property_listing_name(ranked.property_id, ranked.listing_type),
      'visits', ranked.visits,
      'holds', ranked.holds,
      'rate', round(100.0 * ranked.holds / ranked.visits, 1)
    )
    ORDER BY ranked.rank
  ), '[]'::jsonb)
  INTO v_top_conversion
  FROM (
    SELECT
      row_number() OVER (
        ORDER BY (coalesce(h.holds, 0)::numeric / v.visits) DESC, v.visits DESC, v.property_id
      ) AS rank,
      v.property_id,
      v.listing_type,
      v.visits,
      coalesce(h.holds, 0) AS holds
    FROM (
      SELECT
        pvl."PropertyId" AS property_id,
        pvl."ListingType" AS listing_type,
        count(*)::bigint AS visits
      FROM public."PropertyVisitLogs" pvl
      JOIN public."EstateProperties" ep
        ON ep."Id" = pvl."PropertyId"
       AND ep."IsDeleted" = false
      WHERE pvl."IsDeleted" = false
        AND pvl."VisitDate" >= v_start
        AND pvl."VisitDate" <= v_today
        AND (v_listing IS NULL OR pvl."ListingType" = v_listing)
      GROUP BY pvl."PropertyId", pvl."ListingType"
      HAVING count(*) >= 20
    ) v
    LEFT JOIN (
      SELECT
        bh.property_id,
        bh.listing_type::public."ListingType" AS listing_type,
        count(*)::bigint AS holds
      FROM public.booking_holds bh
      WHERE public.guest_hold_is_submitted_booking(bh.status, bh.otp_verified_at)
        AND (bh.updated_at AT TIME ZONE 'America/Montevideo')::date >= v_start
        AND (bh.updated_at AT TIME ZONE 'America/Montevideo')::date <= v_today
        AND bh.listing_type IN ('SummerRent', 'EventVenue')
        AND (v_listing IS NULL OR bh.listing_type = v_listing::text)
      GROUP BY bh.property_id, bh.listing_type
    ) h
      ON h.property_id = v.property_id
     AND h.listing_type = v.listing_type
    ORDER BY (coalesce(h.holds, 0)::numeric / v.visits) DESC, v.visits DESC, v.property_id
    LIMIT 3
  ) ranked;

  RETURN jsonb_build_object(
    'period', coalesce(nullif(trim(p_period), ''), 'last30days'),
    'listingType', v_listing,
    'propertyViews', coalesce(v_property_views, 0),
    'pageViews', coalesce(v_page_views, 0),
    'holds', coalesce(v_holds, 0),
    'conversionRate', CASE
      WHEN coalesce(v_property_views, 0) = 0 THEN NULL
      ELSE round(100.0 * coalesce(v_submitted, 0) / v_property_views, 1)
    END,
    'traffic', v_traffic,
    'topViewed', v_top_viewed,
    'topConversion', v_top_conversion
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_guest_visit_overview(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_guest_visit_overview(text, text) TO authenticated, service_role;
