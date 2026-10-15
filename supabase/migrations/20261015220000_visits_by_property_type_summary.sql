-- Replace listing status with propertyTypesSummary (same labels as member property list).
-- Drop messages from the payload; conversion and holds stay unchanged.

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
      nullif(
        trim(both from concat_ws(', ',
          case when exists (
            select 1
            from public."Listings" lx
            where lx."EstatePropertyId" = ep."Id"
              and lx."IsDeleted" = false
              and lx."ListingType" = 'RealEstate'::public."ListingType"
          ) then 'En venta' end,
          case when exists (
            select 1
            from public."Listings" lx
            where lx."EstatePropertyId" = ep."Id"
              and lx."IsDeleted" = false
              and lx."ListingType" = 'AnnualRent'::public."ListingType"
          ) then 'En alquiler' end,
          case when
            exists (select 1 from public."SummerRentExtension" sx where sx."EstatePropertyId" = ep."Id")
            or exists (
              select 1
              from public."Listings" lx
              where lx."EstatePropertyId" = ep."Id"
                and lx."IsDeleted" = false
                and lx."ListingType" = 'SummerRent'::public."ListingType"
            )
          then 'Alquiler de temporada' end,
          case when
            exists (select 1 from public."EventVenueExtension" ex where ex."EstatePropertyId" = ep."Id")
            or exists (
              select 1
              from public."Listings" lx
              where lx."EstatePropertyId" = ep."Id"
                and lx."IsDeleted" = false
                and lx."ListingType" = 'EventVenue'::public."ListingType"
            )
          then 'Eventos' end
        )),
        ''
      ) AS "propertyTypesSummary",
      CASE
        WHEN l."RentPrice" IS NOT NULL THEN l."RentPrice"::text
        WHEN l."SalePrice" IS NOT NULL THEN l."SalePrice"::text
        ELSE NULL
      END AS price,
      coalesce(stats.visit_count, 0)::int AS "visitCount",
      coalesce(stats.hold_count, 0)::int AS holds,
      public.guest_conversion_label(stats.submitted_count, stats.visit_count) AS conversion,
      'flat'::text AS "visitsTrend",
      'flat'::text AS "conversionTrend",
      coalesce(stats.by_site, '[]'::jsonb) AS "bySite"
    FROM public.report_accessible_property_ids(v_member_id, p_company_id, p_property_id) ap
    JOIN public."EstateProperties" ep ON ep."Id" = ap.id
    LEFT JOIN LATERAL (
      SELECT lst."Title", lst."RentPrice", lst."SalePrice"
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

COMMENT ON FUNCTION public.get_visits_by_property(text, integer, integer, uuid, uuid, uuid, text) IS
  'Per-property visit/hold/conversion stats. propertyTypesSummary matches member list type badges.';
