-- Align manual invoice billing cycle with selected usage CreatedAt bounds.
-- Admin cycle writes use this SECURITY DEFINER RPC (not client RLS on BillingCycles).
-- Apply manually after 20260521131000.

begin;

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
  v_usage_min timestamptz;
  v_usage_max timestamptz;
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

  select min(ur."CreatedAt"), max(ur."CreatedAt")
  into v_usage_min, v_usage_max
  from public."UsageRecords" ur
  where ur."Id" = any(p_usage_record_ids);

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

  -- Prefer an open cycle that fully contains all selected usage timestamps.
  select bc."Id", bc."StartDate", bc."EndDate"
  into v_cycle_id, v_cycle_start, v_cycle_end
  from public."BillingCycles" bc
  where bc."SubjectType" = v_subject_type
    and bc."MemberOrCompanyId" = v_subject_id
    and bc."Status" = 'open'
    and bc."StartDate" <= v_usage_min
    and bc."EndDate" > v_usage_max
  order by bc."StartDate" desc
  limit 1;

  if v_cycle_id is null then
    -- Close orphan open cycles that do not cover this usage selection (cron hygiene).
    update public."BillingCycles"
    set
      "Status" = 'closed',
      "UpdatedAt" = now(),
      "LastModifiedBy" = v_current_user::text
    where "SubjectType" = v_subject_type
      and "MemberOrCompanyId" = v_subject_id
      and "Status" = 'open'
      and not ("StartDate" <= v_usage_min and "EndDate" > v_usage_max);

    v_cycle_start := v_usage_min;
    v_cycle_end := greatest(
      v_usage_min + make_interval(days => v_duration_days),
      v_usage_max + interval '1 microsecond'
    );

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
      v_cycle_start,
      v_cycle_end,
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

comment on function public.admin_generate_invoice_from_usage(uuid[]) is
  'Admin manual invoice: resolves or creates a billing cycle aligned to selected usage CreatedAt; SECURITY DEFINER bypasses BillingCycles RLS.';

grant execute on function public.admin_generate_invoice_from_usage(uuid[]) to authenticated;
grant execute on function public.admin_generate_invoice_from_usage(uuid[]) to service_role;

commit;
