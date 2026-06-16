-- Extend admin_get_billable_usage: booking + listing operations, operation_type, target_id.
-- Apply manually after 20260522120000.

begin;

drop function if exists public.admin_get_billable_usage(text, int, date, date, boolean);

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
  payment_status int,
  operation_type text,
  target_id text
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
      ur."ReferenceId" as target_id,
      ur."InvoiceId" as invoice_id,
      ur."CreatedAt" as usage_created_at
    from public."UsageRecords" ur
    where ur."Type" = 'booking'
  ),
  joined_booking as (
    select
      ub.usage_id,
      ub.subject_type,
      ub.subject_id,
      ub.target_id,
      ub.invoice_id,
      ub.usage_created_at,
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
      ep."HouseNumber",
      'booking'::text as operation_type
    from usage_booking ub
    left join public."UsageRecords" ur_amount on ur_amount."Id" = ub.usage_id
    join public."Bookings" b
      on b."Id"::text = ub.target_id
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
  ),
  usage_listing as (
    select
      ur."Id" as usage_id,
      ur."SubjectType" as subject_type,
      ur."MemberOrCompanyId" as subject_id,
      ur."ReferenceId" as target_id,
      ur."InvoiceId" as invoice_id,
      ur."CreatedAt" as usage_created_at
    from public."UsageRecords" ur
    where ur."Type" = 'listing'
  ),
  joined_listing as (
    select
      ul.usage_id,
      ul.subject_type,
      ul.subject_id,
      ul.target_id,
      ul.invoice_id,
      ul.usage_created_at,
      coalesce(i."Status", 'pending') as invoice_status,
      null::date as check_in_date,
      null::date as check_out_date,
      coalesce(ur_amount."Amount", 0) as total_amount,
      coalesce(l."Currency", 0) as currency,
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
      ep."HouseNumber",
      'listing'::text as operation_type
    from usage_listing ul
    left join public."UsageRecords" ur_amount on ur_amount."Id" = ul.usage_id
    join public."Listings" l
      on l."Id"::text = ul.target_id
     and l."IsDeleted" = false
    join public."EstateProperties" ep
      on ep."Id" = l."EstatePropertyId"
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
      on ul.subject_type = 'member'
     and m_bill."Id" = ul.subject_id
     and m_bill."IsDeleted" = false
    left join public."Companies" c_bill
      on ul.subject_type = 'company'
     and c_bill."Id" = ul.subject_id
     and c_bill."IsDeleted" = false
    left join public."Invoices" i on i."Id" = ul.invoice_id
  ),
  combined as (
    select * from joined_booking
    union all
    select * from joined_listing
  )
  select
    c.usage_id as id,
    coalesce(
      nullif(trim(concat_ws(' ', c.bill_member_first, c.bill_member_last)), ''),
      nullif(c.bill_company_name, ''),
      nullif(c.member_name, ''),
      nullif(c.company_name, ''),
      'Sin propietario'
    )::text as user_name,
    coalesce(
      nullif(c.bill_member_email, ''),
      nullif(c.bill_company_email, ''),
      nullif(c.member_email, ''),
      nullif(c.company_email, ''),
      ''
    )::text as user_email,
    c.subject_id::text as user_identifier,
    trim(concat_ws(' ', c."StreetName", c."HouseNumber"))::text as property_name,
    c.check_in_date,
    c.check_out_date,
    coalesce(c.total_amount, 0)::numeric as total_amount,
    coalesce(c.currency, 0)::int as currency,
    case
      when c.invoice_id is null then 0
      when c.invoice_status = 'paid' then 1
      else 0
    end::int as payment_status,
    c.operation_type,
    c.target_id
  from combined c
  where (
      p_user_search is null
      or trim(p_user_search) = ''
      or coalesce(c.member_name, '') ilike ('%' || p_user_search || '%')
      or coalesce(c.member_email, '') ilike ('%' || p_user_search || '%')
      or coalesce(c.company_name, '') ilike ('%' || p_user_search || '%')
      or coalesce(c.company_email, '') ilike ('%' || p_user_search || '%')
      or coalesce(c.bill_company_name, '') ilike ('%' || p_user_search || '%')
      or c.subject_id::text = p_user_search
      or c.owner_id::text = p_user_search
    )
    and (
      p_payment_status is null
      or (p_payment_status = 1 and c.invoice_id is not null and c.invoice_status = 'paid')
      or (p_payment_status = 0 and (c.invoice_id is null or c.invoice_status <> 'paid'))
    )
    and (
      p_from_date is null
      or (
        c.operation_type = 'booking'
        and c.check_in_date >= p_from_date
      )
      or (
        c.operation_type = 'listing'
        and c.usage_created_at::date >= p_from_date
      )
    )
    and (
      p_to_date is null
      or (
        c.operation_type = 'booking'
        and c.check_out_date <= p_to_date
      )
      or (
        c.operation_type = 'listing'
        and c.usage_created_at::date <= p_to_date
      )
    )
    and (not p_only_unbilled or c.invoice_id is null)
  order by coalesce(c.check_in_date, c.usage_created_at::date) desc nulls last
  limit 500;
end;
$$;

comment on function public.admin_get_billable_usage(text, int, date, date, boolean) is
  'Admin: billable usage rows (booking + listing) for invoice generation UI.';

commit;
