-- Fix billing integrity issues:
-- 1) Align cycle total math with admin invoice generation for booking usage.
-- 2) Enforce Invoices.MemberId matches BillingCycles.MemberId.
-- 3) Keep BillingCycles.Status synchronized when admin toggles invoice paid/unpaid.
-- 4) Ensure manually selected usage belongs to the selected/open billing cycle.

begin;

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
  v_listing_total numeric := 0;
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

  select count(*)
  into v_booking_count
  from public."UsageRecords"
  where "MemberId" = p_member_id
    and "Type" = 'booking'
    and "CreatedAt" >= v_cycle_start
    and "CreatedAt" < v_cycle_end;

  select count(*), coalesce(sum(coalesce("Amount", 0)), 0)
  into v_listing_count, v_listing_total
  from public."UsageRecords"
  where "MemberId" = p_member_id
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
    raise notice 'Listing limit exceeded for member %: % > %', p_member_id, v_listing_count, v_listing_limit;
  end if;

  return v_total;
end;
$$;

create or replace function public.trg_validate_invoice_member_cycle()
returns trigger
language plpgsql
as $$
declare
  v_cycle_member_id uuid;
begin
  select bc."MemberId"
  into v_cycle_member_id
  from public."BillingCycles" bc
  where bc."Id" = new."BillingCycleId";

  if v_cycle_member_id is null then
    raise exception 'Billing cycle % not found', new."BillingCycleId";
  end if;

  if v_cycle_member_id <> new."MemberId" then
    raise exception 'Invoice member % does not match billing cycle member %', new."MemberId", v_cycle_member_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_invoice_member_cycle on public."Invoices";
create trigger trg_validate_invoice_member_cycle
before insert or update on public."Invoices"
for each row
execute function public.trg_validate_invoice_member_cycle();

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
  select bc."Id", bc."StartDate", bc."EndDate"
  into v_cycle_id, v_cycle_start, v_cycle_end
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

  select i."BillingCycleId"
  into v_cycle_id
  from public."Invoices" i
  where i."Id" = p_invoice_id;

  if v_cycle_id is null then
    raise exception 'Invoice not found';
  end if;

  update public."Invoices"
  set
    "Status" = case when p_is_paid then 'paid' else 'pending' end,
    "PaidAt" = case when p_is_paid then now() else null end,
    "UpdatedAt" = now(),
    "LastModifiedBy" = v_current_user::text
  where "Id" = p_invoice_id;

  update public."BillingCycles"
  set
    "Status" = case when p_is_paid then 'paid' else 'closed' end,
    "UpdatedAt" = now(),
    "LastModifiedBy" = v_current_user::text
  where "Id" = v_cycle_id;
end;
$$;

commit;
