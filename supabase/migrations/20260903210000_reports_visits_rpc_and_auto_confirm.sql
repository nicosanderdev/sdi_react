-- Reports: rewrite visit-by-property RPC onto Owners/CompanyMembers,
-- add optional property filter to dashboard report RPCs, and auto-confirm
-- paid bookings when the Mercado Pago seller is linked.

CREATE OR REPLACE FUNCTION public.report_accessible_property_ids(
  p_member_id uuid,
  p_company_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ep."Id"
  FROM public."EstateProperties" ep
  JOIN public."Owners" o
    ON o."Id" = ep."OwnerId"
   AND o."IsDeleted" = false
  WHERE ep."IsDeleted" = false
    AND p_member_id IS NOT NULL
    AND (
      (o."OwnerType" = 'member' AND o."MemberId" = p_member_id)
      OR (
        o."OwnerType" = 'company'
        AND EXISTS (
          SELECT 1
          FROM public."CompanyMembers" cm
          WHERE cm."CompanyId" = o."CompanyId"
            AND cm."MemberId" = p_member_id
            AND cm."IsDeleted" = false
            AND (p_company_id IS NULL OR cm."CompanyId" = p_company_id)
        )
      )
    )
    AND (
      p_company_id IS NULL
      OR (o."OwnerType" = 'company' AND o."CompanyId" = p_company_id)
    )
    AND (p_property_id IS NULL OR ep."Id" = p_property_id);
$$;

REVOKE ALL ON FUNCTION public.report_accessible_property_ids(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_accessible_property_ids(uuid, uuid, uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_dashboard_summary(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_dashboard_views_timeseries(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_views_by_source(text, uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_period text DEFAULT 'last30days'::text,
  p_company_id uuid DEFAULT NULL::uuid,
  p_user_id uuid DEFAULT NULL::uuid,
  p_property_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_start timestamptz;
  v_total_properties bigint := 0;
  v_visits bigint := 0;
BEGIN
  SELECT m."Id"
  INTO v_member_id
  FROM public."Members" m
  WHERE m."UserId" = coalesce(p_user_id, auth.uid())
    AND m."IsDeleted" = false
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object(
      'visits', jsonb_build_object('currentPeriod', 0),
      'messages', jsonb_build_object('currentPeriod', 0),
      'totalProperties', jsonb_build_object('currentPeriod', 0),
      'propertiesNeedingAttention', '[]'::jsonb
    );
  END IF;

  v_start := CASE
    WHEN p_period = 'last7days' THEN timezone('utc', now()) - interval '7 days'
    WHEN p_period = 'last90days' THEN timezone('utc', now()) - interval '90 days'
    WHEN p_period = 'thisyear' THEN date_trunc('year', timezone('utc', now()))
    ELSE timezone('utc', now()) - interval '30 days'
  END;

  SELECT count(*)::bigint
  INTO v_total_properties
  FROM public.report_accessible_property_ids(v_member_id, p_company_id, p_property_id);

  SELECT count(*)::bigint
  INTO v_visits
  FROM public."PropertyVisitLogs" pvl
  JOIN public.report_accessible_property_ids(v_member_id, p_company_id, p_property_id) ap
    ON ap.id = pvl."PropertyId"
  WHERE pvl."VisitedOnUtc" >= v_start
    AND pvl."IsDeleted" = false;

  RETURN jsonb_build_object(
    'visits', jsonb_build_object('currentPeriod', coalesce(v_visits, 0)),
    'messages', jsonb_build_object('currentPeriod', 0),
    'totalProperties', jsonb_build_object('currentPeriod', coalesce(v_total_properties, 0)),
    'propertiesNeedingAttention', '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(text, uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_dashboard_views_timeseries(
  p_period text DEFAULT 'last30days'::text,
  p_company_id uuid DEFAULT NULL::uuid,
  p_user_id uuid DEFAULT NULL::uuid,
  p_property_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(date date, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_start timestamptz;
BEGIN
  SELECT m."Id"
  INTO v_member_id
  FROM public."Members" m
  WHERE m."UserId" = coalesce(p_user_id, auth.uid())
    AND m."IsDeleted" = false
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN;
  END IF;

  v_start := CASE
    WHEN p_period = 'last7days' THEN timezone('utc', now()) - interval '7 days'
    WHEN p_period = 'last90days' THEN timezone('utc', now()) - interval '90 days'
    WHEN p_period = 'thisyear' THEN date_trunc('year', timezone('utc', now()))
    ELSE timezone('utc', now()) - interval '30 days'
  END;

  RETURN QUERY
  SELECT
    timezone('utc', pvl."VisitedOnUtc")::date AS date,
    count(*)::bigint AS count
  FROM public."PropertyVisitLogs" pvl
  JOIN public.report_accessible_property_ids(v_member_id, p_company_id, p_property_id) ap
    ON ap.id = pvl."PropertyId"
  WHERE pvl."VisitedOnUtc" >= v_start
    AND pvl."IsDeleted" = false
  GROUP BY 1
  ORDER BY 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_views_timeseries(text, uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_views_by_source(
  p_period text DEFAULT 'last30days'::text,
  p_company_id uuid DEFAULT NULL::uuid,
  p_user_id uuid DEFAULT NULL::uuid,
  p_property_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(source text, visits bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_start timestamptz;
BEGIN
  SELECT m."Id"
  INTO v_member_id
  FROM public."Members" m
  WHERE m."UserId" = coalesce(p_user_id, auth.uid())
    AND m."IsDeleted" = false
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN;
  END IF;

  v_start := CASE
    WHEN p_period = 'last7days' THEN timezone('utc', now()) - interval '7 days'
    WHEN p_period = 'last90days' THEN timezone('utc', now()) - interval '90 days'
    WHEN p_period = 'thisyear' THEN date_trunc('year', timezone('utc', now()))
    ELSE timezone('utc', now()) - interval '30 days'
  END;

  RETURN QUERY
  SELECT
    coalesce(nullif(lower(pvl."Source"), ''), 'website') AS source,
    count(*)::bigint AS visits
  FROM public."PropertyVisitLogs" pvl
  JOIN public.report_accessible_property_ids(v_member_id, p_company_id, p_property_id) ap
    ON ap.id = pvl."PropertyId"
  WHERE pvl."VisitedOnUtc" >= v_start
    AND pvl."IsDeleted" = false
  GROUP BY 1
  ORDER BY 2 DESC, 1 ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_views_by_source(text, uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_report_property_options(
  p_company_id uuid DEFAULT NULL::uuid,
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
BEGIN
  SELECT m."Id"
  INTO v_member_id
  FROM public."Members" m
  WHERE m."UserId" = coalesce(p_user_id, auth.uid())
    AND m."IsDeleted" = false
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ep."Id",
        'title', coalesce(
          nullif(trim(l."Title"), ''),
          nullif(trim(concat_ws(' ', ep."StreetName", ep."HouseNumber")), ''),
          'Propiedad'
        )
      )
      ORDER BY coalesce(nullif(trim(l."Title"), ''), ep."StreetName")
    )
    FROM public.report_accessible_property_ids(v_member_id, p_company_id, NULL) ap
    JOIN public."EstateProperties" ep ON ep."Id" = ap.id
    LEFT JOIN LATERAL (
      SELECT lst."Title"
      FROM public."Listings" lst
      WHERE lst."EstatePropertyId" = ep."Id"
        AND lst."IsDeleted" = false
      ORDER BY lst."IsFeatured" DESC, lst."Created" DESC
      LIMIT 1
    ) l ON true
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_report_property_options(uuid, uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_visits_by_property(text, integer, integer, text, text);

CREATE FUNCTION public.get_visits_by_property(
  p_period text,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 100,
  p_company_id uuid DEFAULT NULL::uuid,
  p_user_id uuid DEFAULT NULL::uuid,
  p_property_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_start timestamptz;
  v_offset integer;
  v_total bigint := 0;
  v_data jsonb := '[]'::jsonb;
BEGIN
  SELECT m."Id"
  INTO v_member_id
  FROM public."Members" m
  WHERE m."UserId" = coalesce(p_user_id, auth.uid())
    AND m."IsDeleted" = false
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'limit', p_limit);
  END IF;

  v_start := CASE
    WHEN p_period = 'last7days' THEN timezone('utc', now()) - interval '7 days'
    WHEN p_period = 'last90days' THEN timezone('utc', now()) - interval '90 days'
    WHEN p_period = 'thisyear' THEN date_trunc('year', timezone('utc', now()))
    ELSE timezone('utc', now()) - interval '30 days'
  END;

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
      coalesce(stats.message_count, 0)::int AS messages,
      CASE
        WHEN coalesce(stats.visit_count, 0) > 0
          THEN round(100.0 * coalesce(stats.message_count, 0) / stats.visit_count)::text || '%'
        ELSE '0%'
      END AS conversion,
      'flat'::text AS "visitsTrend",
      'flat'::text AS "messagesTrend",
      'flat'::text AS "conversionTrend"
    FROM public.report_accessible_property_ids(v_member_id, p_company_id, p_property_id) ap
    JOIN public."EstateProperties" ep ON ep."Id" = ap.id
    LEFT JOIN LATERAL (
      SELECT lst."Title", lst."RentPrice", lst."SalePrice", lst."Status"
      FROM public."Listings" lst
      WHERE lst."EstatePropertyId" = ep."Id"
        AND lst."IsDeleted" = false
      ORDER BY lst."IsFeatured" DESC, lst."Created" DESC
      LIMIT 1
    ) l ON true
    LEFT JOIN LATERAL (
      SELECT
        (
          SELECT count(*)::bigint
          FROM public."PropertyVisitLogs" pvl
          WHERE pvl."PropertyId" = ep."Id"
            AND pvl."VisitedOnUtc" >= v_start
            AND pvl."IsDeleted" = false
        ) AS visit_count,
        (
          SELECT count(*)::bigint
          FROM public."PropertyMessageLogs" pml
          WHERE pml."PropertyId" = ep."Id"
            AND pml."SentOnUtc" >= v_start
            AND pml."IsDeleted" = false
        ) AS message_count
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

GRANT EXECUTE ON FUNCTION public.get_visits_by_property(text, integer, integer, uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.try_auto_confirm_paid_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking record;
  v_seller jsonb;
  v_subject_type text;
  v_subject_id uuid;
  v_limit jsonb;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_booking_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing booking id');
  END IF;

  SELECT
    b."Id",
    b."Status",
    b."PaymentStatus",
    b."MercadoPagoApprovedAt",
    b."EstatePropertyId",
    b."IsDeleted"
  INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id
  FOR UPDATE;

  IF NOT FOUND OR v_booking."IsDeleted" THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking."Status" = 1 THEN
    RETURN jsonb_build_object(
      'success', true,
      'confirmed', false,
      'already_confirmed', true,
      'booking_id', p_booking_id
    );
  END IF;

  IF v_booking."Status" <> 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'confirmed', false,
      'skipped_reason', 'not_pending',
      'booking_id', p_booking_id
    );
  END IF;

  IF coalesce(v_booking."PaymentStatus", 0) <> 1 OR v_booking."MercadoPagoApprovedAt" IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'confirmed', false,
      'skipped_reason', 'not_paid',
      'booking_id', p_booking_id
    );
  END IF;

  v_seller := public.resolve_mercado_pago_seller_for_property(v_booking."EstatePropertyId");
  IF coalesce(v_seller->>'success', 'false') <> 'true' THEN
    RETURN jsonb_build_object(
      'success', true,
      'confirmed', false,
      'skipped_reason', 'seller_not_connected',
      'error_code', v_seller->>'error_code',
      'booking_id', p_booking_id
    );
  END IF;

  SELECT r.subject_type, r.member_or_company_id
  INTO v_subject_type, v_subject_id
  FROM public.resolve_property_billing_subject(v_booking."EstatePropertyId") r
  LIMIT 1;

  IF v_subject_id IS NOT NULL THEN
    v_limit := public.flexible_usage_limit_check(
      v_subject_type,
      v_subject_id,
      'booking',
      p_booking_id::text
    );
    IF coalesce((v_limit->>'allowed')::boolean, false) IS NOT TRUE THEN
      RETURN jsonb_build_object(
        'success', true,
        'confirmed', false,
        'skipped_reason', 'limit_exceeded',
        'limit', v_limit,
        'booking_id', p_booking_id
      );
    END IF;
  END IF;

  UPDATE public."Bookings"
  SET
    "Status" = 1,
    "LastModified" = v_now,
    "LastModifiedBy" = 'mercado-pago-auto-confirm'
  WHERE "Id" = p_booking_id
    AND "Status" = 0;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'confirmed', false,
      'already_confirmed', true,
      'booking_id', p_booking_id
    );
  END IF;

  BEGIN
    PERFORM public.record_booking_usage_record(p_booking_id, v_booking."EstatePropertyId");
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'confirmed', true,
    'booking_id', p_booking_id,
    'estate_property_id', v_booking."EstatePropertyId"
  );
END;
$$;

REVOKE ALL ON FUNCTION public.try_auto_confirm_paid_booking(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_auto_confirm_paid_booking(uuid) TO service_role;

COMMENT ON COLUMN public."Bookings"."MercadoPagoApprovedAt" IS
  'Set after a verified Mercado Pago webhook + GET /v1/payments approval. Also sets PaymentStatus = 1. Cleared on refund/chargeback. When the property seller is linked to Mercado Pago, try_auto_confirm_paid_booking may set Status = Confirmed.';
