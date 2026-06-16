-- Flexible billing pricing RPCs (plans as source of truth)
-- NOTE: Manual execution by project owner.

begin;

create or replace function public.get_active_member_plan(
  p_member_id uuid,
  p_at timestamptz default now()
)
returns table (
  member_plan_id uuid,
  member_id uuid,
  plan_id uuid,
  pricing_model text,
  price numeric,
  min_monthly_fee numeric,
  price_per_booking numeric,
  listing_limit integer,
  duration_days integer
)
language sql
stable
security definer
as $$
  select
    mp."Id" as member_plan_id,
    mp."MemberId" as member_id,
    p."Id" as plan_id,
    p."PricingModel" as pricing_model,
    p."Price" as price,
    p."MinMonthlyFee" as min_monthly_fee,
    p."PricePerBooking" as price_per_booking,
    p."ListingLimit" as listing_limit,
    p."DurationDays" as duration_days
  from public."MemberPlans" mp
  join public."Plans" p
    on p."Id" = mp."PlanId"
  where mp."MemberId" = p_member_id
    and mp."IsActive" = true
    and coalesce(p."IsActiveV2", p."IsActive", true) = true
    and mp."StartDate" <= p_at
    and (mp."EndDate" is null or mp."EndDate" >= p_at)
  order by mp."StartDate" desc
  limit 1;
$$;

create or replace function public.compute_billing_cycle_total(
  p_member_id uuid,
  p_billing_cycle_id uuid
)
returns numeric
language plpgsql
security definer
as $$
declare
  v_pricing_model text;
  v_price numeric := 0;
  v_min_monthly_fee numeric := 0;
  v_price_per_booking numeric := 0;
  v_listing_limit integer := null;
  v_cycle_start timestamptz;
  v_cycle_end timestamptz;
  v_booking_count integer := 0;
  v_listing_count integer := 0;
  v_usage_total numeric := 0;
  v_total numeric := 0;
begin
  select bc."StartDate", bc."EndDate"
  into v_cycle_start, v_cycle_end
  from public."BillingCycles" bc
  where bc."Id" = p_billing_cycle_id
    and bc."MemberId" = p_member_id
  limit 1;

  if v_cycle_start is null then
    raise exception 'Billing cycle % not found for member %', p_billing_cycle_id, p_member_id;
  end if;

  select
    amp.pricing_model,
    coalesce(amp.price, 0),
    coalesce(amp.min_monthly_fee, 0),
    coalesce(amp.price_per_booking, 0),
    amp.listing_limit
  into
    v_pricing_model,
    v_price,
    v_min_monthly_fee,
    v_price_per_booking,
    v_listing_limit
  from public.get_active_member_plan(p_member_id, v_cycle_start) amp
  limit 1;

  if v_pricing_model is null then
    raise exception 'No active plan found for member %', p_member_id;
  end if;

  select count(*), coalesce(sum("Amount"), 0)
  into v_booking_count, v_usage_total
  from public."UsageRecords"
  where "MemberId" = p_member_id
    and "Type" = 'booking'
    and "CreatedAt" >= v_cycle_start
    and "CreatedAt" < v_cycle_end;

  select count(*)
  into v_listing_count
  from public."UsageRecords"
  where "MemberId" = p_member_id
    and "Type" = 'listing'
    and "CreatedAt" >= v_cycle_start
    and "CreatedAt" < v_cycle_end;

  if v_pricing_model = 'free' then
    v_total := 0;
  elseif v_pricing_model = 'per_booking' then
    v_total := coalesce(v_usage_total, 0);
  elseif v_pricing_model = 'per_listing' then
    v_total := greatest(v_listing_count, 0) * coalesce(v_price, 0);
  elseif v_pricing_model = 'hybrid' then
    -- Hybrid: minimum monthly fee + variable usage
    v_total := greatest(v_min_monthly_fee, coalesce(v_usage_total, 0));
  else
    raise exception 'Unsupported pricing model: %', v_pricing_model;
  end if;

  if v_listing_limit is not null and v_listing_count > v_listing_limit then
    -- Optional safety notice via exception; caller can catch and decide.
    raise notice 'Listing limit exceeded for member %: % > %', p_member_id, v_listing_count, v_listing_limit;
  end if;

  return v_total;
end;
$$;

create or replace function public.generate_invoice_for_cycle(
  p_member_id uuid,
  p_billing_cycle_id uuid,
  p_created_by text default 'system'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_existing_invoice_id uuid;
  v_cycle_status text;
  v_total numeric;
  v_new_invoice_id uuid;
begin
  select i."Id"
  into v_existing_invoice_id
  from public."Invoices" i
  where i."BillingCycleId" = p_billing_cycle_id
  limit 1;

  if v_existing_invoice_id is not null then
    return v_existing_invoice_id;
  end if;

  select "Status"
  into v_cycle_status
  from public."BillingCycles"
  where "Id" = p_billing_cycle_id
    and "MemberId" = p_member_id
  limit 1;

  if v_cycle_status is null then
    raise exception 'Billing cycle % not found for member %', p_billing_cycle_id, p_member_id;
  end if;

  v_total := public.compute_billing_cycle_total(p_member_id, p_billing_cycle_id);

  update public."BillingCycles"
  set
    "TotalAmount" = v_total,
    "Status" = case when "Status" = 'open' then 'closed' else "Status" end,
    "UpdatedAt" = now(),
    "LastModifiedBy" = p_created_by
  where "Id" = p_billing_cycle_id
    and "MemberId" = p_member_id;

  insert into public."Invoices" (
    "MemberId",
    "BillingCycleId",
    "Total",
    "Status",
    "CreatedAt",
    "UpdatedAt",
    "CreatedBy",
    "LastModifiedBy"
  )
  values (
    p_member_id,
    p_billing_cycle_id,
    v_total,
    'pending',
    now(),
    now(),
    p_created_by,
    p_created_by
  )
  returning "Id" into v_new_invoice_id;

  return v_new_invoice_id;
end;
$$;

commit;
