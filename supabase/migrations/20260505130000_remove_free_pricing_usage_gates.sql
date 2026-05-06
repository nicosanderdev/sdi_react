-- Remove `free` pricing model, add BookingLimit, extend get_active_member_plan,
-- update billing RPCs, and add flexible_usage_limit_check for gated usage registration.
-- Does not modify prior migration files; forward-only changes.

begin;

-- -----------------------------------------------------------------------------
-- Plans: BookingLimit (null = unlimited bookings in window for per_booking/hybrid)
-- -----------------------------------------------------------------------------
alter table public."Plans"
  add column if not exists "BookingLimit" integer null;

comment on column public."Plans"."BookingLimit" is
  'Max booking UsageRecords per billing window for per_booking/hybrid; null = unlimited.';

-- -----------------------------------------------------------------------------
-- Data: migrate legacy free rows before tightening CHECK / enum
-- -----------------------------------------------------------------------------
update public."Plans"
set
  "PricingModel" = 'hybrid',
  "MinMonthlyFee" = coalesce("MinMonthlyFee", 0),
  "Price" = coalesce("Price", "MonthlyPrice", 0)
where coalesce("PricingModel", '') = 'free';

-- -----------------------------------------------------------------------------
-- CHECK constraint (no `free`)
-- -----------------------------------------------------------------------------
alter table public."Plans" drop constraint if exists "CK_Plans_PricingModel";

alter table public."Plans"
  add constraint "CK_Plans_PricingModel"
  check ("PricingModel" in ('per_booking', 'per_listing', 'hybrid'));

-- -----------------------------------------------------------------------------
-- Enum public.pricing_model: drop label `free` when supported (PG 15+)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'pricing_model'
      and n.nspname = 'public'
  ) then
    begin
      execute 'alter type public.pricing_model drop value if exists free';
    exception
      when others then
        raise notice 'Could not drop enum label pricing_model.free: %', sqlerrm;
    end;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_active_member_plan: expose BookingLimit
-- -----------------------------------------------------------------------------
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
  booking_limit integer,
  duration_days integer
)
language sql
stable
security definer
set search_path = public
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
    p."BookingLimit" as booking_limit,
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

