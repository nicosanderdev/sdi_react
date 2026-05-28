-- Fix: cast p_rent_price_period (text) to RentPricePeriod enum before INSERT.
-- Mirrors insert_listing handling in 20260602120000_dynamic_pricing_schema.sql.

begin;

create or replace function public.create_listing_version(
  p_estate_property_id uuid,
  p_listing_type text,
  p_title text,
  p_description text default null,
  p_available_from timestamptz default null,
  p_currency integer default 0,
  p_sale_price double precision default null,
  p_rent_price double precision default null,
  p_rent_price_period text default null,
  p_is_price_visible boolean default true,
  p_is_active boolean default true,
  p_is_property_visible boolean default true,
  p_blocked_for_booking boolean default false,
  p_base_price numeric default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_long_stay_discount_enabled boolean default false,
  p_long_stay_min_days integer default null,
  p_long_stay_discount_percentage numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_listing_id uuid;
  v_rent double precision := p_rent_price;
  v_base numeric := p_base_price;
  v_period public."RentPricePeriod" := null;
begin
  if p_rent_price_period is not null and p_rent_price_period not in ('PerNight', 'PerMonth') then
    raise exception 'Invalid rent price period: %', p_rent_price_period;
  end if;

  if p_rent_price_period is not null then
    v_period := p_rent_price_period::public."RentPricePeriod";
  end if;

  if v_base is not null and v_rent is null then
    v_rent := v_base::double precision;
  elsif v_rent is not null and v_base is null then
    v_base := v_rent::numeric;
  end if;

  update public."Listings"
  set
    "IsFeatured" = false,
    "IsActive" = false,
    "IsPropertyVisible" = false,
    "LastModified" = now()
  where "EstatePropertyId" = p_estate_property_id
    and "ListingType" = p_listing_type::public."ListingType"
    and "IsDeleted" = false
    and "IsFeatured" = true;

  insert into public."Listings" (
    "EstatePropertyId", "ListingType", "Title", "Description", "AvailableFrom", "Currency",
    "SalePrice", "RentPrice", "RentPricePeriod", "IsPriceVisible", "IsActive", "IsPropertyVisible",
    "IsFeatured", "BlockedForBooking", "BasePrice", "MinPrice", "MaxPrice",
    "LongStayDiscountEnabled", "LongStayMinDays", "LongStayDiscountPercentage",
    "IsDeleted", "Created", "LastModified"
  )
  values (
    p_estate_property_id, p_listing_type::public."ListingType", p_title, p_description,
    coalesce(p_available_from, now()), p_currency, p_sale_price, v_rent, v_period,
    p_is_price_visible, p_is_active, p_is_property_visible, true, p_blocked_for_booking,
    v_base, p_min_price, p_max_price,
    coalesce(p_long_stay_discount_enabled, false), p_long_stay_min_days, p_long_stay_discount_percentage,
    false, now(), now()
  )
  returning "Id" into v_new_listing_id;

  return v_new_listing_id;
end;
$$;

grant execute on function public.create_listing_version(
  uuid, text, text, text, timestamptz, integer, double precision, double precision, text,
  boolean, boolean, boolean, boolean, numeric, numeric, numeric, boolean, integer, numeric
) to authenticated, service_role;

commit;
