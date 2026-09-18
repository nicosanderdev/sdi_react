-- Expose PropertyImages on guest public search/detail RPCs.
-- Guests cannot SELECT PropertyImages (no anon RLS); SECURITY DEFINER helpers read URLs.

CREATE OR REPLACE FUNCTION public.build_property_images_json(p_estate_property_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'propertyImageId', pi."Id",
        'url', pi."Url",
        'altText', pi."AltText",
        'isMain', pi."IsMain",
        'displayOrder', pi."DisplayOrder"
      )
      ORDER BY pi."IsMain" DESC, pi."DisplayOrder" ASC, pi."Created" ASC
    ),
    '[]'::jsonb
  )
  FROM public."PropertyImages" pi
  WHERE pi."EstatePropertyId" = p_estate_property_id
    AND pi."IsDeleted" = false;
$$;

COMMENT ON FUNCTION public.build_property_images_json(uuid) IS
  'Full property gallery for public detail RPCs. Ordered IsMain desc, DisplayOrder, Created.';

CREATE OR REPLACE FUNCTION public.build_property_main_image_json(p_estate_property_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'url', pi."Url",
    'altText', pi."AltText"
  )
  FROM public."PropertyImages" pi
  WHERE pi."EstatePropertyId" = p_estate_property_id
    AND pi."IsDeleted" = false
  ORDER BY pi."IsMain" DESC, pi."DisplayOrder" ASC, pi."Created" ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.build_property_main_image_json(uuid) IS
  'Featured image {url, altText} for search/list cards; null when property has no photos.';

