-- Dynamic pricing: Listings columns, AppParameters, ListingDailyFactors, listing RPCs.
-- Apply manually. Idempotent where possible.

begin;

-- -----------------------------------------------------------------------------
-- Listings: dynamic pricing columns
-- -----------------------------------------------------------------------------
alter table if exists public."Listings"
  add column if not exists "BasePrice" numeric null,
  add column if not exists "MinPrice" numeric null,
  add column if not exists "MaxPrice" numeric null,
  add column if not exists "LongStayDiscountEnabled" boolean not null default false,
  add column if not exists "LongStayMinDays" integer null,
  add column if not exists "LongStayDiscountPercentage" numeric null;

comment on column public."Listings"."BasePrice" is 'Nightly/event base for dynamic pricing (SummerRent, EventVenue).';
comment on column public."Listings"."MinPrice" is 'Floor after pricing factors.';
comment on column public."Listings"."MaxPrice" is 'Ceiling after pricing factors.';

-- -----------------------------------------------------------------------------
-- AppParameters
-- -----------------------------------------------------------------------------
do $$
begin
  create type public."AppParameterType" as enum (
    'number',
    'boolean',
    'string',
    'json',
    'date',
    'date_range'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public."AppParameters" (
  "Id" uuid primary key default gen_random_uuid(),
  "Name" text not null,
  "ParameterType" public."AppParameterType" not null default 'string',
  "Value" jsonb not null default 'null'::jsonb,
  "SiteScope" text not null default 'global'
    check ("SiteScope" in ('global', 'SummerRent', 'EventVenue')),
  "Description" text null,
  "IsActive" boolean not null default true,
  "IsDeleted" boolean not null default false,
  "Created" timestamptz not null default now(),
  "LastModified" timestamptz not null default now(),
  constraint "UX_AppParameters_Name_SiteScope" unique ("Name", "SiteScope")
);

create index if not exists "IX_AppParameters_SiteScope_Active"
  on public."AppParameters" ("SiteScope", "IsActive")
  where "IsDeleted" = false;

-- -----------------------------------------------------------------------------
-- ListingDailyFactors (demand + optional precompute; v1 demand defaults to 1)
-- -----------------------------------------------------------------------------
create table if not exists public."ListingDailyFactors" (
  "ListingId" uuid not null references public."Listings" ("Id") on delete cascade,
  "Date" date not null,
  "SeasonFactor" numeric null,
  "SpecialFactor" numeric null,
  "DemandFactor" numeric not null default 1.0,
  "DemandScore" numeric null,
  "ComputedAt" timestamptz not null default now(),
  primary key ("ListingId", "Date")
);

create index if not exists "IX_ListingDailyFactors_Date"
  on public."ListingDailyFactors" ("Date");

-- -----------------------------------------------------------------------------
-- RLS: AppParameters — read authenticated; write admin
-- -----------------------------------------------------------------------------
alter table public."AppParameters" enable row level security;

drop policy if exists "AppParameters_select_authenticated" on public."AppParameters";
create policy "AppParameters_select_authenticated"
  on public."AppParameters"
  for select
  to authenticated, anon
  using ("IsDeleted" = false and "IsActive" = true);

drop policy if exists "AppParameters_all_admin" on public."AppParameters";
create policy "AppParameters_all_admin"
  on public."AppParameters"
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ListingDailyFactors: read for authenticated/anon (guest pricing); write service_role / admin
alter table public."ListingDailyFactors" enable row level security;

drop policy if exists "ListingDailyFactors_select_all" on public."ListingDailyFactors";
create policy "ListingDailyFactors_select_all"
  on public."ListingDailyFactors"
  for select
  to authenticated, anon
  using (true);

drop policy if exists "ListingDailyFactors_write_admin" on public."ListingDailyFactors";
create policy "ListingDailyFactors_write_admin"
  on public."ListingDailyFactors"
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Seed AppParameters (global)
-- -----------------------------------------------------------------------------
insert into public."AppParameters" ("Name", "ParameterType", "Value", "SiteScope", "Description")
values
  ('SEASON_FACTOR_LOW', 'number', '0.90'::jsonb, 'global', 'Low season multiplier'),
  ('SEASON_FACTOR_MID', 'number', '1.00'::jsonb, 'global', 'Mid season multiplier'),
  ('SEASON_FACTOR_HIGH', 'number', '1.20'::jsonb, 'global', 'High season multiplier'),
  ('SEASON_CALENDAR', 'json', '[
    {"from": "05-01", "to": "08-31", "tier": "high"},
    {"from": "12-15", "to": "01-15", "tier": "high"},
    {"from": "03-01", "to": "04-30", "tier": "mid"},
    {"from": "09-01", "to": "11-30", "tier": "mid"}
  ]'::jsonb, 'global', 'MM-DD ranges to low|mid|high tier (Southern hemisphere summer example)'),
  ('SPECIAL_DATES', 'json', '[]'::jsonb, 'global', 'Array of {start, end, multiplier} holiday/special periods'),
  ('ANTICIPATION_MIN_DAYS', 'number', '30'::jsonb, 'global', 'Days before check-in to apply anticipation discount'),
  ('ANTICIPATION_MULTIPLIER', 'number', '0.95'::jsonb, 'global', 'Multiplier when anticipation threshold met'),
  ('PRICE_ROUNDING_MODE', 'string', '"tens"'::jsonb, 'global', 'none | tens | ending_99'),
  ('PRICE_QUOTE_TOLERANCE', 'number', '1'::jsonb, 'global', 'Max abs diff for client vs server total on hold'),
  ('DEMAND_FACTOR_MIN', 'number', '1.00'::jsonb, 'global', 'Demand multiplier at score 0'),
  ('DEMAND_FACTOR_MAX', 'number', '1.25'::jsonb, 'global', 'Demand multiplier at score 1'),
  ('DEMAND_LOOKBACK_DAYS', 'number', '90'::jsonb, 'global', 'Lookback window for demand signals (phase 2 cron)'),
  ('DEMAND_WEIGHTS', 'json', '{"bookings": 0.6, "holds": 0.3, "views": 0.1}'::jsonb, 'global', 'Signal weights for demand cron')
on conflict ("Name", "SiteScope") do nothing;

-- -----------------------------------------------------------------------------
-- get_app_parameters: merge global + site scope (site wins on name collision)
-- -----------------------------------------------------------------------------
create or replace function public.get_app_parameters(p_site_scope text default 'global')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope text := coalesce(nullif(trim(p_site_scope), ''), 'global');
  v_result jsonb := '{}'::jsonb;
  v_row record;
begin
  if v_scope not in ('global', 'SummerRent', 'EventVenue') then
    v_scope := 'global';
  end if;

  for v_row in
    select ap."Name", ap."Value"
    from public."AppParameters" ap
    where ap."IsDeleted" = false
      and ap."IsActive" = true
      and ap."SiteScope" = 'global'
    order by ap."Name"
  loop
    v_result := v_result || jsonb_build_object(v_row."Name", v_row."Value");
  end loop;

  if v_scope <> 'global' then
    for v_row in
      select ap."Name", ap."Value"
      from public."AppParameters" ap
      where ap."IsDeleted" = false
        and ap."IsActive" = true
        and ap."SiteScope" = v_scope
      order by ap."Name"
    loop
      v_result := v_result || jsonb_build_object(v_row."Name", v_row."Value");
    end loop;
  end if;

  return v_result;
end;
$$;

comment on function public.get_app_parameters(text) is
  'Returns merged app parameter map (global + site scope; site overrides).';

grant execute on function public.get_app_parameters(text) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- upsert_app_parameter (admin)
-- -----------------------------------------------------------------------------
create or replace function public.upsert_app_parameter(
  p_name text,
  p_parameter_type text,
  p_value jsonb,
  p_site_scope text default 'global',
  p_description text default null,
  p_is_active boolean default true,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_type public."AppParameterType";
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  v_type := p_parameter_type::public."AppParameterType";

  if p_id is not null then
    update public."AppParameters"
    set
      "Name" = upper(trim(p_name)),
      "ParameterType" = v_type,
      "Value" = p_value,
      "SiteScope" = coalesce(nullif(trim(p_site_scope), ''), 'global'),
      "Description" = p_description,
      "IsActive" = coalesce(p_is_active, true),
      "LastModified" = now()
    where "Id" = p_id
      and "IsDeleted" = false
    returning "Id" into v_id;

    if v_id is null then
      raise exception 'Parameter not found';
    end if;
    return v_id;
  end if;

  insert into public."AppParameters" (
    "Name", "ParameterType", "Value", "SiteScope", "Description", "IsActive"
  )
  values (
    upper(trim(p_name)),
    v_type,
    p_value,
    coalesce(nullif(trim(p_site_scope), ''), 'global'),
    p_description,
    coalesce(p_is_active, true)
  )
  on conflict ("Name", "SiteScope") do update
  set
    "ParameterType" = excluded."ParameterType",
    "Value" = excluded."Value",
    "Description" = excluded."Description",
    "IsActive" = excluded."IsActive",
    "IsDeleted" = false,
    "LastModified" = now()
  returning "Id" into v_id;

  return v_id;
end;
$$;

grant execute on function public.upsert_app_parameter(
  text, text, jsonb, text, text, boolean, uuid
) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- get_listing_daily_factors
-- -----------------------------------------------------------------------------
create or replace function public.get_listing_daily_factors(
  p_listing_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', ldf."Date",
        'seasonFactor', ldf."SeasonFactor",
        'specialFactor', ldf."SpecialFactor",
        'demandFactor', ldf."DemandFactor",
        'demandScore', ldf."DemandScore"
      )
      order by ldf."Date"
    ),
    '[]'::jsonb
  )
  from public."ListingDailyFactors" ldf
  where ldf."ListingId" = p_listing_id
    and ldf."Date" >= p_from
    and ldf."Date" < p_to;
