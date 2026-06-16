-- Listings: rent price period + nullable real-estate-oriented columns + insert_listing RPC.
-- Apply manually in Supabase (do not run from this repo unless you intend to).
-- If `p_listing_type::public."ListingType"` fails, align the enum name/values with your DB.

-- 1) Rent basis enum (nightly vs monthly)
do $$
begin
  create type public."RentPricePeriod" as enum ('PerNight', 'PerMonth');
exception
  when duplicate_object then null;
end
$$;

alter table if exists public."Listings"
  add column if not exists "RentPricePeriod" public."RentPricePeriod" null;

-- 2) Allow nulls for fields no longer collected on generic listing step
alter table if exists public."Listings" alter column "SalePrice" drop not null;
alter table if exists public."Listings" alter column "HasCommonExpenses" drop not null;
alter table if exists public."Listings" alter column "CommonExpensesValue" drop not null;
alter table if exists public."Listings" alter column "IsElectricityIncluded" drop not null;
alter table if exists public."Listings" alter column "IsWaterIncluded" drop not null;
alter table if exists public."Listings" alter column "Status" drop not null;

-- 3) insert_listing — align with app (PropertyService.createPropertyWithOwnerUserId)
-- Adjust ListingType cast if your enum name/values differ.
create or replace function public.insert_listing(
  p_estate_property_id uuid,
  p_listing_type text,
  p_title text,
  p_description text default null,
  p_available_from timestamptz default now(),
  p_capacity integer default null,
  p_currency integer not null default 0,
  p_sale_price numeric default null,
  p_rent_price numeric default null,
  p_rent_price_period text default null,
  p_has_common_expenses boolean default null,
  p_common_expenses_value numeric default null,
  p_is_electricity_included boolean default null,
  p_is_water_included boolean default null,
  p_is_price_visible boolean not null default true,
  p_status integer default null,
  p_is_active boolean not null default true,
  p_is_property_visible boolean not null default true,
  p_is_featured boolean not null default false,
  p_blocked_for_booking boolean not null default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_period public."RentPricePeriod" := null;
begin
  if p_rent_price_period is not null and p_rent_price_period not in ('PerNight', 'PerMonth') then
    raise exception 'Invalid rent price period: %', p_rent_price_period;
  end if;

  if p_rent_price_period is not null then
    v_period := p_rent_price_period::public."RentPricePeriod";
  end if;

  insert into public."Listings" (
    "Id",
    "EstatePropertyId",
    "ListingType",
    "Title",
    "Description",
    "AvailableFrom",
    "Capacity",
    "Currency",
    "SalePrice",
    "RentPrice",
    "RentPricePeriod",
    "HasCommonExpenses",
    "CommonExpensesValue",
    "IsElectricityIncluded",
    "IsWaterIncluded",
    "IsPriceVisible",
    "Status",
    "IsActive",
    "IsPropertyVisible",
    "IsFeatured",
    "BlockedForBooking",
    "IsDeleted",
    "Created",
    "LastModified"
  ) values (
    v_id,
    p_estate_property_id,
    p_listing_type::public."ListingType",
    p_title,
    p_description,
    coalesce(p_available_from, now()),
    p_capacity,
    p_currency,
    p_sale_price,
    p_rent_price,
    v_period,
    p_has_common_expenses,
    p_common_expenses_value,
    p_is_electricity_included,
    p_is_water_included,
    p_is_price_visible,
    p_status,
    p_is_active,
    p_is_property_visible,
    p_is_featured,
    p_blocked_for_booking,
    false,
    now(),
    now()
  );

  return v_id;
end;
$$;

comment on function public.insert_listing is
  'Creates a Listings row for property creation wizard; supports nullable RE-only columns and RentPricePeriod.';

grant execute on function public.insert_listing(
  uuid, text, text, text, timestamptz, integer, integer, numeric, numeric, text,
  boolean, numeric, boolean, boolean, boolean, integer, boolean, boolean, boolean, boolean
) to authenticated;

grant execute on function public.insert_listing(
  uuid, text, text, text, timestamptz, integer, integer, numeric, numeric, text,
  boolean, numeric, boolean, boolean, boolean, integer, boolean, boolean, boolean, boolean
) to service_role;
