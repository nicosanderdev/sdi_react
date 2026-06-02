-- Apply in sdi_react: supabase/migrations/20260609120000_portal_search_availability_mode.sql
-- Spec: tasks/alt-event-venue-search-backend-handoff.md

drop function if exists public.portal_search_properties(
  text, text, numeric, numeric, numeric, numeric, text, text,
  numeric, numeric, integer, integer, uuid[], date, date, numeric, numeric, integer
);

create or replace function public.portal_search_properties(
  p_listing_type text,
  p_site_scope text default null,
  p_sw_lat numeric default null,
  p_ne_lat numeric default null,
  p_sw_lng numeric default null,
  p_ne_lng numeric default null,
  p_city text default null,
  p_search_text text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_bedrooms_min integer default null,
  p_capacity_min integer default null,
  p_amenity_ids uuid[] default null,
  p_check_in date default null,
  p_check_out date default null,
  p_center_lat numeric default null,
  p_center_lng numeric default null,
  p_availability_mode text default 'stay',
  p_limit integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
      coalesce((pss."Scores" ->> 'offline_base_score')::numeric, 0) as offline_base_score
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

grant execute on function public.portal_search_properties(
  text, text, numeric, numeric, numeric, numeric, text, text,
  numeric, numeric, integer, integer, uuid[], date, date, numeric, numeric, text, integer
) to anon, authenticated, service_role;

comment on function public.portal_search_properties(
  text, text, numeric, numeric, numeric, numeric, text, text,
  numeric, numeric, integer, integer, uuid[], date, date, numeric, numeric, text, integer
) is 'Portal property search with hard filters, precomputed scores, and online boosts. p_availability_mode: stay (entire window free) or any_day_in_range (single-day event free on at least one day in inclusive window).';