-- -----------------------------------------------------------------------------
-- compute_billing_cycle_total: remove obsolete `free` branch
-- -----------------------------------------------------------------------------
create or replace function public.compute_billing_cycle_total(
  p_member_id uuid,
  p_billing_cycle_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
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

  if v_pricing_model = 'per_booking' then
    v_total := coalesce(v_usage_total, 0);
  elseif v_pricing_model = 'per_listing' then
    v_total := greatest(v_listing_count, 0) * coalesce(v_price, 0);
  elseif v_pricing_model = 'hybrid' then
    v_total := greatest(v_min_monthly_fee, coalesce(v_usage_total, 0));
  else
    raise exception 'Unsupported pricing model: %', v_pricing_model;
  end if;

  if v_listing_limit is not null and v_listing_count > v_listing_limit then
    raise notice 'Listing limit exceeded for member %: % > %', p_member_id, v_listing_count, v_listing_limit;
  end if;

  return v_total;
end;
$$;

-- -----------------------------------------------------------------------------
-- admin_generate_invoice_from_usage: remove obsolete `free` branch
-- -----------------------------------------------------------------------------
create or replace function public.admin_generate_invoice_from_usage(
  p_usage_record_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user uuid;
  v_is_admin boolean := false;
  v_usage_count int := 0;
  v_member_count int := 0;
  v_member_id uuid;
  v_plan_pricing_model text;
  v_price_per_booking numeric := 0;
  v_min_monthly_fee numeric := 0;
  v_price numeric := 0;
  v_duration_days integer := 30;
  v_booking_count int := 0;
  v_listing_total numeric := 0;
  v_total numeric := 0;
  v_due_date timestamptz;
  v_cycle_id uuid;
  v_invoice_id uuid;
begin
  v_current_user := auth.uid();
  if v_current_user is null then
    raise exception 'Unauthorized';
  end if;

  select exists (
    select 1
    from public."Members" m
    where m."UserId" = v_current_user
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Forbidden: admin only';
  end if;

  if p_usage_record_ids is null or cardinality(p_usage_record_ids) = 0 then
    raise exception 'No usage records provided';
  end if;

  select count(*), count(distinct ur."MemberId")
  into v_usage_count, v_member_count
  from public."UsageRecords" ur
  where ur."Id" = any(p_usage_record_ids)
    and ur."InvoiceId" is null;

  if v_usage_count = 0 then
    raise exception 'No unbilled usage records found';
  end if;

  if v_usage_count <> cardinality(p_usage_record_ids) then
    raise exception 'Some usage records are already billed or invalid';
  end if;

  if v_member_count <> 1 then
    raise exception 'Selected usage records must belong to exactly one member';
  end if;

  select distinct ur."MemberId"
  into v_member_id
  from public."UsageRecords" ur
  where ur."Id" = any(p_usage_record_ids)
  limit 1;

  select
    amp.pricing_model,
    coalesce(amp.price_per_booking, 0),
    coalesce(amp.min_monthly_fee, 0),
    coalesce(amp.price, 0),
    coalesce(amp.duration_days, 30)
  into
    v_plan_pricing_model,
    v_price_per_booking,
    v_min_monthly_fee,
    v_price,
    v_duration_days
  from public.get_active_member_plan(v_member_id, now()) amp
  limit 1;

  if v_plan_pricing_model is null then
    raise exception 'Missing active plan for member %', v_member_id;
  end if;

  if v_plan_pricing_model = 'per_booking' then
    select count(*)
    into v_booking_count
    from public."UsageRecords" ur
    where ur."Id" = any(p_usage_record_ids)
      and ur."Type" = 'booking';

    v_total := v_booking_count * v_price_per_booking;
  elseif v_plan_pricing_model = 'hybrid' then
    select count(*)
    into v_booking_count
    from public."UsageRecords" ur
    where ur."Id" = any(p_usage_record_ids)
      and ur."Type" = 'booking';

    v_total := greatest(v_min_monthly_fee, v_booking_count * v_price_per_booking);
  elseif v_plan_pricing_model = 'per_listing' then
    select coalesce(sum(coalesce(ur."Amount", 0)), 0)
    into v_listing_total
    from public."UsageRecords" ur
    where ur."Id" = any(p_usage_record_ids)
      and ur."Type" = 'listing';

    v_total := v_listing_total;
  else
    raise exception 'Invalid pricing config: unsupported pricing model %', v_plan_pricing_model;
  end if;

  v_due_date := now() + interval '7 days';
  select bc."Id"
  into v_cycle_id
  from public."BillingCycles" bc
  where bc."MemberId" = v_member_id
    and bc."Status" = 'open'
    and bc."StartDate" <= now()
    and bc."EndDate" >= now()
  order by bc."StartDate" desc
  limit 1;

  if v_cycle_id is null then
    insert into public."BillingCycles" (
      "MemberId",
      "StartDate",
      "EndDate",
      "Status",
      "TotalAmount",
      "CreatedAt",
      "UpdatedAt",
      "CreatedBy",
      "LastModifiedBy"
    )
    values (
      v_member_id,
      now(),
      now() + make_interval(days => v_duration_days),
      'open',
      0,
      now(),
      now(),
      v_current_user::text,
      v_current_user::text
    )
    returning "Id" into v_cycle_id;
  end if;

  insert into public."Invoices" (
    "MemberId",
    "BillingCycleId",
    "Total",
    "Status",
    "DueDate",
    "CreatedAt",
    "UpdatedAt",
    "CreatedBy",
    "LastModifiedBy"
  )
  values (
    v_member_id,
    v_cycle_id,
    v_total,
    'pending',
    v_due_date,
    now(),
    now(),
    v_current_user::text,
    v_current_user::text
  )
  returning "Id" into v_invoice_id;

  update public."UsageRecords"
  set "InvoiceId" = v_invoice_id
  where "Id" = any(p_usage_record_ids)
    and "InvoiceId" is null;

  return v_invoice_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Optional server-side guard: single source of truth for limit math (client calls)
-- -----------------------------------------------------------------------------
create or replace function public.flexible_usage_limit_check(
  p_member_id uuid,
  p_usage_type text,
  p_reference_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_model text;
  v_listing_limit integer;
  v_booking_limit integer;
  v_duration_days integer;
  v_win_start timestamptz;
  v_win_end timestamptz;
  v_cnt integer;
  v_exists boolean;
begin
  if p_usage_type is null or p_usage_type not in ('booking', 'listing') then
    return jsonb_build_object('allowed', false, 'reason', 'invalid usage type');
  end if;

  select
    amp.pricing_model,
    amp.listing_limit,
    amp.booking_limit,
    coalesce(amp.duration_days, 30)
  into v_model, v_listing_limit, v_booking_limit, v_duration_days
  from public.get_active_member_plan(p_member_id, now()) amp;

  if v_model is null then
    return jsonb_build_object('allowed', false, 'reason', 'no active plan');
  end if;

  if p_usage_type = 'booking' and v_model not in ('per_booking', 'hybrid') then
    return jsonb_build_object('allowed', true, 'skipped', true);
  end if;

  if p_usage_type = 'listing' and v_model not in ('per_listing', 'hybrid') then
    return jsonb_build_object('allowed', true, 'skipped', true);
  end if;

  select bc."StartDate", bc."EndDate"
  into v_win_start, v_win_end
  from public."BillingCycles" bc
  where bc."MemberId" = p_member_id
    and bc."Status" = 'open'
    and bc."StartDate" <= now()
    and bc."EndDate" >= now()
  order by bc."StartDate" desc
  limit 1;

  if v_win_start is null then
    v_win_end := now();
    v_win_start := v_win_end - make_interval(days => greatest(coalesce(v_duration_days, 30), 1));
  end if;

  if p_usage_type = 'listing' then
    if v_listing_limit is null then
      return jsonb_build_object('allowed', true);
    end if;

    select count(*)::integer
    into v_cnt
    from public."UsageRecords" ur
    where ur."MemberId" = p_member_id
      and ur."Type" = 'listing'
      and ur."CreatedAt" >= v_win_start
      and ur."CreatedAt" < v_win_end;

    if p_reference_id is not null then
      select exists (
        select 1
        from public."UsageRecords" ur2
        where ur2."MemberId" = p_member_id
          and ur2."Type" = 'listing'
          and ur2."ReferenceId" = p_reference_id
      )
      into v_exists;

      if v_exists then
        return jsonb_build_object('allowed', true, 'idempotent', true);
      end if;
    end if;

    if v_cnt >= v_listing_limit then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'listing limit exceeded for the current billing period',
        'current', v_cnt,
        'limit', v_listing_limit
      );
    end if;

    return jsonb_build_object('allowed', true);
  end if;

  -- booking
  if v_booking_limit is null then
    return jsonb_build_object('allowed', true);
  end if;

  select count(*)::integer
  into v_cnt
  from public."UsageRecords" ur
  where ur."MemberId" = p_member_id
    and ur."Type" = 'booking'
    and ur."CreatedAt" >= v_win_start
    and ur."CreatedAt" < v_win_end;

  if p_reference_id is not null then
    select exists (
      select 1
      from public."UsageRecords" ur2
      where ur2."MemberId" = p_member_id
        and ur2."Type" = 'booking'
        and ur2."ReferenceId" = p_reference_id
    )
    into v_exists;

    if v_exists then
      return jsonb_build_object('allowed', true, 'idempotent', true);
    end if;
  end if;

  if v_cnt >= v_booking_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'booking confirmation limit exceeded for the current billing period',
      'current', v_cnt,
      'limit', v_booking_limit
    );
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

grant execute on function public.flexible_usage_limit_check(uuid, text, text) to authenticated;
grant execute on function public.flexible_usage_limit_check(uuid, text, text) to service_role;

comment on function public.flexible_usage_limit_check(uuid, text, text) is
  'Returns JSON {allowed, reason?, current?, limit?}; uses open BillingCycles window or rolling DurationDays window.';

commit;
