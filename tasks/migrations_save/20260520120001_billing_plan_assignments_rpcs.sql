-- Billing RPCs for polymorphic subject (member | company).
-- Apply after 20260520120000_billing_plan_assignments_schema.sql

begin;

-- -----------------------------------------------------------------------------
-- get_active_plan_assignment
-- -----------------------------------------------------------------------------
create or replace function public.get_active_plan_assignment(
  p_subject_type text,
  p_subject_id uuid,
  p_at timestamptz default now()
)
returns table (
  assignment_id uuid,
  subject_type text,
  subject_id uuid,
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
    bpa."Id" as assignment_id,
    bpa."SubjectType" as subject_type,
    bpa."MemberOrCompanyId" as subject_id,
    p."Id" as plan_id,
    p."PricingModel" as pricing_model,
    p."Price" as price,
    p."MinMonthlyFee" as min_monthly_fee,
    p."PricePerBooking" as price_per_booking,
    p."ListingLimit" as listing_limit,
    p."BookingLimit" as booking_limit,
    p."DurationDays" as duration_days
  from public."BillingPlanAssignments" bpa
  join public."Plans" p
    on p."Id" = bpa."PlanId"
  where bpa."SubjectType" = p_subject_type
    and bpa."MemberOrCompanyId" = p_subject_id
    and bpa."IsActive" = true
    and coalesce(p."IsActiveV2", p."IsActive", true) = true
    and bpa."StartDate" <= p_at
    and (bpa."EndDate" is null or bpa."EndDate" >= p_at)
  order by bpa."StartDate" desc
  limit 1;
$$;

comment on function public.get_active_plan_assignment(text, uuid, timestamptz) is
  'Active plan for a billing subject (member or company).';

-- -----------------------------------------------------------------------------
-- Back-compat wrapper (member subjects only)
-- -----------------------------------------------------------------------------
drop function if exists public.get_active_member_plan(uuid, timestamp with time zone);

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
    apa.assignment_id as member_plan_id,
    apa.subject_id as member_id,
    apa.plan_id,
    apa.pricing_model,
    apa.price,
    apa.min_monthly_fee,
    apa.price_per_booking,
    apa.listing_limit,
    apa.booking_limit,
    apa.duration_days
  from public.get_active_plan_assignment('member', p_member_id, p_at) apa;
$$;

-- -----------------------------------------------------------------------------
-- resolve_property_billing_subject
-- -----------------------------------------------------------------------------
create or replace function public.resolve_property_billing_subject(p_property_id uuid)
returns table (
  subject_type text,
  member_or_company_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_owner_type text;
  v_member_id uuid;
  v_company_id uuid;
begin
  select ep."OwnerId"
  into v_owner_id
  from public."EstateProperties" ep
  where ep."Id" = p_property_id
    and ep."IsDeleted" = false;

  if v_owner_id is null then
    return;
  end if;

  select o."OwnerType", o."MemberId", o."CompanyId"
  into v_owner_type, v_member_id, v_company_id
  from public."Owners" o
  where o."Id" = v_owner_id
    and o."IsDeleted" = false;

  if v_owner_type = 'member' and v_member_id is not null then
    return query select 'member'::text, v_member_id;
    return;
  end if;

  if v_owner_type = 'company' and v_company_id is not null then
    return query select 'company'::text, v_company_id;
    return;
  end if;

  return;
end;
$$;

grant execute on function public.resolve_property_billing_subject(uuid) to authenticated;
grant execute on function public.resolve_property_billing_subject(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- flexible_usage_limit_check (subject-based)
-- -----------------------------------------------------------------------------
drop function if exists public.flexible_usage_limit_check(uuid, text, text);

create or replace function public.flexible_usage_limit_check(
  p_subject_type text,
  p_subject_id uuid,
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
  if p_subject_type is null or p_subject_type not in ('member', 'company') then
    return jsonb_build_object('allowed', false, 'reason', 'invalid subject type');
  end if;

  if p_usage_type is null or p_usage_type not in ('booking', 'listing') then
    return jsonb_build_object('allowed', false, 'reason', 'invalid usage type');
  end if;

  select
    apa.pricing_model,
    apa.listing_limit,
    apa.booking_limit,
    coalesce(apa.duration_days, 30)
  into v_model, v_listing_limit, v_booking_limit, v_duration_days
  from public.get_active_plan_assignment(p_subject_type, p_subject_id, now()) apa;

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
  where bc."SubjectType" = p_subject_type
    and bc."MemberOrCompanyId" = p_subject_id
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
    where ur."SubjectType" = p_subject_type
      and ur."MemberOrCompanyId" = p_subject_id
      and ur."Type" = 'listing'
      and ur."CreatedAt" >= v_win_start
      and ur."CreatedAt" < v_win_end;

    if p_reference_id is not null then
      select exists (
        select 1
        from public."UsageRecords" ur2
        where ur2."SubjectType" = p_subject_type
          and ur2."MemberOrCompanyId" = p_subject_id
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

  if v_booking_limit is null then
    return jsonb_build_object('allowed', true);
  end if;

  select count(*)::integer
  into v_cnt
  from public."UsageRecords" ur
  where ur."SubjectType" = p_subject_type
    and ur."MemberOrCompanyId" = p_subject_id
    and ur."Type" = 'booking'
    and ur."CreatedAt" >= v_win_start
    and ur."CreatedAt" < v_win_end;

  if p_reference_id is not null then
    select exists (
      select 1
      from public."UsageRecords" ur2
      where ur2."SubjectType" = p_subject_type
        and ur2."MemberOrCompanyId" = p_subject_id
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

grant execute on function public.flexible_usage_limit_check(text, uuid, text, text) to authenticated;
grant execute on function public.flexible_usage_limit_check(text, uuid, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- compute_billing_cycle_total
-- -----------------------------------------------------------------------------
drop function if exists public.compute_billing_cycle_total(uuid, uuid);

create or replace function public.compute_billing_cycle_total(
  p_subject_type text,
  p_subject_id uuid,
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
  v_listing_total numeric := 0;
  v_total numeric := 0;
begin
  select bc."StartDate", bc."EndDate"
  into v_cycle_start, v_cycle_end
  from public."BillingCycles" bc
  where bc."Id" = p_billing_cycle_id
    and bc."SubjectType" = p_subject_type
    and bc."MemberOrCompanyId" = p_subject_id
  limit 1;

  if v_cycle_start is null then
    raise exception 'Billing cycle % not found for subject %/%',
      p_billing_cycle_id, p_subject_type, p_subject_id;
  end if;

  select
    apa.pricing_model,
    coalesce(apa.price, 0),
    coalesce(apa.min_monthly_fee, 0),
    coalesce(apa.price_per_booking, 0),
    apa.listing_limit
  into
    v_pricing_model,
    v_price,
    v_min_monthly_fee,
    v_price_per_booking,
    v_listing_limit
  from public.get_active_plan_assignment(p_subject_type, p_subject_id, v_cycle_start) apa
  limit 1;

  if v_pricing_model is null then
    raise exception 'No active plan found for subject %/%', p_subject_type, p_subject_id;
  end if;

  select count(*)
  into v_booking_count
  from public."UsageRecords"
  where "SubjectType" = p_subject_type
    and "MemberOrCompanyId" = p_subject_id
    and "Type" = 'booking'
    and "CreatedAt" >= v_cycle_start
    and "CreatedAt" < v_cycle_end;

  select count(*), coalesce(sum(coalesce("Amount", 0)), 0)
  into v_listing_count, v_listing_total
  from public."UsageRecords"
  where "SubjectType" = p_subject_type
    and "MemberOrCompanyId" = p_subject_id
    and "Type" = 'listing'
    and "CreatedAt" >= v_cycle_start
    and "CreatedAt" < v_cycle_end;

  if v_pricing_model = 'per_booking' then
    v_total := v_booking_count * v_price_per_booking;
  elseif v_pricing_model = 'per_listing' then
    v_total := v_listing_total;
  elseif v_pricing_model = 'hybrid' then
    v_total := greatest(v_min_monthly_fee, v_booking_count * v_price_per_booking);
  else
    raise exception 'Unsupported pricing model: %', v_pricing_model;
  end if;

  if v_listing_limit is not null and v_listing_count > v_listing_limit then
    raise notice 'Listing limit exceeded for subject %/%: % > %',
      p_subject_type, p_subject_id, v_listing_count, v_listing_limit;
  end if;

  return v_total;
end;
$$;

-- -----------------------------------------------------------------------------
-- Invoice / cycle subject integrity trigger
-- -----------------------------------------------------------------------------
create or replace function public.trg_validate_invoice_billing_subject()
returns trigger
language plpgsql
as $$
declare
  v_cycle_subject_type text;
  v_cycle_subject_id uuid;
begin
  select bc."SubjectType", bc."MemberOrCompanyId"
  into v_cycle_subject_type, v_cycle_subject_id
  from public."BillingCycles" bc
  where bc."Id" = new."BillingCycleId";

  if v_cycle_subject_type is null then
    raise exception 'Billing cycle % not found', new."BillingCycleId";
  end if;

  if v_cycle_subject_type <> new."SubjectType"
     or v_cycle_subject_id <> new."MemberOrCompanyId" then
    raise exception 'Invoice subject %/% does not match billing cycle subject %/%',
      new."SubjectType", new."MemberOrCompanyId", v_cycle_subject_type, v_cycle_subject_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_invoice_member_cycle on public."Invoices";
drop trigger if exists trg_validate_invoice_billing_subject on public."Invoices";

create trigger trg_validate_invoice_billing_subject
before insert or update on public."Invoices"
for each row
execute function public.trg_validate_invoice_billing_subject();

-- -----------------------------------------------------------------------------
-- generate_invoice_for_cycle
-- -----------------------------------------------------------------------------
drop function if exists public.generate_invoice_for_cycle(uuid, uuid, text);

create or replace function public.generate_invoice_for_cycle(
  p_subject_type text,
  p_subject_id uuid,
  p_billing_cycle_id uuid,
  p_created_by text default 'system'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_invoice_id uuid;
  v_cycle_status text;
  v_cycle_start timestamptz;
  v_cycle_end timestamptz;
  v_total numeric;
  v_new_invoice_id uuid;
  v_due_date timestamptz := now() + interval '7 days';
begin
  select i."Id"
  into v_existing_invoice_id
  from public."Invoices" i
  where i."BillingCycleId" = p_billing_cycle_id
  limit 1;

  if v_existing_invoice_id is not null then
    return v_existing_invoice_id;
  end if;

  select "Status", "StartDate", "EndDate"
  into v_cycle_status, v_cycle_start, v_cycle_end
  from public."BillingCycles"
  where "Id" = p_billing_cycle_id
    and "SubjectType" = p_subject_type
    and "MemberOrCompanyId" = p_subject_id
  limit 1;

  if v_cycle_status is null then
    raise exception 'Billing cycle % not found for subject %/%',
      p_billing_cycle_id, p_subject_type, p_subject_id;
  end if;

  v_total := public.compute_billing_cycle_total(p_subject_type, p_subject_id, p_billing_cycle_id);

  update public."BillingCycles"
  set
    "TotalAmount" = v_total,
    "Status" = case when "Status" = 'open' then 'closed' else "Status" end,
    "UpdatedAt" = now(),
    "LastModifiedBy" = p_created_by
  where "Id" = p_billing_cycle_id
    and "SubjectType" = p_subject_type
    and "MemberOrCompanyId" = p_subject_id;

  insert into public."Invoices" (
    "SubjectType",
    "MemberOrCompanyId",
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
    p_subject_type,
    p_subject_id,
    p_billing_cycle_id,
    v_total,
    'pending',
    v_due_date,
    now(),
    now(),
    p_created_by,
    p_created_by
  )
  returning "Id" into v_new_invoice_id;

  update public."UsageRecords" ur
  set "InvoiceId" = v_new_invoice_id
  where ur."SubjectType" = p_subject_type
    and ur."MemberOrCompanyId" = p_subject_id
    and ur."InvoiceId" is null
    and ur."CreatedAt" >= v_cycle_start
    and ur."CreatedAt" < v_cycle_end;

  return v_new_invoice_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- cron_invoice_ready_cycles
-- -----------------------------------------------------------------------------
drop function if exists public.cron_invoice_ready_cycles();

create or replace function public.cron_invoice_ready_cycles()
returns table (
  billing_cycle_id uuid,
  subject_type text,
  member_or_company_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select bc."Id", bc."SubjectType", bc."MemberOrCompanyId"
  from public."BillingCycles" bc
  where bc."Status" = 'open'
    and bc."EndDate" <= now()
    and not exists (
      select 1
      from public."Invoices" i
      where i."BillingCycleId" = bc."Id"
    );
$$;

grant execute on function public.cron_invoice_ready_cycles() to authenticated;
grant execute on function public.cron_invoice_ready_cycles() to service_role;

-- -----------------------------------------------------------------------------
-- admin_generate_invoice_from_usage
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
  v_subject_count int := 0;
  v_subject_type text;
  v_subject_id uuid;
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
  v_cycle_start timestamptz;
  v_cycle_end timestamptz;
  v_out_of_cycle_count int := 0;
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

  select count(*),
         count(distinct (ur."SubjectType", ur."MemberOrCompanyId"))
  into v_usage_count, v_subject_count
  from public."UsageRecords" ur
  where ur."Id" = any(p_usage_record_ids)
    and ur."InvoiceId" is null;

  if v_usage_count = 0 then
    raise exception 'No unbilled usage records found';
  end if;

  if v_usage_count <> cardinality(p_usage_record_ids) then
    raise exception 'Some usage records are already billed or invalid';
  end if;

  if v_subject_count <> 1 then
    raise exception 'Selected usage records must belong to exactly one billing subject';
  end if;

  select distinct ur."SubjectType", ur."MemberOrCompanyId"
  into v_subject_type, v_subject_id
  from public."UsageRecords" ur
  where ur."Id" = any(p_usage_record_ids)
  limit 1;

  select
    apa.pricing_model,
    coalesce(apa.price_per_booking, 0),
    coalesce(apa.min_monthly_fee, 0),
    coalesce(apa.price, 0),
    coalesce(apa.duration_days, 30)
  into
    v_plan_pricing_model,
    v_price_per_booking,
    v_min_monthly_fee,
    v_price,
    v_duration_days
  from public.get_active_plan_assignment(v_subject_type, v_subject_id, now()) apa
  limit 1;

  if v_plan_pricing_model is null then
    raise exception 'Missing active plan for subject %/%', v_subject_type, v_subject_id;
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
  select bc."Id", bc."StartDate", bc."EndDate"
  into v_cycle_id, v_cycle_start, v_cycle_end
  from public."BillingCycles" bc
  where bc."SubjectType" = v_subject_type
    and bc."MemberOrCompanyId" = v_subject_id
    and bc."Status" = 'open'
    and bc."StartDate" <= now()
    and bc."EndDate" >= now()
  order by bc."StartDate" desc
  limit 1;

  if v_cycle_id is null then
    insert into public."BillingCycles" (
      "SubjectType",
      "MemberOrCompanyId",
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
      v_subject_type,
      v_subject_id,
      now(),
      now() + make_interval(days => v_duration_days),
      'open',
      0,
      now(),
      now(),
      v_current_user::text,
      v_current_user::text
    )
    returning "Id", "StartDate", "EndDate" into v_cycle_id, v_cycle_start, v_cycle_end;
  end if;

  select count(*)
  into v_out_of_cycle_count
  from public."UsageRecords" ur
  where ur."Id" = any(p_usage_record_ids)
    and (ur."CreatedAt" < v_cycle_start or ur."CreatedAt" >= v_cycle_end);

  if v_out_of_cycle_count > 0 then
    raise exception 'Selected usage records must belong to the target billing cycle window';
  end if;

  insert into public."Invoices" (
    "SubjectType",
    "MemberOrCompanyId",
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
    v_subject_type,
    v_subject_id,
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
-- admin_get_billable_usage
-- -----------------------------------------------------------------------------
create or replace function public.admin_get_billable_usage(
  p_user_search text default null,
  p_payment_status int default null,
  p_from_date date default null,
  p_to_date date default null,
  p_only_unbilled boolean default false
) returns table (
  id uuid,
  user_name text,
  user_email text,
  user_identifier text,
  property_name text,
  check_in_date date,
  check_out_date date,
  total_amount numeric,
  currency int,
  payment_status int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user uuid;
  v_is_admin boolean := false;
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

  return query
  with usage_booking as (
    select
      ur."Id" as usage_id,
      ur."SubjectType" as subject_type,
      ur."MemberOrCompanyId" as subject_id,
      ur."ReferenceId" as booking_id_text,
      ur."InvoiceId" as invoice_id,
      ur."CreatedAt" as usage_created_at
    from public."UsageRecords" ur
    where ur."Type" = 'booking'
  ),
  joined as (
    select
      ub.usage_id,
      ub.subject_type,
      ub.subject_id,
      ub.invoice_id,
      coalesce(i."Status", 'pending') as invoice_status,
      b."CheckInDate"::date as check_in_date,
      b."CheckOutDate"::date as check_out_date,
      coalesce(ur_amount."Amount", b."TotalAmount", 0) as total_amount,
      coalesce(b."Currency", 0) as currency,
      o."Id" as owner_id,
      m_bill."FirstName" as bill_member_first,
      m_bill."LastName" as bill_member_last,
      m_bill."Email" as bill_member_email,
      c_bill."Name" as bill_company_name,
      c_bill."BillingEmail" as bill_company_email,
      trim(concat_ws(' ', m_owner."FirstName", m_owner."LastName")) as member_name,
      m_owner."Email" as member_email,
      c_owner."Name" as company_name,
      c_owner."BillingEmail" as company_email,
      ep."StreetName",
      ep."HouseNumber"
    from usage_booking ub
    left join public."UsageRecords" ur_amount on ur_amount."Id" = ub.usage_id
    join public."Bookings" b
      on b."Id"::text = ub.booking_id_text
     and b."IsDeleted" = false
    join public."EstateProperties" ep
      on ep."Id" = b."EstatePropertyId"
     and ep."IsDeleted" = false
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    left join public."Members" m_owner
      on m_owner."Id" = o."MemberId"
     and m_owner."IsDeleted" = false
    left join public."Companies" c_owner
      on c_owner."Id" = o."CompanyId"
     and c_owner."IsDeleted" = false
    left join public."Members" m_bill
      on ub.subject_type = 'member'
     and m_bill."Id" = ub.subject_id
     and m_bill."IsDeleted" = false
    left join public."Companies" c_bill
      on ub.subject_type = 'company'
     and c_bill."Id" = ub.subject_id
     and c_bill."IsDeleted" = false
    left join public."Invoices" i on i."Id" = ub.invoice_id
  )
  select
    j.usage_id as id,
    coalesce(
      nullif(trim(concat_ws(' ', j.bill_member_first, j.bill_member_last)), ''),
      nullif(j.bill_company_name, ''),
      nullif(j.member_name, ''),
      nullif(j.company_name, ''),
      'Sin propietario'
    )::text as user_name,
    coalesce(
      nullif(j.bill_member_email, ''),
      nullif(j.bill_company_email, ''),
      nullif(j.member_email, ''),
      nullif(j.company_email, ''),
      ''
    )::text as user_email,
    j.subject_id::text as user_identifier,
    trim(concat_ws(' ', j."StreetName", j."HouseNumber"))::text as property_name,
    j.check_in_date,
    j.check_out_date,
    coalesce(j.total_amount, 0)::numeric as total_amount,
    coalesce(j.currency, 0)::int as currency,
    case
      when j.invoice_id is null then 0
      when j.invoice_status = 'paid' then 1
      else 0
    end::int as payment_status
  from joined j
  where (
      p_user_search is null
      or trim(p_user_search) = ''
      or coalesce(j.member_name, '') ilike ('%' || p_user_search || '%')
      or coalesce(j.member_email, '') ilike ('%' || p_user_search || '%')
      or coalesce(j.company_name, '') ilike ('%' || p_user_search || '%')
      or coalesce(j.company_email, '') ilike ('%' || p_user_search || '%')
      or coalesce(j.bill_company_name, '') ilike ('%' || p_user_search || '%')
      or j.subject_id::text = p_user_search
      or j.owner_id::text = p_user_search
    )
    and (
      p_payment_status is null
      or (p_payment_status = 1 and j.invoice_id is not null and j.invoice_status = 'paid')
      or (p_payment_status = 0 and (j.invoice_id is null or j.invoice_status <> 'paid'))
    )
    and (p_from_date is null or j.check_in_date >= p_from_date)
    and (p_to_date is null or j.check_out_date <= p_to_date)
    and (not p_only_unbilled or j.invoice_id is null)
  order by j.check_in_date desc nulls last
  limit 500;
end;
$$;

-- -----------------------------------------------------------------------------
-- admin_get_invoices
-- -----------------------------------------------------------------------------
create or replace function public.admin_get_invoices(
  p_owner_name text default null,
  p_owner_email text default null,
  p_due_date_from date default null,
  p_due_date_to date default null,
  p_status int default null
) returns table (
  id uuid,
  user_name text,
  user_email text,
  amount numeric,
  currency text,
  item_count int,
  created timestamptz,
  due_date timestamptz,
  status int,
  paid_at timestamptz,
  items jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user uuid;
  v_is_admin boolean := false;
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

  return query
  with invoice_base as (
    select
      i."Id" as id,
      i."SubjectType" as subject_type,
      i."MemberOrCompanyId" as subject_id,
      i."Total" as amount,
      i."Status" as status_text,
      i."CreatedAt" as created,
      coalesce(i."DueDate", i."CreatedAt" + interval '7 days') as due_date,
      i."PaidAt" as paid_at
    from public."Invoices" i
    where (p_status is null
      or (p_status = 1 and i."Status" = 'paid')
      or (p_status = 0 and i."Status" <> 'paid'))
      and (p_due_date_from is null or coalesce(i."DueDate", i."CreatedAt" + interval '7 days')::date >= p_due_date_from)
      and (p_due_date_to is null or coalesce(i."DueDate", i."CreatedAt" + interval '7 days')::date <= p_due_date_to)
  ),
  invoice_owner as (
    select
      ib.id,
      coalesce(
        nullif(trim(concat_ws(' ', m."FirstName", m."LastName")), ''),
        nullif(c."Name", ''),
        'Sin propietario'
      ) as user_name,
      coalesce(nullif(m."Email", ''), nullif(c."BillingEmail", ''), '') as user_email
    from invoice_base ib
    left join public."Members" m
      on ib.subject_type = 'member'
     and m."Id" = ib.subject_id
     and m."IsDeleted" = false
    left join public."Companies" c
      on ib.subject_type = 'company'
     and c."Id" = ib.subject_id
     and c."IsDeleted" = false
  ),
  filtered as (
    select ib.*
    from invoice_base ib
    left join invoice_owner io on io.id = ib.id
    where (p_owner_name is null or coalesce(io.user_name, '') ilike ('%' || p_owner_name || '%'))
      and (p_owner_email is null or coalesce(io.user_email, '') ilike ('%' || p_owner_email || '%'))
  )
  select
    f.id,
    coalesce(io.user_name, 'Sin propietario')::text as user_name,
    coalesce(io.user_email, '')::text as user_email,
    coalesce(f.amount, 0)::numeric as amount,
    'USD'::text as currency,
    (
      select count(*)
      from public."UsageRecords" ur
      where ur."InvoiceId" = f.id
    )::int as item_count,
    f.created,
    f.due_date,
    case when f.status_text = 'paid' then 1 else 0 end::int as status,
    f.paid_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ur."Id",
          'bookingId', case when ur."Type" = 'booking' then ur."ReferenceId" else null end,
          'amount', coalesce(ur."Amount", 0),
          'bookingCheckInDate', b."CheckInDate",
          'bookingCheckOutDate', b."CheckOutDate"
        )
        order by ur."CreatedAt" asc
      )
      from public."UsageRecords" ur
      left join public."Bookings" b
        on b."Id"::text = ur."ReferenceId"
       and ur."Type" = 'booking'
      where ur."InvoiceId" = f.id
    ), '[]'::jsonb) as items
  from filtered f
  left join invoice_owner io on io.id = f.id
  order by f.due_date desc nulls last
  limit 500;
end;
$$;

-- -----------------------------------------------------------------------------
-- admin_set_invoice_status (cycle sync uses subject columns)
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_invoice_status(
  p_invoice_id uuid,
  p_is_paid boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user uuid;
  v_is_admin boolean := false;
  v_cycle_id uuid;
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

  update public."Invoices"
  set
    "Status" = case when p_is_paid then 'paid' else 'pending' end,
    "PaidAt" = case when p_is_paid then now() else null end,
    "UpdatedAt" = now(),
    "LastModifiedBy" = v_current_user::text
  where "Id" = p_invoice_id
  returning "BillingCycleId" into v_cycle_id;

  if v_cycle_id is null then
    raise exception 'Invoice % not found', p_invoice_id;
  end if;

  update public."BillingCycles"
  set
    "Status" = case when p_is_paid then 'paid' else 'closed' end,
    "UpdatedAt" = now(),
    "LastModifiedBy" = v_current_user::text
  where "Id" = v_cycle_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Drop legacy diagnostic RPCs
-- -----------------------------------------------------------------------------
drop function if exists public.billing_unmapped_histories();
drop function if exists public.billing_unmapped_subscriptions();

-- -----------------------------------------------------------------------------
-- get_admin_users_list (member plan from BillingPlanAssignments)
-- -----------------------------------------------------------------------------
drop function if exists public.get_admin_users_list(integer, integer, text, integer, text, date, date, text);

create or replace function public.get_admin_users_list(
  p_page integer default 1,
  p_limit integer default 20,
  p_subscription_status text default null,
  p_subscription_tier integer default null,
  p_account_status text default null,
  p_registration_date_from date default null,
  p_registration_date_to date default null,
  p_search text default null
)
returns table (
  id uuid,
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  avatar_url text,
  role text,
  subscription_status text,
  subscription_tier integer,
  subscription_expires_at timestamptz,
  account_status text,
  registration_date timestamptz,
  last_login timestamptz,
  properties_count bigint,
  payment_status text,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
  v_offset int;
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_lim int := greatest(least(coalesce(p_limit, 20), 200), 1);
begin
  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Forbidden: admin only';
  end if;

  v_offset := (v_page - 1) * v_lim;

  return query
  with base as (
    select
      m."Id" as member_id,
      m."UserId" as uid,
      m."FirstName" as fn,
      m."LastName" as ln,
      m."Email" as em,
      m."AvatarUrl" as av,
      m."Role" as rrole,
      m."Created" as reg,
      m."IsDeleted" as is_del,
      u.last_sign_in_at as llogin,
      u.banned_until as banned_until,
      (
        select count(*)::bigint
        from public."EstateProperties" ep
        join public."Owners" o
          on o."Id" = ep."OwnerId"
         and o."IsDeleted" = false
         and o."OwnerType" = 'member'
         and o."MemberId" = m."Id"
        where ep."IsDeleted" = false
      ) as pcnt,
      (
        select bpa."EndDate"
        from public."BillingPlanAssignments" bpa
        where bpa."SubjectType" = 'member'
          and bpa."MemberOrCompanyId" = m."Id"
        order by bpa."StartDate" desc
        limit 1
      ) as latest_mp_end,
      (
        select bpa."IsActive"
        from public."BillingPlanAssignments" bpa
        where bpa."SubjectType" = 'member'
          and bpa."MemberOrCompanyId" = m."Id"
        order by bpa."StartDate" desc
        limit 1
      ) as latest_mp_active,
      (
        select p."Key"
        from public."BillingPlanAssignments" bpa
        join public."Plans" p on p."Id" = bpa."PlanId"
        where bpa."SubjectType" = 'member'
          and bpa."MemberOrCompanyId" = m."Id"
        order by bpa."StartDate" desc
        limit 1
      ) as plan_key,
      (
        select i."Status"
        from public."Invoices" i
        where i."SubjectType" = 'member'
          and i."MemberOrCompanyId" = m."Id"
        order by i."CreatedAt" desc nulls last
        limit 1
      ) as inv_status
    from public."Members" m
    join auth.users u on u.id = m."UserId"
  ),
  computed as (
    select
      b.*,
      case
        when coalesce(b.plan_key::text, '') in ('free', '0') then 0
        when coalesce(b.plan_key::text, '') in ('manager', '1') then 1
        when coalesce(b.plan_key::text, '') = 'company_small' then 2
        when coalesce(b.plan_key::text, '') = 'company_unlimited' then 3
        when coalesce(b.plan_key::text, '') in ('manager_pro', '2') then 4
        else 5
      end as plan_tier_code,
      case
        when not exists (
          select 1
          from public."BillingPlanAssignments" bpa
          where bpa."SubjectType" = 'member'
            and bpa."MemberOrCompanyId" = b.member_id
        ) then 'none'::text
        when b.latest_mp_active = true
          and (b.latest_mp_end is null or b.latest_mp_end >= timezone('utc', now())) then 'active'::text
        else 'expired'::text
      end as sub_stat,
      case
        when b.is_del then 'deleted'::text
        when b.banned_until is not null and b.banned_until > timezone('utc', now()) then 'suspended'::text
        else 'active'::text
      end as acct_stat,
      case
        when b.inv_status = 'paid' then 'paid'::text
        when b.inv_status = 'pending' then 'pending'::text
        when b.inv_status is null then 'none'::text
        else 'unknown'::text
      end as pay_stat
    from base b
  ),
  filtered as (
    select *
    from computed c
    where
      (p_search is null
        or trim(p_search) = ''
        or coalesce(c.fn, '') ilike ('%' || p_search || '%')
        or coalesce(c.ln, '') ilike ('%' || p_search || '%')
        or coalesce(c.em, '') ilike ('%' || p_search || '%')
        or c.member_id::text = p_search
        or c.uid::text = p_search)
      and (p_subscription_status is null or c.sub_stat = p_subscription_status)
      and (p_subscription_tier is null or c.plan_tier_code = p_subscription_tier)
      and (p_account_status is null or c.acct_stat = p_account_status)
      and (p_registration_date_from is null or c.reg::date >= p_registration_date_from)
      and (p_registration_date_to is null or c.reg::date <= p_registration_date_to)
  ),
  counted as (
    select count(*)::bigint as cnt from filtered
  )
  select
    f.member_id as id,
    f.uid as user_id,
    f.fn as first_name,
    f.ln as last_name,
    f.em as email,
    f.av as avatar_url,
    f.rrole as role,
    f.sub_stat as subscription_status,
    f.plan_tier_code as subscription_tier,
    f.latest_mp_end as subscription_expires_at,
    f.acct_stat as account_status,
    f.reg as registration_date,
    f.llogin as last_login,
    f.pcnt as properties_count,
    f.pay_stat as payment_status,
    (select cnt from counted) as total_count
  from filtered f
  order by f.reg desc nulls last
  offset v_offset
  limit v_lim;
end;
$$;

commit;
