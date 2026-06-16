-- Flexible billing admin invoice RPCs + UsageRecords invoice linkage
-- NOTE: Manual execution by project owner.

begin;

-- ---------------------------------------------------------------------------
-- UsageRecords compatibility for flexible invoice linkage
-- ---------------------------------------------------------------------------
alter table if exists public."UsageRecords"
  alter column "ReferenceId" type text using "ReferenceId"::text;

alter table if exists public."UsageRecords"
  alter column "Amount" drop not null;

alter table if exists public."UsageRecords"
  add column if not exists "InvoiceId" uuid null references public."Invoices"("Id");

create index if not exists "IX_UsageRecords_Member_Invoice_CreatedAt"
  on public."UsageRecords" ("MemberId", "InvoiceId", "CreatedAt");

create index if not exists "IX_UsageRecords_InvoiceId"
  on public."UsageRecords" ("InvoiceId");

-- ---------------------------------------------------------------------------
-- Invoices optional due date / paid timestamp for admin flow parity
-- ---------------------------------------------------------------------------
alter table if exists public."Invoices"
  add column if not exists "DueDate" timestamptz null;

alter table if exists public."Invoices"
  add column if not exists "PaidAt" timestamptz null;

-- ---------------------------------------------------------------------------
-- Admin RPC: list billable usage (backward compatible shape for bookings table)
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_billable_usage(
  p_user_search text default null,
  p_payment_status int default null,
  p_from_date date default null,
  p_to_date date default null
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
      ur."MemberId" as member_id,
      ur."ReferenceId" as booking_id_text,
      ur."InvoiceId" as invoice_id,
      ur."CreatedAt" as usage_created_at
    from public."UsageRecords" ur
    where ur."Type" = 'booking'
  ),
  joined as (
    select
      ub.usage_id,
      ub.member_id,
      ub.invoice_id,
      coalesce(i."Status", 'pending') as invoice_status,
      b."Id" as booking_id,
      b."CheckInDate"::date as check_in_date,
      b."CheckOutDate"::date as check_out_date,
      coalesce(ur_amount."Amount", b."TotalAmount", 0) as total_amount,
      coalesce(b."Currency", 0) as currency,
      o."Id" as owner_id,
      o."OwnerType" as owner_type,
      m_owner."Id" as owner_member_id,
      c_owner."Id" as owner_company_id,
      trim(concat_ws(' ', m_owner."FirstName", m_owner."LastName")) as member_name,
      m_owner."Email" as member_email,
      c_owner."Name" as company_name,
      c_owner."BillingEmail" as company_email,
      ep."StreetName",
      ep."HouseNumber"
    from usage_booking ub
    left join public."UsageRecords" ur_amount
      on ur_amount."Id" = ub.usage_id
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
    left join public."Invoices" i
      on i."Id" = ub.invoice_id
  )
  select
    j.usage_id as id,
    coalesce(
      nullif(j.member_name, ''),
      nullif(j.company_name, ''),
      'Sin propietario'
    )::text as user_name,
    coalesce(
      nullif(j.member_email, ''),
      nullif(j.company_email, ''),
      ''
    )::text as user_email,
    coalesce(j.owner_member_id::text, j.owner_company_id::text, j.owner_id::text, '') as user_identifier,
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
      or j.owner_id::text = p_user_search
      or j.owner_member_id::text = p_user_search
      or j.owner_company_id::text = p_user_search
    )
    and (
      p_payment_status is null
      or (p_payment_status = 1 and j.invoice_id is not null and j.invoice_status = 'paid')
      or (p_payment_status = 0 and (j.invoice_id is null or j.invoice_status <> 'paid'))
    )
    and (p_from_date is null or j.check_in_date >= p_from_date)
    and (p_to_date is null or j.check_out_date <= p_to_date)
  order by j.check_in_date desc nulls last
  limit 500;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPC: generate invoice from selected usage rows
-- ---------------------------------------------------------------------------
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

  if v_plan_pricing_model = 'free' then
    v_total := 0;
  elseif v_plan_pricing_model = 'per_booking' then
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

-- ---------------------------------------------------------------------------
-- Admin RPC: list invoices with item details (usage rows)
-- ---------------------------------------------------------------------------
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
      i."MemberId" as member_id,
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
      trim(concat_ws(' ', m."FirstName", m."LastName")) as user_name,
      m."Email" as user_email
    from invoice_base ib
    left join public."Members" m
      on m."Id" = ib.member_id
     and m."IsDeleted" = false
  ),
  filtered as (
    select ib.*
    from invoice_base ib
    left join invoice_owner io
      on io.id = ib.id
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
  left join invoice_owner io
    on io.id = f.id
  order by f.created desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPC: mark invoice paid / unpaid
-- ---------------------------------------------------------------------------
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

  if not exists (
    select 1
    from public."Invoices" i
    where i."Id" = p_invoice_id
  ) then
    raise exception 'Invoice not found';
  end if;

  update public."Invoices"
  set
    "Status" = case when p_is_paid then 'paid' else 'pending' end,
    "PaidAt" = case when p_is_paid then now() else null end,
    "UpdatedAt" = now(),
    "LastModifiedBy" = v_current_user::text
  where "Id" = p_invoice_id;
end;
$$;

commit;
