-- Dynamic pricing: server-side computation and validate_booking_selection.
-- Apply after 20260602120000_dynamic_pricing_schema.sql

begin;

-- -----------------------------------------------------------------------------
-- Helpers: parse numeric from jsonb parameter map
-- -----------------------------------------------------------------------------
create or replace function public.pricing_param_number(p_params jsonb, p_key text, p_default numeric)
returns numeric
language sql
immutable
as $$
  select coalesce((p_params ->> p_key)::numeric, p_default);
$$;

-- MM-DD in calendar (handles year wrap e.g. 12-15 to 01-15)
create or replace function public.pricing_date_in_mmdd_range(p_date date, p_from text, p_to text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_d text := to_char(p_date, 'MM-DD');
  v_from text := p_from;
  v_to text := p_to;
begin
  if v_from <= v_to then
    return v_d >= v_from and v_d <= v_to;
  end if;
  return v_d >= v_from or v_d <= v_to;
end;
$$;

create or replace function public.pricing_resolve_season_factor(p_params jsonb, p_date date)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_tier text := 'mid';
  v_entry jsonb;
  v_from text;
  v_to text;
begin
  for v_entry in
    select * from jsonb_array_elements(coalesce(p_params -> 'SEASON_CALENDAR', '[]'::jsonb))
  loop
    v_from := v_entry ->> 'from';
    v_to := v_entry ->> 'to';
    if v_from is not null and v_to is not null
       and public.pricing_date_in_mmdd_range(p_date, v_from, v_to) then
      v_tier := lower(coalesce(v_entry ->> 'tier', 'mid'));
      exit;
    end if;
  end loop;

  return case v_tier
    when 'low' then public.pricing_param_number(p_params, 'SEASON_FACTOR_LOW', 0.9)
    when 'high' then public.pricing_param_number(p_params, 'SEASON_FACTOR_HIGH', 1.2)
    else public.pricing_param_number(p_params, 'SEASON_FACTOR_MID', 1.0)
  end;
end;
$$;

create or replace function public.pricing_resolve_special_factor(p_params jsonb, p_date date)
returns numeric
language plpgsql
stable
as $$
declare
  v_entry jsonb;
  v_start date;
  v_end date;
  v_mult numeric;
begin
  for v_entry in
    select * from jsonb_array_elements(coalesce(p_params -> 'SPECIAL_DATES', '[]'::jsonb))
  loop
    v_start := (v_entry ->> 'start')::date;
    v_end := coalesce((v_entry ->> 'end')::date, v_start);
    if v_start is not null and p_date >= v_start and p_date <= v_end then
      v_mult := coalesce((v_entry ->> 'multiplier')::numeric, 1.0);
      return v_mult;
    end if;
  end loop;
  return 1.0;
end;
$$;

create or replace function public.pricing_resolve_demand_factor(p_listing_id uuid, p_date date)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(
    (
      select ldf."DemandFactor"
      from public."ListingDailyFactors" ldf
      where ldf."ListingId" = p_listing_id
        and ldf."Date" = p_date
      limit 1
    ),
    1.0
  );
$$;

create or replace function public.pricing_commercial_round(p_amount numeric, p_mode text)
returns numeric
language plpgsql
immutable
as $$
declare
  v_mode text := lower(coalesce(p_mode, 'none'));
begin
  if v_mode = 'tens' then
    return round(p_amount / 10.0) * 10.0;
  elsif v_mode = 'ending_99' then
    if p_amount <= 0 then
      return 0;
    end if;
    return floor(p_amount / 100.0) * 100.0 + 99.0;
  end if;
  return round(p_amount::numeric, 2);
end;
$$;

create or replace function public.pricing_clamp(p_amount numeric, p_min numeric, p_max numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_min is not null and p_amount < p_min then p_min
    when p_max is not null and p_amount > p_max then p_max
    else p_amount
  end;
$$;

-- Nightly price for one date (before stay discount on total)
create or replace function public.pricing_compute_nightly(
  p_listing_id uuid,
  p_base_price numeric,
  p_min_price numeric,
  p_max_price numeric,
  p_date date,
  p_params jsonb,
  p_search_date date default current_date
)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_raw numeric;
  v_season numeric;
  v_special numeric;
  v_demand numeric;
  v_anticipation numeric := 1.0;
  v_days_until integer;
  v_round_mode text;
begin
  if p_base_price is null or p_base_price <= 0 then
    return null;
  end if;

  v_season := public.pricing_resolve_season_factor(p_params, p_date);
  v_special := public.pricing_resolve_special_factor(p_params, p_date);
  v_demand := public.pricing_resolve_demand_factor(p_listing_id, p_date);

  v_days_until := p_date - coalesce(p_search_date, current_date);
  if v_days_until >= public.pricing_param_number(p_params, 'ANTICIPATION_MIN_DAYS', 30)::integer then
    v_anticipation := public.pricing_param_number(p_params, 'ANTICIPATION_MULTIPLIER', 0.95);
  end if;

  v_raw := p_base_price * v_season * v_special * v_demand * v_anticipation;
  v_raw := public.pricing_clamp(v_raw, p_min_price, p_max_price);
  v_round_mode := coalesce(p_params ->> 'PRICE_ROUNDING_MODE', 'tens');
  return public.pricing_commercial_round(v_raw, v_round_mode);
end;
$$;

-- Stay total for dynamic listing types
create or replace function public.pricing_compute_stay_total(
  p_listing_id uuid,
  p_estate_property_id uuid,
  p_listing_type text,
  p_check_in date,
  p_check_out date,
  p_site_scope text default 'SummerRent',
  p_search_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_params jsonb;
  v_nights integer;
  v_d date;
  v_sum numeric := 0;
  v_nightly numeric;
  v_stay_factor numeric := 1.0;
  v_total numeric;
  v_avg numeric;
begin
  select l.*
  into v_listing
  from public."Listings" l
  where l."EstatePropertyId" = p_estate_property_id
    and l."ListingType" = p_listing_type::public."ListingType"
    and l."IsDeleted" = false
    and l."IsFeatured" = true
  order by l."LastModified" desc
  limit 1;

  if v_listing."Id" is null then
    return jsonb_build_object(
      'is_valid', false,
      'errors', jsonb_build_array('Listing not found'),
      'pricing', null
    );
  end if;

  if v_listing."BasePrice" is null then
    -- Legacy: use RentPrice as base
    if v_listing."RentPrice" is null then
      return jsonb_build_object(
        'is_valid', false,
        'errors', jsonb_build_array('Listing has no base price'),
        'pricing', null
      );
    end if;
    v_listing."BasePrice" := v_listing."RentPrice";
  end if;

  v_params := public.get_app_parameters(coalesce(nullif(trim(p_site_scope), ''), 'global'));
  v_nights := (p_check_out - p_check_in);

  if v_nights <= 0 then
    return jsonb_build_object(
      'is_valid', false,
      'errors', jsonb_build_array('Invalid date range'),
      'pricing', null
    );
  end if;

  v_d := p_check_in;
  while v_d < p_check_out loop
    v_nightly := public.pricing_compute_nightly(
      v_listing."Id",
      v_listing."BasePrice",
      v_listing."MinPrice",
      v_listing."MaxPrice",
      v_d,
      v_params,
      p_search_date
    );
    v_sum := v_sum + coalesce(v_nightly, 0);
    v_d := v_d + 1;
  end loop;

  if v_listing."LongStayDiscountEnabled"
     and v_listing."LongStayMinDays" is not null
     and v_nights >= v_listing."LongStayMinDays"
     and v_listing."LongStayDiscountPercentage" is not null then
    v_stay_factor := greatest(
      0,
      1.0 - (v_listing."LongStayDiscountPercentage" / 100.0)
    );
    v_sum := v_sum * v_stay_factor;
  end if;

  v_total := round(v_sum::numeric, 2);
  v_avg := case when v_nights > 0 then round((v_total / v_nights)::numeric, 2) else v_total end;

  return jsonb_build_object(
    'is_valid', true,
    'errors', '[]'::jsonb,
    'pricing', jsonb_build_object(
      'nightly_price', v_avg,
      'nights', v_nights,
      'total_price', v_total,
      'listing_id', v_listing."Id"
    )
  );
end;
$$;

grant execute on function public.pricing_compute_stay_total(
  uuid, uuid, text, date, date, text, date
) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- validate_booking_selection (create or replace)
-- -----------------------------------------------------------------------------
create or replace function public.validate_booking_selection(
  p_property_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer,
  p_listing_type text default null,
  p_client_total numeric default null,
  p_site_scope text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_listing_type text;
  v_scope text;
  v_result jsonb;
  v_total numeric;
  v_tolerance numeric;
  v_pricing jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_is_valid boolean := true;
begin
  if p_guests is null or p_guests < 1 then
    v_errors := v_errors || jsonb_build_array('Invalid guest count');
    v_is_valid := false;
  end if;

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    v_errors := v_errors || jsonb_build_array('Invalid check-in/check-out dates');
    v_is_valid := false;
  end if;

  if not v_is_valid then
    return jsonb_build_object('is_valid', false, 'errors', v_errors, 'pricing', null);
  end if;

  -- Resolve listing type from featured listing if omitted
  v_listing_type := nullif(trim(coalesce(p_listing_type, '')), '');
  if v_listing_type is null then
    select l."ListingType"::text
    into v_listing_type
    from public."Listings" l
    where l."EstatePropertyId" = p_property_id
      and l."IsDeleted" = false
      and l."IsFeatured" = true
    limit 1;
  end if;

  v_scope := coalesce(nullif(trim(p_site_scope), ''), v_listing_type, 'SummerRent');

  if v_listing_type in ('SummerRent', 'EventVenue') then
    v_result := public.pricing_compute_stay_total(
      null,
      p_property_id,
      v_listing_type,
      p_check_in,
      p_check_out,
      v_scope,
      current_date
    );

    if not coalesce((v_result->>'is_valid')::boolean, false) then
      return v_result;
    end if;

    v_pricing := v_result -> 'pricing';
    v_total := (v_pricing->>'total_price')::numeric;

    v_tolerance := public.pricing_param_number(
      public.get_app_parameters(v_scope),
      'PRICE_QUOTE_TOLERANCE',
      1
    );

    if p_client_total is not null and abs(v_total - p_client_total) > v_tolerance then
      return jsonb_build_object(
        'is_valid', false,
        'errors', jsonb_build_array('Price quote mismatch'),
        'error_code', 'PRICE_QUOTE_MISMATCH',
        'pricing', v_pricing
      );
    end if;

    return jsonb_build_object(
      'is_valid', true,
      'errors', '[]'::jsonb,
      'pricing', v_pricing
    );
  end if;

  -- Non dynamic types: legacy flat rent * nights if RentPrice set
  declare
    v_listing record;
    v_nights integer := (p_check_out - p_check_in);
    v_legacy_total numeric;
  begin
    select l."RentPrice", l."Id"
    into v_listing
    from public."Listings" l
    where l."EstatePropertyId" = p_property_id
      and l."IsDeleted" = false
      and l."IsFeatured" = true
    limit 1;

    if v_listing."RentPrice" is not null and v_nights > 0 then
      v_legacy_total := round((v_listing."RentPrice" * v_nights)::numeric, 2);
      v_pricing := jsonb_build_object(
        'nightly_price', v_listing."RentPrice",
        'nights', v_nights,
        'total_price', v_legacy_total
      );
      return jsonb_build_object('is_valid', true, 'errors', '[]'::jsonb, 'pricing', v_pricing);
    end if;

    return jsonb_build_object('is_valid', true, 'errors', '[]'::jsonb, 'pricing', null);
  end;
end;
$$;

grant execute on function public.validate_booking_selection(
  uuid, date, date, integer, text, numeric, text
) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- create_booking_hold: pass client total + listing type into validation
-- -----------------------------------------------------------------------------
drop function if exists public.create_booking_hold(
  uuid, date, date, integer, text, text, date, integer, text
);

create or replace function public.create_booking_hold(
  p_property_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer,
  p_ip_hash text default null,
  p_idempotency_key text default null,
  p_visible_check_out date default null,
  p_estimated_guests integer default null,
  p_listing_type text default null,
  p_client_total numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_validation jsonb;
  v_hold_id uuid;
  v_listing_type text := null;
  v_scope text := null;
begin
  if coalesce(trim(p_listing_type), '') <> '' then
    begin
      v_listing_type := public.validate_guest_site_listing_type(p_listing_type)::text;
      v_scope := v_listing_type;
    exception
      when others then
        return jsonb_build_object('success', false, 'error', 'Invalid listing type');
    end;
  end if;

  v_validation := public.validate_booking_selection(
    p_property_id,
    p_check_in,
    coalesce(p_visible_check_out, p_check_out),
    p_guests,
    v_listing_type,
    p_client_total,
    v_scope
  );

  if not coalesce((v_validation->>'is_valid')::boolean, false) then
    return jsonb_build_object(
      'success', false,
      'error', coalesce(v_validation->'errors'->>0, 'Validation failed'),
      'error_code', v_validation->>'error_code',
      'validation', v_validation
    );
  end if;

  if exists (
    select 1
    from public.booking_holds h
    where h.property_id = p_property_id
      and h.status = 'pending'
      and h.expires_at > now()
      and daterange(h.check_in, h.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) then
    return jsonb_build_object('success', false, 'error', 'Selected dates are temporarily held by another guest');
  end if;

  insert into public.booking_holds (
    property_id, check_in, check_out, guests, estimated_guests, ip_hash, idempotency_key, listing_type
  ) values (
    p_property_id, p_check_in, p_check_out, p_guests, p_estimated_guests, p_ip_hash, p_idempotency_key, v_listing_type
  )
  returning id into v_hold_id;

  return jsonb_build_object(
    'success', true,
    'hold', jsonb_build_object(
      'id', v_hold_id,
      'expires_at', (select expires_at from public.booking_holds where id = v_hold_id),
      'listing_type', v_listing_type
    ),
    'validation', v_validation
  );
end;
$$;

grant execute on function public.create_booking_hold(
  uuid, date, date, integer, text, text, date, integer, text, numeric
) to anon, authenticated, service_role;

commit;
