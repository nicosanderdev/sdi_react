-- Guest-site visits.
-- Drops unused analytics_events, clears PropertyVisitLogs, and stores
-- property views and page views per tracked listing type (SummerRent, EventVenue).
-- Guest sites write only through record_guest_visit. Conversion and traffic
-- are calculated from these rows and from booking_holds when dashboards read.
-- A day is a calendar date in America/Montevideo.

-- ---------------------------------------------------------------------------
-- Classification and period helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guest_listing_type_is_tracked(p_listing_type public."ListingType")
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_listing_type = ANY (
    ARRAY['SummerRent'::public."ListingType", 'EventVenue'::public."ListingType"]
  );
$$;

COMMENT ON FUNCTION public.guest_listing_type_is_tracked(public."ListingType") IS
  'Guest sites that record visits. Add a future site here and in the column checks that call this function.';

CREATE OR REPLACE FUNCTION public.guest_tracked_listing_types()
RETURNS SETOF public."ListingType"
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT unnest(ARRAY['SummerRent'::public."ListingType", 'EventVenue'::public."ListingType"]);
$$;

CREATE OR REPLACE FUNCTION public.guest_listing_filter_is_valid(p_listing_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(trim(coalesce(p_listing_type, '')), '') IS NULL
    OR lower(trim(p_listing_type)) IN ('all', 'todos')
    OR trim(p_listing_type) IN ('SummerRent', 'EventVenue');
$$;

CREATE OR REPLACE FUNCTION public.guest_listing_filter_value(p_listing_type text)
RETURNS public."ListingType"
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN nullif(trim(coalesce(p_listing_type, '')), '') IS NULL THEN NULL
    WHEN lower(trim(p_listing_type)) IN ('all', 'todos') THEN NULL
    WHEN trim(p_listing_type) IN ('SummerRent', 'EventVenue')
      THEN trim(p_listing_type)::public."ListingType"
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_guest_host(p_host text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(regexp_replace(lower(trim(coalesce(p_host, ''))), '^www\.', ''), '');
$$;

CREATE OR REPLACE FUNCTION public.guest_host_matches(p_host text, p_bases text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_host IS NOT NULL AND EXISTS (
    SELECT 1
    FROM unnest(p_bases) AS b(base)
    WHERE p_host = b.base OR p_host LIKE '%.' || b.base
  );
$$;

CREATE OR REPLACE FUNCTION public.guest_host_is_search(p_host text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_host IS NOT NULL AND (
    p_host ~ '^([a-z0-9-]+\.)*google\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$'
    OR public.guest_host_matches(
      p_host,
      ARRAY['bing.com', 'yahoo.com', 'duckduckgo.com', 'ecosia.org', 'yandex.com', 'yandex.ru', 'baidu.com']
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.guest_host_is_social(p_host text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.guest_host_matches(
    p_host,
    ARRAY[
      'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com', 't.co',
      'tiktok.com', 'linkedin.com', 'lnkd.in', 'pinterest.com', 'youtube.com',
      'youtu.be', 'whatsapp.com', 'wa.me', 'reddit.com', 'telegram.org', 't.me'
    ]
  );
$$;

CREATE OR REPLACE FUNCTION public.classify_guest_traffic(
  p_page_host text,
  p_referrer_host text,
  p_utm_source text,
  p_utm_medium text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_medium text := lower(trim(coalesce(p_utm_medium, '')));
BEGIN
  IF p_utm_source IS NOT NULL OR nullif(v_medium, '') IS NOT NULL THEN
    IF v_medium IN ('cpc', 'ppc', 'paid', 'display') THEN
      RETURN 'paid';
    ELSIF v_medium = 'email' THEN
      RETURN 'email';
    ELSIF v_medium = 'social' THEN
      RETURN 'social';
    ELSIF v_medium = 'organic' THEN
      RETURN 'organic';
    END IF;
    RETURN 'referral';
  END IF;

  IF p_referrer_host IS NULL OR p_referrer_host = p_page_host THEN
    RETURN 'direct';
  END IF;
  IF public.guest_host_is_search(p_referrer_host) THEN
    RETURN 'organic';
  END IF;
  IF public.guest_host_is_social(p_referrer_host) THEN
    RETURN 'social';
  END IF;
  RETURN 'referral';
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_visit_local_date(p_at timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (p_at AT TIME ZONE 'America/Montevideo')::date;
$$;

CREATE OR REPLACE FUNCTION public.guest_visit_period_start(p_period text)
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT CASE lower(coalesce(nullif(trim(p_period), ''), 'last30days'))
    WHEN 'last7days' THEN public.guest_visit_local_date(now()) - 6
    WHEN '7d' THEN public.guest_visit_local_date(now()) - 6
    WHEN 'last90days' THEN public.guest_visit_local_date(now()) - 89
    WHEN '90d' THEN public.guest_visit_local_date(now()) - 89
    WHEN 'thisyear' THEN date_trunc('year', (now() AT TIME ZONE 'America/Montevideo'))::date
    ELSE public.guest_visit_local_date(now()) - 29
  END;
$$;

CREATE OR REPLACE FUNCTION public.guest_property_is_public(
  p_property_id uuid,
  p_listing_type public."ListingType"
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."EstateProperties" ep
    JOIN public."Listings" l
      ON l."EstatePropertyId" = ep."Id"
     AND l."IsDeleted" = false
     AND l."IsActive" = true
     AND l."IsPropertyVisible" = true
     AND l."ListingType" = p_listing_type
    WHERE ep."Id" = p_property_id
      AND ep."IsDeleted" = false
  );
$$;

CREATE OR REPLACE FUNCTION public.guest_property_listing_name(
  p_property_id uuid,
  p_listing_type public."ListingType"
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (
      SELECT nullif(trim(l."Title"), '')
      FROM public."Listings" l
      WHERE l."EstatePropertyId" = p_property_id
        AND l."ListingType" = p_listing_type
        AND l."IsDeleted" = false
      ORDER BY l."IsActive" DESC, l."IsPropertyVisible" DESC, l."Created" DESC
      LIMIT 1
    ),
    (
      SELECT nullif(trim(concat_ws(' ', ep."StreetName", ep."HouseNumber")), '')
      FROM public."EstateProperties" ep
      WHERE ep."Id" = p_property_id
    ),
    'Propiedad'
  );
$$;

CREATE OR REPLACE FUNCTION public.guest_conversion_label(p_holds bigint, p_views bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_views, 0) <= 0 THEN '—'
    ELSE to_char(round(100.0 * coalesce(p_holds, 0) / p_views, 1), 'FM999999990.0') || '%'
  END;
$$;

-- ---------------------------------------------------------------------------
-- Drop unused analytics_events. Clear visit rows that have no site.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS public.analytics_events CASCADE;

DROP FUNCTION IF EXISTS public.get_views_by_source(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_views_by_source(text, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_property_views_by_source(uuid, text, uuid);

DELETE FROM public."PropertyVisitLogs";

ALTER TABLE public."PropertyVisitLogs"
  DROP COLUMN IF EXISTS "Source";

ALTER TABLE public."PropertyVisitLogs"
  ALTER COLUMN "Id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "IsDeleted" SET DEFAULT false,
  ALTER COLUMN "Created" SET DEFAULT now(),
  ALTER COLUMN "LastModified" SET DEFAULT now();

ALTER TABLE public."PropertyVisitLogs"
  ADD COLUMN "ListingType" public."ListingType" NOT NULL,
  ADD COLUMN "SessionId" uuid NOT NULL,
  ADD COLUMN "VisitDate" date NOT NULL,
  ADD COLUMN "TrafficSource" text NOT NULL,
  ADD COLUMN "PageHost" text NOT NULL,
  ADD COLUMN "ReferrerHost" text,
  ADD COLUMN "UtmSource" text,
  ADD COLUMN "UtmMedium" text,
  ADD COLUMN "UtmCampaign" text;

ALTER TABLE public."PropertyVisitLogs"
  ADD CONSTRAINT "PropertyVisitLogs_listing_type_tracked"
    CHECK (public.guest_listing_type_is_tracked("ListingType")),
  ADD CONSTRAINT "PropertyVisitLogs_traffic_source_check"
    CHECK ("TrafficSource" IN ('direct', 'organic', 'social', 'referral', 'paid', 'email')),
  ADD CONSTRAINT "PropertyVisitLogs_session_target_day_key"
    UNIQUE ("SessionId", "ListingType", "PropertyId", "VisitDate");

CREATE INDEX "IX_PropertyVisitLogs_VisitDate_ListingType"
  ON public."PropertyVisitLogs" ("VisitDate", "ListingType");

CREATE INDEX "IX_PropertyVisitLogs_Property_Listing_Date"
  ON public."PropertyVisitLogs" ("PropertyId", "ListingType", "VisitDate");

COMMENT ON TABLE public."PropertyVisitLogs" IS
  'One property-detail view per session, listing type, and America/Montevideo date. Listings of the same property and type add together.';

COMMENT ON COLUMN public."PropertyVisitLogs"."TrafficSource" IS
  'direct, organic, social, referral, paid, or email. Classified by record_guest_visit.';

CREATE TABLE public."PageVisitLogs" (
  "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "ListingType" public."ListingType" NOT NULL,
  "PageKey" text NOT NULL,
  "SessionId" uuid NOT NULL,
  "VisitedOnUtc" timestamptz NOT NULL DEFAULT now(),
  "VisitDate" date NOT NULL,
  "TrafficSource" text NOT NULL,
  "PageHost" text NOT NULL,
  "ReferrerHost" text,
  "UtmSource" text,
  "UtmMedium" text,
  "UtmCampaign" text,
  "IsDeleted" boolean NOT NULL DEFAULT false,
  "Created" timestamptz NOT NULL DEFAULT now(),
  "CreatedBy" text,
  "LastModified" timestamptz NOT NULL DEFAULT now(),
  "LastModifiedBy" text,
  CONSTRAINT "PageVisitLogs_pkey" PRIMARY KEY ("Id"),
  CONSTRAINT "PageVisitLogs_listing_type_tracked"
    CHECK (public.guest_listing_type_is_tracked("ListingType")),
  CONSTRAINT "PageVisitLogs_page_key_check"
    CHECK ("PageKey" IN ('home', 'search', 'about', 'how_it_works', 'contact', 'property_detail')),
  CONSTRAINT "PageVisitLogs_traffic_source_check"
    CHECK ("TrafficSource" IN ('direct', 'organic', 'social', 'referral', 'paid', 'email')),
  CONSTRAINT "PageVisitLogs_session_target_day_key"
    UNIQUE ("SessionId", "ListingType", "PageKey", "VisitDate")
);

CREATE INDEX "IX_PageVisitLogs_VisitDate_ListingType"
  ON public."PageVisitLogs" ("VisitDate", "ListingType", "PageKey");

COMMENT ON TABLE public."PageVisitLogs" IS
  'One site-page view per session, listing type, page key, and America/Montevideo date. property_detail is also stored here, separate from PropertyVisitLogs.';

ALTER TABLE public."PageVisitLogs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PageVisitLogs_admin_all"
  ON public."PageVisitLogs"
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "PropertyVisitLogs_anon_insert" ON public."PropertyVisitLogs";
DROP POLICY IF EXISTS "PropertyVisitLogs_user_insert" ON public."PropertyVisitLogs";
DROP POLICY IF EXISTS "Public app can insert property visit logs" ON public."PropertyVisitLogs";

REVOKE ALL ON TABLE public."PageVisitLogs" FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public."PageVisitLogs" TO authenticated, service_role;
GRANT ALL ON TABLE public."PageVisitLogs" TO service_role;

REVOKE INSERT, UPDATE, DELETE ON TABLE public."PropertyVisitLogs" FROM anon, authenticated;
REVOKE SELECT ON TABLE public."PropertyVisitLogs" FROM anon;

CREATE INDEX IF NOT EXISTS idx_booking_holds_property_listing_created
  ON public.booking_holds (property_id, listing_type, created_at);

-- ---------------------------------------------------------------------------
-- Write path
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_guest_visit(
  p_session_id text,
  p_listing_type text,
  p_page_key text,
  p_property_id text,
  p_page_host text,
  p_referrer_host text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session uuid;
  v_property uuid;
  v_listing public."ListingType";
  v_page text;
  v_page_host text;
  v_referrer text;
  v_utm_source text;
  v_utm_medium text;
  v_utm_campaign text;
  v_traffic text;
  v_now timestamptz := now();
  v_day date;
  v_row_id uuid;
  v_page_inserted boolean := false;
  v_property_inserted boolean := false;
BEGIN
  BEGIN
    v_session := nullif(trim(coalesce(p_session_id, '')), '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_session');
  END;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_session');
  END IF;

  v_listing := public.guest_listing_filter_value(p_listing_type);
  IF v_listing IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_listing_type');
  END IF;

  v_page := lower(trim(coalesce(p_page_key, '')));
  IF v_page NOT IN ('home', 'search', 'about', 'how_it_works', 'contact', 'property_detail') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_page_key');
  END IF;

  IF position('/' IN coalesce(p_page_host, '')) > 0
     OR position(':' IN coalesce(p_page_host, '')) > 0
     OR position(' ' IN coalesce(p_page_host, '')) > 0
     OR position('?' IN coalesce(p_page_host, '')) > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_page_host');
  END IF;

  v_page_host := public.normalize_guest_host(p_page_host);
  IF v_page_host IS NULL
     OR length(v_page_host) > 253
     OR v_page_host !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_page_host');
  END IF;

  v_referrer := public.normalize_guest_host(p_referrer_host);
  IF v_referrer IS NOT NULL AND (
    length(v_referrer) > 253
    OR v_referrer !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$'
  ) THEN
    v_referrer := NULL;
  END IF;

  v_utm_source := nullif(left(trim(coalesce(p_utm_source, '')), 200), '');
  v_utm_medium := nullif(left(trim(coalesce(p_utm_medium, '')), 200), '');
  v_utm_campaign := nullif(left(trim(coalesce(p_utm_campaign, '')), 200), '');
  v_traffic := public.classify_guest_traffic(v_page_host, v_referrer, v_utm_source, v_utm_medium);
  v_day := public.guest_visit_local_date(v_now);

  IF v_page = 'property_detail' THEN
    BEGIN
      v_property := nullif(trim(coalesce(p_property_id, '')), '')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('success', false, 'error', 'property_required');
    END;
    IF v_property IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'property_required');
    END IF;
    IF NOT public.guest_property_is_public(v_property, v_listing) THEN
      RETURN jsonb_build_object('success', false, 'error', 'property_not_public');
    END IF;
  ELSIF nullif(trim(coalesce(p_property_id, '')), '') IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'property_not_allowed');
  END IF;

  v_row_id := NULL;
  INSERT INTO public."PageVisitLogs" (
    "ListingType", "PageKey", "SessionId", "VisitedOnUtc", "VisitDate",
    "TrafficSource", "PageHost", "ReferrerHost", "UtmSource", "UtmMedium", "UtmCampaign",
    "CreatedBy"
  ) VALUES (
    v_listing, v_page, v_session, v_now, v_day,
    v_traffic, v_page_host, v_referrer, v_utm_source, v_utm_medium, v_utm_campaign,
    'record_guest_visit'
  )
  ON CONFLICT ("SessionId", "ListingType", "PageKey", "VisitDate") DO NOTHING
  RETURNING "Id" INTO v_row_id;
  v_page_inserted := v_row_id IS NOT NULL;

  IF v_page = 'property_detail' THEN
    v_row_id := NULL;
    INSERT INTO public."PropertyVisitLogs" (
      "PropertyId", "VisitedOnUtc", "ListingType", "SessionId", "VisitDate",
      "TrafficSource", "PageHost", "ReferrerHost", "UtmSource", "UtmMedium", "UtmCampaign",
      "CreatedBy"
    ) VALUES (
      v_property, v_now, v_listing, v_session, v_day,
      v_traffic, v_page_host, v_referrer, v_utm_source, v_utm_medium, v_utm_campaign,
      'record_guest_visit'
    )
    ON CONFLICT ("SessionId", "ListingType", "PropertyId", "VisitDate") DO NOTHING
    RETURNING "Id" INTO v_row_id;
    v_property_inserted := v_row_id IS NOT NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'counted_page', v_page_inserted,
    'counted_property', v_property_inserted
  );
END;
$$;

COMMENT ON FUNCTION public.record_guest_visit(text, text, text, text, text, text, text, text, text) IS
  'Records a guest page view and, for property_detail, a property view. Dedupes per session, target, and Montevideo date.';

REVOKE ALL ON FUNCTION public.record_guest_visit(text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_guest_visit(text, text, text, text, text, text, text, text, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Owner and property reads. Optional p_listing_type null means every tracked site.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_dashboard_summary(text, uuid, uuid, uuid);

CREATE FUNCTION public.get_dashboard_summary(
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

  RETURN jsonb_build_object(
    'visits', jsonb_build_object('currentPeriod', coalesce(v_visits, 0)),
    'holds', jsonb_build_object('currentPeriod', coalesce(v_holds, 0)),
    'messages', jsonb_build_object('currentPeriod', 0),
    'totalProperties', jsonb_build_object('currentPeriod', coalesce(v_total_properties, 0)),
    'conversionRate', CASE
      WHEN coalesce(v_visits, 0) = 0 THEN NULL
      ELSE round(100.0 * coalesce(v_holds, 0) / v_visits, 1)
    END,
    'propertiesNeedingAttention', '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(text, uuid, uuid, uuid, text) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_dashboard_views_timeseries(text, uuid, uuid, uuid);

CREATE FUNCTION public.get_dashboard_views_timeseries(
  p_period text DEFAULT 'last30days'::text,
  p_company_id uuid DEFAULT NULL::uuid,
  p_user_id uuid DEFAULT NULL::uuid,
  p_property_id uuid DEFAULT NULL::uuid,
  p_listing_type text DEFAULT NULL::text
)
RETURNS TABLE(date date, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_start date;
  v_today date;
  v_listing public."ListingType";
BEGIN
  IF NOT public.guest_listing_filter_is_valid(p_listing_type) THEN
    RETURN;
  END IF;
  v_listing := public.guest_listing_filter_value(p_listing_type);

  SELECT m."Id"
  INTO v_member_id
  FROM public."Members" m
  WHERE m."UserId" = coalesce(p_user_id, auth.uid())
    AND m."IsDeleted" = false
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN;
  END IF;

  v_start := public.guest_visit_period_start(p_period);
  v_today := public.guest_visit_local_date(now());

  RETURN QUERY
  SELECT
    pvl."VisitDate" AS date,
    count(*)::bigint AS count
  FROM public."PropertyVisitLogs" pvl
  JOIN public.report_accessible_property_ids(v_member_id, p_company_id, p_property_id) ap
    ON ap.id = pvl."PropertyId"
  WHERE pvl."VisitDate" >= v_start
    AND pvl."VisitDate" <= v_today
    AND pvl."IsDeleted" = false
    AND (v_listing IS NULL OR pvl."ListingType" = v_listing)
  GROUP BY 1
  ORDER BY 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_views_timeseries(text, uuid, uuid, uuid, text) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_views_by_source(text, uuid, uuid, uuid);

CREATE FUNCTION public.get_views_by_source(
  p_period text DEFAULT 'last30days'::text,
  p_company_id uuid DEFAULT NULL::uuid,
  p_user_id uuid DEFAULT NULL::uuid,
  p_property_id uuid DEFAULT NULL::uuid,
  p_listing_type text DEFAULT NULL::text
)
RETURNS TABLE(source text, visits bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_start date;
  v_today date;
  v_listing public."ListingType";
BEGIN
  IF NOT public.guest_listing_filter_is_valid(p_listing_type) THEN
    RETURN;
  END IF;
  v_listing := public.guest_listing_filter_value(p_listing_type);

  SELECT m."Id"
  INTO v_member_id
  FROM public."Members" m
  WHERE m."UserId" = coalesce(p_user_id, auth.uid())
    AND m."IsDeleted" = false
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN;
  END IF;

  v_start := public.guest_visit_period_start(p_period);
  v_today := public.guest_visit_local_date(now());

  RETURN QUERY
  SELECT
    pvl."TrafficSource" AS source,
    count(*)::bigint AS visits
  FROM public."PropertyVisitLogs" pvl
  JOIN public.report_accessible_property_ids(v_member_id, p_company_id, p_property_id) ap
    ON ap.id = pvl."PropertyId"
  WHERE pvl."VisitDate" >= v_start
    AND pvl."VisitDate" <= v_today
    AND pvl."IsDeleted" = false
    AND (v_listing IS NULL OR pvl."ListingType" = v_listing)
  GROUP BY 1
  ORDER BY 2 DESC, 1 ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_views_by_source(text, uuid, uuid, uuid, text) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_property_views(uuid, text, uuid);

CREATE FUNCTION public.get_property_views(
  p_property_id uuid,
  p_period text DEFAULT 'last30days'::text,
  p_user_id uuid DEFAULT NULL::uuid,
  p_listing_type text DEFAULT NULL::text
)
RETURNS TABLE(date date, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start date;
  v_today date;
  v_listing public."ListingType";
BEGIN
  IF NOT public.guest_listing_filter_is_valid(p_listing_type) THEN
    RETURN;
  END IF;
  v_listing := public.guest_listing_filter_value(p_listing_type);
  v_start := public.guest_visit_period_start(p_period);
  v_today := public.guest_visit_local_date(now());

  RETURN QUERY
  SELECT
    pvl."VisitDate" AS date,
    count(*)::bigint AS count
  FROM public."PropertyVisitLogs" pvl
  JOIN public."EstateProperties" ep
    ON ep."Id" = pvl."PropertyId"
   AND ep."IsDeleted" = false
  JOIN public."Owners" o
    ON o."Id" = ep."OwnerId"
   AND o."IsDeleted" = false
  WHERE pvl."PropertyId" = p_property_id
    AND pvl."VisitDate" >= v_start
    AND pvl."VisitDate" <= v_today
    AND pvl."IsDeleted" = false
    AND (v_listing IS NULL OR pvl."ListingType" = v_listing)
    AND (
      p_user_id IS NULL
      OR (
        (o."OwnerType" = 'member' AND o."MemberId" = p_user_id)
        OR (
          o."OwnerType" = 'company'
          AND EXISTS (
            SELECT 1
            FROM public."CompanyMembers" cm
            WHERE cm."CompanyId" = o."CompanyId"
              AND cm."MemberId" = p_user_id
              AND cm."IsDeleted" = false
          )
        )
      )
    )
  GROUP BY 1
  ORDER BY 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_property_views(uuid, text, uuid, text) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_property_views_by_source(uuid, text, uuid);

CREATE FUNCTION public.get_property_views_by_source(
  p_property_id uuid,
  p_period text DEFAULT 'last30days'::text,
  p_user_id uuid DEFAULT NULL::uuid,
  p_listing_type text DEFAULT NULL::text
)
RETURNS TABLE(source text, visits bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start date;
  v_today date;
  v_listing public."ListingType";
BEGIN
  IF NOT public.guest_listing_filter_is_valid(p_listing_type) THEN
    RETURN;
  END IF;
  v_listing := public.guest_listing_filter_value(p_listing_type);
  v_start := public.guest_visit_period_start(p_period);
  v_today := public.guest_visit_local_date(now());

  RETURN QUERY
  SELECT
    pvl."TrafficSource" AS source,
    count(*)::bigint AS visits
  FROM public."PropertyVisitLogs" pvl
  JOIN public."EstateProperties" ep
    ON ep."Id" = pvl."PropertyId"
   AND ep."IsDeleted" = false
  JOIN public."Owners" o
    ON o."Id" = ep."OwnerId"
   AND o."IsDeleted" = false
  WHERE pvl."PropertyId" = p_property_id
    AND pvl."VisitDate" >= v_start
    AND pvl."VisitDate" <= v_today
    AND pvl."IsDeleted" = false
    AND (v_listing IS NULL OR pvl."ListingType" = v_listing)
    AND (
      p_user_id IS NULL
      OR (
        (o."OwnerType" = 'member' AND o."MemberId" = p_user_id)
        OR (
          o."OwnerType" = 'company'
          AND EXISTS (
            SELECT 1
            FROM public."CompanyMembers" cm
            WHERE cm."CompanyId" = o."CompanyId"
              AND cm."MemberId" = p_user_id
              AND cm."IsDeleted" = false
          )
        )
      )
    )
  GROUP BY 1
  ORDER BY 2 DESC, 1 ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_property_views_by_source(uuid, text, uuid, text) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_visits_by_property(text, integer, integer, uuid, uuid, uuid);

CREATE FUNCTION public.get_visits_by_property(
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
      public.guest_conversion_label(stats.hold_count, stats.visit_count) AS conversion,
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
              'conversion', public.guest_conversion_label(site.holds, site.visits)
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
              ) AS holds
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
-- Admin reads
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_admin_property_views_summary(
  p_period_7d text DEFAULT NULL::text,
  p_period_30d text DEFAULT NULL::text
)
RETURNS TABLE("totalPropertyViews" bigint, "viewsLast7Days" bigint, "viewsLast30Days" bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := public.guest_visit_local_date(now());
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  RETURN QUERY
  SELECT
    (
      SELECT count(*)::bigint
      FROM public."PropertyVisitLogs" pvl
      JOIN public."EstateProperties" ep
        ON ep."Id" = pvl."PropertyId"
       AND ep."IsDeleted" = false
      WHERE pvl."IsDeleted" = false
    ) AS "totalPropertyViews",
    (
      SELECT count(*)::bigint
      FROM public."PropertyVisitLogs" pvl
      JOIN public."EstateProperties" ep
        ON ep."Id" = pvl."PropertyId"
       AND ep."IsDeleted" = false
      WHERE pvl."IsDeleted" = false
        AND pvl."VisitDate" >= public.guest_visit_period_start('last7days')
        AND pvl."VisitDate" <= v_today
    ) AS "viewsLast7Days",
    (
      SELECT count(*)::bigint
      FROM public."PropertyVisitLogs" pvl
      JOIN public."EstateProperties" ep
        ON ep."Id" = pvl."PropertyId"
       AND ep."IsDeleted" = false
      WHERE pvl."IsDeleted" = false
        AND pvl."VisitDate" >= public.guest_visit_period_start('last30days')
        AND pvl."VisitDate" <= v_today
    ) AS "viewsLast30Days";
END;
$$;

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
      WHERE (bh.created_at AT TIME ZONE 'America/Montevideo')::date >= v_start
        AND (bh.created_at AT TIME ZONE 'America/Montevideo')::date <= v_today
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
      ELSE round(100.0 * coalesce(v_holds, 0) / v_property_views, 1)
    END,
    'traffic', v_traffic,
    'topViewed', v_top_viewed,
    'topConversion', v_top_conversion
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_guest_visit_overview(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_guest_visit_overview(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_admin_guest_visit_timeseries(
  p_period text DEFAULT 'last30days'::text,
  p_listing_type text DEFAULT NULL::text
)
RETURNS TABLE(date date, property_views bigint, page_views bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start date;
  v_today date;
  v_listing public."ListingType";
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF NOT public.guest_listing_filter_is_valid(p_listing_type) THEN
    RETURN;
  END IF;

  v_listing := public.guest_listing_filter_value(p_listing_type);
  v_start := public.guest_visit_period_start(p_period);
  v_today := public.guest_visit_local_date(now());

  RETURN QUERY
  SELECT
    d.day::date AS date,
    coalesce(pv.visits, 0)::bigint AS property_views,
    coalesce(pg.visits, 0)::bigint AS page_views
  FROM generate_series(v_start, v_today, interval '1 day') AS d(day)
  LEFT JOIN (
    SELECT pvl."VisitDate" AS day, count(*)::bigint AS visits
    FROM public."PropertyVisitLogs" pvl
    WHERE pvl."IsDeleted" = false
      AND (v_listing IS NULL OR pvl."ListingType" = v_listing)
    GROUP BY 1
  ) pv ON pv.day = d.day::date
  LEFT JOIN (
    SELECT pvl."VisitDate" AS day, count(*)::bigint AS visits
    FROM public."PageVisitLogs" pvl
    WHERE pvl."IsDeleted" = false
      AND (v_listing IS NULL OR pvl."ListingType" = v_listing)
    GROUP BY 1
  ) pg ON pg.day = d.day::date
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_guest_visit_timeseries(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_guest_visit_timeseries(text, text) TO authenticated, service_role;