REVOKE ALL ON FUNCTION public.build_property_images_json(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.build_property_main_image_json(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_property_images_json(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.build_property_main_image_json(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- portal_search_properties: add imageUrl / imageAltText (return type unchanged)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.portal_search_properties(
  p_listing_type text,
  p_site_scope text DEFAULT NULL::text,
  p_sw_lat numeric DEFAULT NULL::numeric,
  p_ne_lat numeric DEFAULT NULL::numeric,
  p_sw_lng numeric DEFAULT NULL::numeric,
  p_ne_lng numeric DEFAULT NULL::numeric,
  p_city text DEFAULT NULL::text,
  p_search_text text DEFAULT NULL::text,
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_bedrooms_min integer DEFAULT NULL::integer,
  p_capacity_min integer DEFAULT NULL::integer,
  p_amenity_ids uuid[] DEFAULT NULL::uuid[],
  p_check_in date DEFAULT NULL::date,
  p_check_out date DEFAULT NULL::date,
  p_center_lat numeric DEFAULT NULL::numeric,
  p_center_lng numeric DEFAULT NULL::numeric,
  p_availability_mode text DEFAULT 'stay'::text,
  p_limit integer DEFAULT NULL::integer
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_listing_type text;
  v_site_scope text;
  v_params jsonb;
  v_pool_size int;
  v_check_in date;
  v_check_out date;
  v_check_in_ts timestamptz;
  v_check_out_ts timestamptz;
  v_availability_mode text;
  v_has_dates boolean;
  v_window_days int;
  v_result jsonb;
begin
  v_listing_type := public.validate_guest_site_listing_type(p_listing_type)::text;
  v_site_scope := coalesce(nullif(trim(p_site_scope), ''), v_listing_type);
  v_params := public.get_app_parameters(v_site_scope);
  v_pool_size := coalesce(
    p_limit,
    public.search_param_num(v_params, 'SEARCH_CANDIDATE_POOL_SIZE', 500)::int
  );

  v_availability_mode := coalesce(nullif(lower(trim(p_availability_mode)), ''), 'stay');
  if v_availability_mode not in ('stay', 'any_day_in_range') then
    raise exception 'Invalid p_availability_mode: %', p_availability_mode
      using errcode = '22023';
  end if;

  v_check_in := p_check_in;
  v_check_out := coalesce(p_check_out, p_check_in);

  if v_check_in is not null and v_check_out is null then
    v_check_out := v_check_in;
  end if;

  if v_availability_mode = 'stay' then
    v_has_dates := v_check_in is not null
      and v_check_out is not null
      and v_check_in < v_check_out;
  else
    v_has_dates := v_check_in is not null
      and v_check_out is not null
      and v_check_out >= v_check_in;
  end if;

  if v_has_dates then
    v_check_in_ts := v_check_in::timestamptz;
    v_check_out_ts := v_check_out::timestamptz;
    v_window_days := (v_check_out - v_check_in) + 1;
  end if;

  with featured_listing as (
    select distinct on (l."EstatePropertyId")
      l."Id" as listing_id,
      l."EstatePropertyId",
      l."ListingType"::text as listing_type,
      l."Title",
      l."Description",
      l."RentPrice",
      l."BasePrice",
      l."Currency",
      l."Capacity" as listing_capacity,
      l."BlockedForBooking"
    from public."Listings" l
    where l."IsDeleted" = false
      and l."IsActive" = true
      and l."IsPropertyVisible" = true
      and l."ListingType"::text = v_listing_type
    order by l."EstatePropertyId", l."IsFeatured" desc nulls last, l."Created" desc
  ),
  base as (
    select
      ep."Id" as estate_property_id,
      fl.listing_id,
      fl.listing_type,
      fl."Title" as title,
      fl."Description" as description,
      coalesce(fl."BasePrice", fl."RentPrice") as display_price,
      fl."Currency" as currency,
      ep."City" as city,
      ep."State" as state,
      ep."Country" as country,
      ep."Neighborhood" as neighborhood,
      ep."Bedrooms" as bedrooms,
      ep."Bathrooms" as bathrooms,
      ep."Capacity" as capacity,
      ep."OwnerId" as owner_id,
      ep."LocationLatitude" as lat,
      ep."LocationLongitude" as lng,
      ep."AreaValue" as area_value,
      ep."AreaUnit" as area_unit,
      fl."BlockedForBooking" as blocked_for_booking,
      coalesce(pss."Scores", '{}'::jsonb) as scores,
      coalesce((pss."Scores" ->> 'offline_base_score')::numeric, 0) as offline_base_score,
      public.build_property_main_image_json(ep."Id") as main_image
    from public."EstateProperties" ep
    join featured_listing fl on fl."EstatePropertyId" = ep."Id"
    left join public."PropertySearchScores" pss
      on pss."EstatePropertyId" = ep."Id"
     and pss."ListingType" = v_listing_type
    where ep."IsDeleted" = false
      and (p_sw_lat is null or ep."LocationLatitude" between least(p_sw_lat, p_ne_lat) and greatest(p_sw_lat, p_ne_lat))
      and (p_sw_lng is null or ep."LocationLongitude" between least(p_sw_lng, p_ne_lng) and greatest(p_sw_lng, p_ne_lng))
      and (p_city is null or ep."City" ilike '%' || trim(p_city) || '%')
      and (
        p_search_text is null
        or fl."Title" ilike '%' || trim(p_search_text) || '%'
        or ep."City" ilike '%' || trim(p_search_text) || '%'
        or coalesce(ep."Neighborhood", '') ilike '%' || trim(p_search_text) || '%'
      )
      and (p_bedrooms_min is null or ep."Bedrooms" >= p_bedrooms_min)
      and (p_capacity_min is null or greatest(coalesce(ep."Capacity", 0), coalesce(fl.listing_capacity, 0)) >= p_capacity_min)
      and (
        p_min_price is null
        or coalesce(fl."BasePrice", fl."RentPrice", 0) >= p_min_price
      )
      and (
        p_max_price is null
        or coalesce(fl."BasePrice", fl."RentPrice", 0) <= p_max_price
      )
      and (
        p_amenity_ids is null
        or cardinality(p_amenity_ids) = 0
        or not exists (
          select 1
          from unnest(p_amenity_ids) aid
          where not exists (
            select 1
            from public."EstatePropertyAmenity" epa
            where epa."EstatePropertyId" = ep."Id"
              and epa."AmenityId" = aid
          )
        )
      )
      and (
        not v_has_dates
        or v_availability_mode <> 'stay'
        or not exists (
          select 1
          from public."Bookings" b
          where b."EstatePropertyId" = ep."Id"
            and b."IsDeleted" = false
            and b."Status" <> 2
            and b."CheckInDate" < v_check_out_ts
            and b."CheckOutDate" > v_check_in_ts
            and (b."ListingType" is null or b."ListingType"::text = v_listing_type)
        )
      )
      and (
        not v_has_dates
        or v_availability_mode <> 'stay'
        or to_regclass('public.booking_holds') is null
        or not exists (
          select 1
          from public.booking_holds h
          where h.property_id = ep."Id"
            and h.status = 'pending'
            and h.expires_at > now()
            and h.check_in < v_check_out
            and h.check_out > v_check_in
            and (h.listing_type is null or h.listing_type = v_listing_type)
        )
      )
      and (
        not v_has_dates
        or v_availability_mode <> 'stay'
        or to_regclass('public."AvailabilityBlocks"') is null
        or not exists (
          select 1
          from public."AvailabilityBlocks" ab
          where ab."EstatePropertyId" = ep."Id"
            and ab."IsAvailable" = false
            and ab."StartDate" < v_check_out_ts
            and ab."EndDate" > v_check_in_ts
        )
      )
      and (
        not v_has_dates
        or v_availability_mode <> 'any_day_in_range'
        or exists (
          select 1
          from generate_series(v_check_in, v_check_out, interval '1 day') as gs(day_d)
          where not exists (
            select 1
            from public."Bookings" b
            where b."EstatePropertyId" = ep."Id"
              and b."IsDeleted" = false
              and b."Status" <> 2
              and b."CheckInDate" < (gs.day_d + interval '1 day')
              and b."CheckOutDate" > gs.day_d::timestamptz
              and (b."ListingType" is null or b."ListingType"::text = v_listing_type)
          )
          and (
            to_regclass('public.booking_holds') is null
            or not exists (
              select 1
              from public.booking_holds h
              where h.property_id = ep."Id"
                and h.status = 'pending'
                and h.expires_at > now()
                and h.check_in < (gs.day_d + interval '1 day')::date
                and h.check_out > gs.day_d::date
                and (h.listing_type is null or h.listing_type = v_listing_type)
            )
          )
          and (
            to_regclass('public."AvailabilityBlocks"') is null
            or not exists (
              select 1
              from public."AvailabilityBlocks" ab
              where ab."EstatePropertyId" = ep."Id"
                and ab."IsAvailable" = false
                and ab."StartDate" < (gs.day_d + interval '1 day')
                and ab."EndDate" > gs.day_d::timestamptz
            )
          )
        )
      )
  ),
  scored as (
    select
      b.*,
      case
        when not v_has_dates then 100
        when b.blocked_for_booking then 0
        when v_availability_mode = 'stay' then 100
        else coalesce((
          select round(
            (count(*) filter (where day_free)::numeric / greatest(v_window_days, 1)::numeric) * 100,
            2
          )
          from (
            select not exists (
              select 1
              from public."Bookings" bk
              where bk."EstatePropertyId" = b.estate_property_id
                and bk."IsDeleted" = false
                and bk."Status" <> 2
                and bk."CheckInDate" < (gs.day_d + interval '1 day')
                and bk."CheckOutDate" > gs.day_d::timestamptz
                and (bk."ListingType" is null or bk."ListingType"::text = v_listing_type)
            )
            and (
              to_regclass('public.booking_holds') is null
              or not exists (
                select 1
                from public.booking_holds hh
                where hh.property_id = b.estate_property_id
                  and hh.status = 'pending'
                  and hh.expires_at > now()
                  and hh.check_in < (gs.day_d + interval '1 day')::date
                  and hh.check_out > gs.day_d::date
                  and (hh.listing_type is null or hh.listing_type = v_listing_type)
              )
            )
            and (
              to_regclass('public."AvailabilityBlocks"') is null
              or not exists (
                select 1
                from public."AvailabilityBlocks" abl
                where abl."EstatePropertyId" = b.estate_property_id
                  and abl."IsAvailable" = false
                  and abl."StartDate" < (gs.day_d + interval '1 day')
                  and abl."EndDate" > gs.day_d::timestamptz
              )
            ) as day_free
            from generate_series(v_check_in, v_check_out, interval '1 day') as gs(day_d)
          ) day_scores
        ), 0)
      end as availability_score,
      case
        when p_center_lat is null or p_center_lng is null then 50
        else greatest(
          0,
          100 - least(
            100,
            (
              6371 * acos(
                least(1, greatest(-1,
                  cos(radians(p_center_lat)) * cos(radians(b.lat))
                  * cos(radians(b.lng) - radians(p_center_lng))
                  + sin(radians(p_center_lat)) * sin(radians(b.lat))
                ))
              ) / 50.0
            ) * 100
          )
        )
      end as distance_score
    from base b
  )
  select jsonb_build_object(
    'items',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'estatePropertyId', s.estate_property_id,
          'listingId', s.listing_id,
          'listingType', s.listing_type,
          'title', s.title,
          'description', s.description,
          'displayPrice', s.display_price,
          'currency', s.currency,
          'city', s.city,
          'state', s.state,
          'country', s.country,
          'neighborhood', s.neighborhood,
          'bedrooms', s.bedrooms,
          'bathrooms', s.bathrooms,
          'capacity', s.capacity,
          'ownerId', s.owner_id,
          'lat', s.lat,
          'lng', s.lng,
          'areaValue', s.area_value,
          'areaUnit', s.area_unit,
          'blockedForBooking', s.blocked_for_booking,
          'imageUrl', s.main_image ->> 'url',
          'imageAltText', s.main_image ->> 'altText',
          'scores', s.scores,
          'offlineBaseScore', s.offline_base_score,
          'onlineBoosts', jsonb_build_object(
            'availability_score', round(s.availability_score::numeric, 2),
            'distance_score', round(s.distance_score::numeric, 2)
          )
        )
        order by s.offline_base_score desc, s.estate_property_id
      ),
      '[]'::jsonb
    ),
    'total', (select count(*) from scored)
  )
  into v_result
  from (
    select * from scored
    order by offline_base_score desc, estate_property_id
    limit v_pool_size
  ) s;

  return coalesce(v_result, jsonb_build_object('items', '[]'::jsonb, 'total', 0));
end;
$$;

COMMENT ON FUNCTION public.portal_search_properties(
  text, text, numeric, numeric, numeric, numeric, text, text, numeric, numeric,
  integer, integer, uuid[], date, date, numeric, numeric, text, integer
) IS 'Portal property search with hard filters, precomputed scores, online boosts, and featured imageUrl. p_availability_mode: stay or any_day_in_range.';

REVOKE ALL ON FUNCTION public.portal_search_properties(
  text, text, numeric, numeric, numeric, numeric, text, text, numeric, numeric,
  integer, integer, uuid[], date, date, numeric, numeric, text, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_search_properties(
  text, text, numeric, numeric, numeric, numeric, text, text, numeric, numeric,
  integer, integer, uuid[], date, date, numeric, numeric, text, integer
) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- List RPCs: MainImageUrl / MainImageAltText (call SECURITY DEFINER helper)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_public_event_venue_properties(numeric, numeric, integer, text, boolean);

CREATE FUNCTION public.get_public_event_venue_properties(
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_min_guests integer DEFAULT NULL::integer,
  p_location text DEFAULT NULL::text,
  p_only_featured boolean DEFAULT false
) RETURNS TABLE(
  "EstatePropertyId" uuid,
  "OwnerId" uuid,
  "Neighborhood" character varying,
  "City" character varying,
  "State" character varying,
  "Country" character varying,
  "LocationLatitude" numeric,
  "LocationLongitude" numeric,
  "AreaValue" numeric,
  "AreaUnit" integer,
  "Bedrooms" integer,
  "Bathrooms" integer,
  "HasGarage" boolean,
  "GarageSpaces" integer,
  "HasLaundryRoom" boolean,
  "HasPool" boolean,
  "HasBalcony" boolean,
  "IsFurnished" boolean,
  "Capacity" integer,
  "LocationCategory" public."LocationCategory",
  "ViewType" public."ViewType",
  "ListingId" uuid,
  "ListingType" public."ListingType",
  "Title" text,
  "ListingDescription" character varying,
  "AvailableFrom" timestamp with time zone,
  "ListingCapacity" integer,
  "Currency" integer,
  "SalePrice" numeric,
  "RentPrice" numeric,
  "HasCommonExpenses" boolean,
  "CommonExpensesValue" numeric,
  "IsElectricityIncluded" boolean,
  "IsWaterIncluded" boolean,
  "IsPriceVisible" boolean,
  "Status" integer,
  "IsActive" boolean,
  "IsPropertyVisible" boolean,
  "IsFeatured" boolean,
  "BlockedForBooking" boolean,
  "MaxGuests" integer,
  "HasCatering" boolean,
  "HasSoundSystem" boolean,
  "ClosingHour" time without time zone,
  "AllowedEventsDescription" text,
  "AmenityNames" text[],
  "MainImageUrl" text,
  "MainImageAltText" text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ep."Id" AS "EstatePropertyId",
    ep."OwnerId",
    ep."Neighborhood",
    ep."City",
    ep."State",
    ep."Country",
    ep."LocationLatitude",
    ep."LocationLongitude",
    ep."AreaValue",
    ep."AreaUnit",
    ep."Bedrooms",
    ep."Bathrooms",
    ep."HasGarage",
    ep."GarageSpaces",
    ep."HasLaundryRoom",
    ep."HasPool",
    ep."HasBalcony",
    ep."IsFurnished",
    ep."Capacity",
    ep."LocationCategory",
    ep."ViewType",
    l."Id" AS "ListingId",
    l."ListingType",
    l."Title",
    l."Description" AS "ListingDescription",
    l."AvailableFrom",
    l."Capacity" AS "ListingCapacity",
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
    l."BlockedForBooking",
    ev."MaxGuests",
    ev."HasCatering",
    ev."HasSoundSystem",
    ev."ClosingHour",
    ev."AllowedEventsDescription",
    COALESCE(a_names."AmenityNames", ARRAY[]::text[]) AS "AmenityNames",
    (mi.main_image ->> 'url') AS "MainImageUrl",
    (mi.main_image ->> 'altText') AS "MainImageAltText"
  FROM public."EstateProperties" ep
  JOIN public."Listings" l
    ON l."EstatePropertyId" = ep."Id"
   AND l."IsDeleted" = false
   AND l."IsActive" = true
   AND l."IsPropertyVisible" = true
   AND l."ListingType" = 'EventVenue'::public."ListingType"
  LEFT JOIN public."EventVenueExtension" ev
    ON ev."EstatePropertyId" = ep."Id"
  LEFT JOIN LATERAL (
    SELECT public.build_property_main_image_json(ep."Id") AS main_image
  ) mi ON true
  LEFT JOIN (
    SELECT
      epa."EstatePropertyId",
      array_agg(a."Name" ORDER BY a."Name") AS "AmenityNames"
    FROM public."EstatePropertyAmenity" epa
    JOIN public."Amenities" a
      ON a."Id" = epa."AmenityId"
     AND a."IsDeleted" = false
     AND a."PropertyType" = 'EventVenue'::public."PropertyType"
    WHERE epa."DeletedAtUtc" IS NULL
    GROUP BY epa."EstatePropertyId"
  ) AS a_names
    ON a_names."EstatePropertyId" = ep."Id"
  WHERE ep."IsDeleted" = false
    AND (p_min_price IS NULL OR l."RentPrice" >= p_min_price)
    AND (p_max_price IS NULL OR l."RentPrice" <= p_max_price)
    AND (
      p_min_guests IS NULL
      OR COALESCE(ev."MaxGuests", l."Capacity", ep."Capacity", ep."Bedrooms" * 2) >= p_min_guests
    )
    AND (
      p_location IS NULL
      OR (
        ep."City" ILIKE '%' || p_location || '%'
        OR ep."State" ILIKE '%' || p_location || '%'
        OR ep."Neighborhood" ILIKE '%' || p_location || '%'
      )
    )
    AND (NOT p_only_featured OR l."IsFeatured" = true);
$$;

REVOKE ALL ON FUNCTION public.get_public_event_venue_properties(numeric, numeric, integer, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_venue_properties(numeric, numeric, integer, text, boolean)
  TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_public_summer_rent_properties(numeric, numeric, integer, integer, text, boolean);

CREATE FUNCTION public.get_public_summer_rent_properties(
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_min_bedrooms integer DEFAULT NULL::integer,
  p_min_guests integer DEFAULT NULL::integer,
  p_location text DEFAULT NULL::text,
  p_only_featured boolean DEFAULT false
) RETURNS TABLE(
  "EstatePropertyId" uuid,
  "OwnerId" uuid,
  "Neighborhood" character varying,
  "City" character varying,
  "State" character varying,
  "Country" character varying,
  "LocationLatitude" numeric,
  "LocationLongitude" numeric,
  "AreaValue" numeric,
  "AreaUnit" integer,
  "Bedrooms" integer,
  "Bathrooms" integer,
  "HasGarage" boolean,
  "GarageSpaces" integer,
  "HasLaundryRoom" boolean,
  "HasPool" boolean,
  "HasBalcony" boolean,
  "IsFurnished" boolean,
  "Capacity" integer,
  "LocationCategory" public."LocationCategory",
  "ViewType" public."ViewType",
  "MinStayDays" integer,
  "MaxStayDays" integer,
  "LeadTimeDays" integer,
  "BufferDays" integer,
  "ListingId" uuid,
  "ListingType" public."ListingType",
  "Title" text,
  "ListingDescription" character varying,
  "AvailableFrom" timestamp with time zone,
  "ListingCapacity" integer,
  "Currency" integer,
  "SalePrice" numeric,
  "RentPrice" numeric,
  "HasCommonExpenses" boolean,
  "CommonExpensesValue" numeric,
  "IsElectricityIncluded" boolean,
  "IsWaterIncluded" boolean,
  "IsPriceVisible" boolean,
  "Status" integer,
  "IsActive" boolean,
  "IsPropertyVisible" boolean,
  "IsFeatured" boolean,
  "BlockedForBooking" boolean,
  "AmenityNames" text[],
  "MainImageUrl" text,
  "MainImageAltText" text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ep."Id" AS "EstatePropertyId",
    ep."OwnerId",
    ep."Neighborhood",
    ep."City",
    ep."State",
    ep."Country",
    ep."LocationLatitude",
    ep."LocationLongitude",
    ep."AreaValue",
    ep."AreaUnit",
    ep."Bedrooms",
    ep."Bathrooms",
    ep."HasGarage",
    ep."GarageSpaces",
    ep."HasLaundryRoom",
    ep."HasPool",
    ep."HasBalcony",
    ep."IsFurnished",
    ep."Capacity",
    ep."LocationCategory",
    ep."ViewType",
    sx."MinStayDays",
    sx."MaxStayDays",
    sx."LeadTimeDays",
    sx."BufferDays",
    l."Id" AS "ListingId",
    l."ListingType",
    l."Title",
    l."Description" AS "ListingDescription",
    l."AvailableFrom",
    l."Capacity" AS "ListingCapacity",
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
    l."BlockedForBooking",
    COALESCE(a_names."AmenityNames", ARRAY[]::text[]) AS "AmenityNames",
    (mi.main_image ->> 'url') AS "MainImageUrl",
    (mi.main_image ->> 'altText') AS "MainImageAltText"
  FROM public."EstateProperties" ep
  JOIN public."Listings" l
    ON l."EstatePropertyId" = ep."Id"
   AND l."IsDeleted" = false
   AND l."IsActive" = true
   AND l."IsPropertyVisible" = true
   AND l."ListingType" = 'SummerRent'::public."ListingType"
  LEFT JOIN public."SummerRentExtension" sx
    ON sx."EstatePropertyId" = ep."Id"
  LEFT JOIN LATERAL (
    SELECT public.build_property_main_image_json(ep."Id") AS main_image
  ) mi ON true
  LEFT JOIN (
    SELECT
      epa."EstatePropertyId",
      array_agg(a."Name" ORDER BY a."Name") AS "AmenityNames"
    FROM public."EstatePropertyAmenity" epa
    JOIN public."Amenities" a
      ON a."Id" = epa."AmenityId"
     AND a."IsDeleted" = false
     AND a."PropertyType" = 'SummerRent'::public."PropertyType"
    WHERE epa."DeletedAtUtc" IS NULL
    GROUP BY epa."EstatePropertyId"
  ) AS a_names
    ON a_names."EstatePropertyId" = ep."Id"
  WHERE ep."IsDeleted" = false
    AND (p_min_price IS NULL OR l."RentPrice" >= p_min_price)
    AND (p_max_price IS NULL OR l."RentPrice" <= p_max_price)
    AND (p_min_bedrooms IS NULL OR ep."Bedrooms" >= p_min_bedrooms)
    AND (
      p_min_guests IS NULL
      OR COALESCE(l."Capacity", ep."Capacity", ep."Bedrooms" * 2) >= p_min_guests
    )
    AND (
      p_location IS NULL
      OR (
        ep."City" ILIKE '%' || p_location || '%'
        OR ep."State" ILIKE '%' || p_location || '%'
        OR ep."Neighborhood" ILIKE '%' || p_location || '%'
      )
    )
    AND (NOT p_only_featured OR l."IsFeatured" = true);
$$;

REVOKE ALL ON FUNCTION public.get_public_summer_rent_properties(numeric, numeric, integer, integer, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_summer_rent_properties(numeric, numeric, integer, integer, text, boolean)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Detail RPCs: Images jsonb gallery
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_public_event_venue_property_by_id(uuid);

CREATE FUNCTION public.get_public_event_venue_property_by_id(p_property_id uuid)
RETURNS TABLE(
  "EstatePropertyId" uuid,
  "OwnerId" uuid,
  "Neighborhood" character varying,
  "City" character varying,
  "State" character varying,
  "Country" character varying,
  "LocationLatitude" numeric,
  "LocationLongitude" numeric,
  "AreaValue" numeric,
  "AreaUnit" integer,
  "Bedrooms" integer,
  "Bathrooms" integer,
  "HasGarage" boolean,
  "GarageSpaces" integer,
  "HasLaundryRoom" boolean,
  "HasPool" boolean,
  "HasBalcony" boolean,
  "IsFurnished" boolean,
  "Capacity" integer,
  "LocationCategory" public."LocationCategory",
  "ViewType" public."ViewType",
  "ListingId" uuid,
  "ListingType" public."ListingType",
  "Title" text,
  "ListingDescription" character varying,
  "AvailableFrom" timestamp with time zone,
  "ListingCapacity" integer,
  "Currency" integer,
  "SalePrice" numeric,
  "RentPrice" numeric,
  "HasCommonExpenses" boolean,
  "CommonExpensesValue" numeric,
  "IsElectricityIncluded" boolean,
  "IsWaterIncluded" boolean,
  "IsPriceVisible" boolean,
  "Status" integer,
  "IsActive" boolean,
  "IsPropertyVisible" boolean,
  "IsFeatured" boolean,
  "BlockedForBooking" boolean,
  "MaxGuests" integer,
  "HasCatering" boolean,
  "HasSoundSystem" boolean,
  "ClosingHour" time without time zone,
  "AllowedEventsDescription" text,
  "AmenityNames" text[],
  "Amenities" jsonb,
  "Policies" jsonb,
  "ContentSections" jsonb,
  "Images" jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select
    ep."Id" as "EstatePropertyId",
    ep."OwnerId",
    ep."Neighborhood",
    ep."City",
    ep."State",
    ep."Country",
    ep."LocationLatitude",
    ep."LocationLongitude",
    ep."AreaValue",
    ep."AreaUnit",
    ep."Bedrooms",
    ep."Bathrooms",
    ep."HasGarage",
    ep."GarageSpaces",
    ep."HasLaundryRoom",
    ep."HasPool",
    ep."HasBalcony",
    ep."IsFurnished",
    ep."Capacity",
    ep."LocationCategory",
    ep."ViewType",
    l."Id" as "ListingId",
    l."ListingType",
    l."Title",
    l."Description" as "ListingDescription",
    l."AvailableFrom",
    l."Capacity" as "ListingCapacity",
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
    l."BlockedForBooking",
    ev."MaxGuests",
    ev."HasCatering",
    ev."HasSoundSystem",
    ev."ClosingHour",
    ev."AllowedEventsDescription",
    coalesce(a_names."AmenityNames", array[]::text[]) as "AmenityNames",
    public.build_property_amenities_json(ep."Id") as "Amenities",
    public.build_property_policies_json(ep."Id", 'EventVenue'::public."ListingType") as "Policies",
    public.build_property_content_sections_json(ep."Id", 'EventVenue'::public."PropertyType") as "ContentSections",
    public.build_property_images_json(ep."Id") as "Images"
  from public."EstateProperties" ep
  join public."Listings" l
    on l."EstatePropertyId" = ep."Id"
   and l."IsDeleted" = false
   and l."IsActive" = true
   and l."IsPropertyVisible" = true
   and l."ListingType" = 'EventVenue'::public."ListingType"
  left join public."EventVenueExtension" ev
    on ev."EstatePropertyId" = ep."Id"
  left join (
    select
      epa."EstatePropertyId",
      array_agg(a."Name" order by a."Name") as "AmenityNames"
    from public."EstatePropertyAmenity" epa
    join public."Amenities" a
      on a."Id" = epa."AmenityId"
     and a."IsDeleted" = false
     and a."PropertyType" = 'EventVenue'::public."PropertyType"
    where epa."DeletedAtUtc" is null
    group by epa."EstatePropertyId"
  ) as a_names
    on a_names."EstatePropertyId" = ep."Id"
  where ep."IsDeleted" = false
    and ep."Id" = p_property_id;
$$;

REVOKE ALL ON FUNCTION public.get_public_event_venue_property_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_venue_property_by_id(uuid)
  TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_public_summer_rent_property_by_id(uuid);

CREATE FUNCTION public.get_public_summer_rent_property_by_id(p_property_id uuid)
RETURNS TABLE(
  "EstatePropertyId" uuid,
  "OwnerId" uuid,
  "Neighborhood" character varying,
  "City" character varying,
  "State" character varying,
  "Country" character varying,
  "LocationLatitude" numeric,
  "LocationLongitude" numeric,
  "AreaValue" numeric,
  "AreaUnit" integer,
  "Bedrooms" integer,
  "Bathrooms" integer,
  "HasGarage" boolean,
  "GarageSpaces" integer,
  "HasLaundryRoom" boolean,
  "HasPool" boolean,
  "HasBalcony" boolean,
  "IsFurnished" boolean,
  "Capacity" integer,
  "LocationCategory" public."LocationCategory",
  "ViewType" public."ViewType",
  "MinStayDays" integer,
  "MaxStayDays" integer,
  "LeadTimeDays" integer,
  "BufferDays" integer,
  "ListingId" uuid,
  "ListingType" public."ListingType",
  "Title" text,
  "ListingDescription" character varying,
  "AvailableFrom" timestamp with time zone,
  "ListingCapacity" integer,
  "Currency" integer,
  "SalePrice" numeric,
  "RentPrice" numeric,
  "HasCommonExpenses" boolean,
  "CommonExpensesValue" numeric,
  "IsElectricityIncluded" boolean,
  "IsWaterIncluded" boolean,
  "IsPriceVisible" boolean,
  "Status" integer,
  "IsActive" boolean,
  "IsPropertyVisible" boolean,
  "IsFeatured" boolean,
  "BlockedForBooking" boolean,
  "AmenityNames" text[],
  "Amenities" jsonb,
  "Policies" jsonb,
  "ContentSections" jsonb,
  "Images" jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select
    ep."Id" as "EstatePropertyId",
    ep."OwnerId",
    ep."Neighborhood",
    ep."City",
    ep."State",
    ep."Country",
    ep."LocationLatitude",
    ep."LocationLongitude",
    ep."AreaValue",
    ep."AreaUnit",
    ep."Bedrooms",
    ep."Bathrooms",
    ep."HasGarage",
    ep."GarageSpaces",
    ep."HasLaundryRoom",
    ep."HasPool",
    ep."HasBalcony",
    ep."IsFurnished",
    ep."Capacity",
    ep."LocationCategory",
    ep."ViewType",
    sx."MinStayDays",
    sx."MaxStayDays",
    sx."LeadTimeDays",
    sx."BufferDays",
    l."Id" as "ListingId",
    l."ListingType",
    l."Title",
    l."Description" as "ListingDescription",
    l."AvailableFrom",
    l."Capacity" as "ListingCapacity",
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
    l."BlockedForBooking",
    coalesce(a_names."AmenityNames", array[]::text[]) as "AmenityNames",
    public.build_property_amenities_json(ep."Id") as "Amenities",
    public.build_property_policies_json(ep."Id", 'SummerRent'::public."ListingType") as "Policies",
    public.build_property_content_sections_json(ep."Id", 'SummerRent'::public."PropertyType") as "ContentSections",
    public.build_property_images_json(ep."Id") as "Images"
  from public."EstateProperties" ep
  join public."Listings" l
    on l."EstatePropertyId" = ep."Id"
   and l."IsDeleted" = false
   and l."IsActive" = true
   and l."IsPropertyVisible" = true
   and l."ListingType" = 'SummerRent'::public."ListingType"
  left join public."SummerRentExtension" sx
    on sx."EstatePropertyId" = ep."Id"
  left join (
    select
      epa."EstatePropertyId",
      array_agg(a."Name" order by a."Name") as "AmenityNames"
    from public."EstatePropertyAmenity" epa
    join public."Amenities" a
      on a."Id" = epa."AmenityId"
     and a."IsDeleted" = false
     and a."PropertyType" = 'SummerRent'::public."PropertyType"
    where epa."DeletedAtUtc" is null
    group by epa."EstatePropertyId"
  ) as a_names
    on a_names."EstatePropertyId" = ep."Id"
  where ep."IsDeleted" = false
    and ep."Id" = p_property_id;
$$;

REVOKE ALL ON FUNCTION public.get_public_summer_rent_property_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_summer_rent_property_by_id(uuid)
  TO anon, authenticated, service_role;
