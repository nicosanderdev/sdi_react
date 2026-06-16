-- Admin Plans management: upsert_admin_plan RPC for create/update via admin config UI.
-- Apply manually. Depends on public.is_admin() and public."Plans" table.

begin;

-- -----------------------------------------------------------------------------
-- upsert_admin_plan (admin)
-- -----------------------------------------------------------------------------
create or replace function public.upsert_admin_plan(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_is_create boolean;
  v_key integer;
  v_name text;
  v_currency text;
  v_pricing_model text;
  v_property_type public."PropertyType";
  v_price numeric;
  v_monthly_price numeric;
  v_duration_days integer;
  v_billing_cycle integer;
  v_listing_limit integer;
  v_max_properties integer;
  v_max_published integer;
  v_modified_by text;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if p_payload is null or p_payload = '{}'::jsonb then
    raise exception 'Payload required';
  end if;

  v_modified_by := coalesce(auth.jwt() ->> 'email', auth.jwt() ->> 'sub');

  v_id := nullif(trim(p_payload ->> 'Id'), '')::uuid;
  v_is_create := v_id is null;

  v_name := nullif(trim(p_payload ->> 'Name'), '');
  v_currency := nullif(trim(p_payload ->> 'Currency'), '');
  v_pricing_model := nullif(trim(p_payload ->> 'PricingModel'), '');

  if v_pricing_model is not null
     and v_pricing_model not in ('per_booking', 'per_listing', 'hybrid') then
    raise exception 'Invalid PricingModel: %', v_pricing_model;
  end if;

  if p_payload ? 'PropertyType' then
    if p_payload ->> 'PropertyType' is null
       or trim(p_payload ->> 'PropertyType') = '' then
      v_property_type := null;
    else
      v_property_type := (p_payload ->> 'PropertyType')::public."PropertyType";
    end if;
  end if;

  if v_is_create then
    if v_name is null then
      raise exception 'Name is required';
    end if;
    if not (p_payload ? 'Key') or p_payload ->> 'Key' is null then
      raise exception 'Key is required on create';
    end if;
    v_key := (p_payload ->> 'Key')::integer;
    if v_currency is null then
      raise exception 'Currency is required';
    end if;
    if v_pricing_model is null then
      raise exception 'PricingModel is required';
    end if;

    if exists (
      select 1
      from public."Plans" p
      where p."Key" = v_key
    ) then
      raise exception 'Plan Key % already exists', v_key;
    end if;

    v_id := gen_random_uuid();

    v_price := coalesce((p_payload ->> 'Price')::numeric, 0);
    v_monthly_price := coalesce((p_payload ->> 'MonthlyPrice')::numeric, v_price, 0);
    v_duration_days := coalesce((p_payload ->> 'DurationDays')::integer, 30);
    v_billing_cycle := coalesce((p_payload ->> 'BillingCycle')::integer, v_duration_days, 30);
    v_listing_limit := (p_payload ->> 'ListingLimit')::integer;
    v_max_properties := coalesce(
      (p_payload ->> 'MaxProperties')::integer,
      v_listing_limit
    );
    v_max_published := coalesce(
      (p_payload ->> 'MaxPublishedProperties')::integer,
      v_listing_limit,
      v_max_properties
    );

    insert into public."Plans" (
      "Id",
      "Key",
      "Name",
      "MonthlyPrice",
      "Currency",
      "MaxProperties",
      "MaxUsers",
      "MaxStorageMb",
      "BillingCycle",
      "IsActive",
      "IsDeleted",
      "Created",
      "LastModified",
      "LastModifiedBy",
      "MaxPublishedProperties",
      "CommissionPercentage",
      "CommissionMinimumAmount",
      "ExtraPropertiesPrice11to30",
      "ExtraPropertiesPrice31Plus",
      "BookingReceiptMinimumAmount",
      "PropertyType",
      "PricingModel",
      "Price",
      "MinMonthlyFee",
      "PricePerBooking",
      "ListingLimit",
      "DurationDays",
      "IsActiveV2",
      "BookingLimit"
    )
    values (
      v_id,
      v_key,
      v_name,
      v_monthly_price,
      v_currency,
      v_max_properties,
      (p_payload ->> 'MaxUsers')::integer,
      (p_payload ->> 'MaxStorageMb')::integer,
      v_billing_cycle,
      coalesce((p_payload ->> 'IsActive')::boolean, true),
      coalesce((p_payload ->> 'IsDeleted')::boolean, false),
      now(),
      now(),
      v_modified_by,
      v_max_published,
      (p_payload ->> 'CommissionPercentage')::numeric,
      (p_payload ->> 'CommissionMinimumAmount')::numeric,
      (p_payload ->> 'ExtraPropertiesPrice11to30')::numeric,
      (p_payload ->> 'ExtraPropertiesPrice31Plus')::numeric,
      (p_payload ->> 'BookingReceiptMinimumAmount')::numeric,
      v_property_type,
      v_pricing_model,
      v_price,
      (p_payload ->> 'MinMonthlyFee')::numeric,
      (p_payload ->> 'PricePerBooking')::numeric,
      coalesce(v_listing_limit, v_max_published),
      v_duration_days,
      coalesce((p_payload ->> 'IsActiveV2')::boolean, true),
      (p_payload ->> 'BookingLimit')::integer
    );

    return v_id;
  end if;

  if not exists (select 1 from public."Plans" p where p."Id" = v_id) then
    raise exception 'Plan not found';
  end if;

  -- Resolve sync helpers from payload (only when keys present)
  if p_payload ? 'Price' then
    v_price := (p_payload ->> 'Price')::numeric;
  end if;
  if p_payload ? 'MonthlyPrice' then
    v_monthly_price := (p_payload ->> 'MonthlyPrice')::numeric;
  elsif p_payload ? 'Price' then
    v_monthly_price := v_price;
  end if;

  if p_payload ? 'DurationDays' then
    v_duration_days := (p_payload ->> 'DurationDays')::integer;
  end if;
  if p_payload ? 'BillingCycle' then
    v_billing_cycle := (p_payload ->> 'BillingCycle')::integer;
  elsif p_payload ? 'DurationDays' then
    v_billing_cycle := v_duration_days;
  end if;

  if p_payload ? 'ListingLimit' then
    v_listing_limit := (p_payload ->> 'ListingLimit')::integer;
  end if;
  if p_payload ? 'MaxProperties' then
    v_max_properties := (p_payload ->> 'MaxProperties')::integer;
  elsif p_payload ? 'ListingLimit' then
    v_max_properties := v_listing_limit;
  end if;
  if p_payload ? 'MaxPublishedProperties' then
    v_max_published := (p_payload ->> 'MaxPublishedProperties')::integer;
  elsif p_payload ? 'ListingLimit' then
    v_max_published := v_listing_limit;
  elsif p_payload ? 'MaxProperties' then
    v_max_published := v_max_properties;
  end if;

  update public."Plans" p
  set
    "Name" = coalesce(v_name, p."Name"),
    "MonthlyPrice" = coalesce(v_monthly_price, p."MonthlyPrice"),
    "Currency" = coalesce(v_currency, p."Currency"),
    "MaxProperties" = case
      when p_payload ? 'MaxProperties' or p_payload ? 'ListingLimit' then v_max_properties
      else p."MaxProperties"
    end,
    "MaxUsers" = case
      when p_payload ? 'MaxUsers' then (p_payload ->> 'MaxUsers')::integer
      else p."MaxUsers"
    end,
    "MaxStorageMb" = case
      when p_payload ? 'MaxStorageMb' then (p_payload ->> 'MaxStorageMb')::integer
      else p."MaxStorageMb"
    end,
    "BillingCycle" = coalesce(v_billing_cycle, p."BillingCycle"),
    "IsActive" = case
      when p_payload ? 'IsActive' then (p_payload ->> 'IsActive')::boolean
      else p."IsActive"
    end,
    "IsDeleted" = case
      when p_payload ? 'IsDeleted' then (p_payload ->> 'IsDeleted')::boolean
      else p."IsDeleted"
    end,
    "LastModified" = now(),
    "LastModifiedBy" = v_modified_by,
    "MaxPublishedProperties" = case
      when p_payload ? 'MaxPublishedProperties' or p_payload ? 'ListingLimit' or p_payload ? 'MaxProperties'
        then v_max_published
      else p."MaxPublishedProperties"
    end,
    "CommissionPercentage" = case
      when p_payload ? 'CommissionPercentage' then (p_payload ->> 'CommissionPercentage')::numeric
      else p."CommissionPercentage"
    end,
    "CommissionMinimumAmount" = case
      when p_payload ? 'CommissionMinimumAmount' then (p_payload ->> 'CommissionMinimumAmount')::numeric
      else p."CommissionMinimumAmount"
    end,
    "ExtraPropertiesPrice11to30" = case
      when p_payload ? 'ExtraPropertiesPrice11to30' then (p_payload ->> 'ExtraPropertiesPrice11to30')::numeric
      else p."ExtraPropertiesPrice11to30"
    end,
    "ExtraPropertiesPrice31Plus" = case
      when p_payload ? 'ExtraPropertiesPrice31Plus' then (p_payload ->> 'ExtraPropertiesPrice31Plus')::numeric
      else p."ExtraPropertiesPrice31Plus"
    end,
    "BookingReceiptMinimumAmount" = case
      when p_payload ? 'BookingReceiptMinimumAmount' then (p_payload ->> 'BookingReceiptMinimumAmount')::numeric
      else p."BookingReceiptMinimumAmount"
    end,
    "PropertyType" = case
      when p_payload ? 'PropertyType' then v_property_type
      else p."PropertyType"
    end,
    "PricingModel" = coalesce(v_pricing_model, p."PricingModel"),
    "Price" = case
      when p_payload ? 'Price' then v_price
      else p."Price"
    end,
    "MinMonthlyFee" = case
      when p_payload ? 'MinMonthlyFee' then (p_payload ->> 'MinMonthlyFee')::numeric
      else p."MinMonthlyFee"
    end,
    "PricePerBooking" = case
      when p_payload ? 'PricePerBooking' then (p_payload ->> 'PricePerBooking')::numeric
      else p."PricePerBooking"
    end,
    "ListingLimit" = case
      when p_payload ? 'ListingLimit' or p_payload ? 'MaxPublishedProperties' or p_payload ? 'MaxProperties'
        then coalesce(v_listing_limit, v_max_published)
      else p."ListingLimit"
    end,
    "DurationDays" = coalesce(v_duration_days, p."DurationDays"),
    "IsActiveV2" = case
      when p_payload ? 'IsActiveV2' then (p_payload ->> 'IsActiveV2')::boolean
      else p."IsActiveV2"
    end,
    "BookingLimit" = case
      when p_payload ? 'BookingLimit' then (p_payload ->> 'BookingLimit')::integer
      else p."BookingLimit"
    end
  where p."Id" = v_id;

  return v_id;
end;
$$;

comment on function public.upsert_admin_plan(jsonb) is
  'Admin-only create/update for Plans catalog. Key and Id are immutable on update.';

grant execute on function public.upsert_admin_plan(jsonb) to authenticated, service_role;

commit;