$$;

grant execute on function public.get_listing_daily_factors(uuid, date, date)
  to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- insert_listing (extended)
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'insert_listing'
  loop
    execute 'drop function if exists ' || r.sig::text || ' cascade';
  end loop;
end
$$;

create or replace function public.insert_listing(
  p_estate_property_id uuid,
  p_listing_type text,
  p_title text,
  p_description text default null,
  p_available_from timestamptz default now(),
  p_capacity integer default null,
  p_currency integer default 0,
  p_sale_price numeric default null,
  p_rent_price numeric default null,
  p_rent_price_period text default null,
  p_has_common_expenses boolean default null,
  p_common_expenses_value numeric default null,
  p_is_electricity_included boolean default null,
  p_is_water_included boolean default null,
  p_is_price_visible boolean default true,
  p_status integer default null,
  p_is_active boolean default true,
  p_is_property_visible boolean default true,
  p_is_featured boolean default false,
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
  v_id uuid := gen_random_uuid();
  v_period public."RentPricePeriod" := null;
  v_rent numeric := p_rent_price;
  v_base numeric := p_base_price;
begin
  if p_rent_price_period is not null and p_rent_price_period not in ('PerNight', 'PerMonth') then
    raise exception 'Invalid rent price period: %', p_rent_price_period;
  end if;

  if p_rent_price_period is not null then
    v_period := p_rent_price_period::public."RentPricePeriod";
  end if;

  if v_base is not null and v_rent is null then
    v_rent := v_base;
  elsif v_rent is not null and v_base is null then
    v_base := v_rent;
  end if;

  insert into public."Listings" (
    "Id", "EstatePropertyId", "ListingType", "Title", "Description", "AvailableFrom",
    "Capacity", "Currency", "SalePrice", "RentPrice", "RentPricePeriod",
    "HasCommonExpenses", "CommonExpensesValue", "IsElectricityIncluded", "IsWaterIncluded",
    "IsPriceVisible", "Status", "IsActive", "IsPropertyVisible", "IsFeatured",
    "BlockedForBooking", "BasePrice", "MinPrice", "MaxPrice",
    "LongStayDiscountEnabled", "LongStayMinDays", "LongStayDiscountPercentage",
    "IsDeleted", "Created", "LastModified"
  ) values (
    v_id, p_estate_property_id, p_listing_type::public."ListingType", p_title, p_description,
    coalesce(p_available_from, now()), p_capacity, p_currency, p_sale_price, v_rent, v_period,
    p_has_common_expenses, p_common_expenses_value, p_is_electricity_included, p_is_water_included,
    p_is_price_visible, p_status, p_is_active, p_is_property_visible, p_is_featured,
    p_blocked_for_booking, v_base, p_min_price, p_max_price,
    coalesce(p_long_stay_discount_enabled, false), p_long_stay_min_days, p_long_stay_discount_percentage,
    false, now(), now()
  );

  return v_id;
end;
$$;

grant execute on function public.insert_listing(
  uuid, text, text, text, timestamptz, integer, integer, numeric, numeric, text,
  boolean, numeric, boolean, boolean, boolean, integer, boolean, boolean, boolean, boolean,
  numeric, numeric, numeric, boolean, integer, numeric
) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- create_listing_version (extended)
-- -----------------------------------------------------------------------------
drop function if exists public.create_listing_version(
  uuid, text, text, text, timestamptz, integer, double precision, double precision, text,
  boolean, boolean, boolean, boolean
);

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
