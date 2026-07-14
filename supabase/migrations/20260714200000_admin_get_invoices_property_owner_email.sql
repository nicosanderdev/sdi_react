-- Align admin_get_invoices display/search with admin_get_billable_usage:
-- resolve owner name/email from billing subject first, then property owner
-- via invoice → UsageRecords → booking/listing → EstateProperties → Owners.

CREATE OR REPLACE FUNCTION public.admin_get_invoices(
  p_owner_name text DEFAULT NULL::text,
  p_owner_email text DEFAULT NULL::text,
  p_due_date_from date DEFAULT NULL::date,
  p_due_date_to date DEFAULT NULL::date,
  p_status integer DEFAULT NULL::integer
)
RETURNS TABLE(
  id uuid,
  user_name text,
  user_email text,
  amount numeric,
  currency text,
  item_count integer,
  created timestamp with time zone,
  due_date timestamp with time zone,
  status integer,
  paid_at timestamp with time zone,
  items jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  invoice_property_owner as (
    select distinct on (ur."InvoiceId")
      ur."InvoiceId" as invoice_id,
      trim(concat_ws(' ', m_owner."FirstName", m_owner."LastName")) as member_name,
      m_owner."Email" as member_email,
      c_owner."Name" as company_name,
      c_owner."BillingEmail" as company_email
    from public."UsageRecords" ur
    join invoice_base ib on ib.id = ur."InvoiceId"
    left join public."Bookings" b
      on ur."Type" = 'booking'
     and b."Id"::text = ur."ReferenceId"
     and b."IsDeleted" = false
    left join public."Listings" l
      on ur."Type" = 'listing'
     and l."Id"::text = ur."ReferenceId"
     and l."IsDeleted" = false
    left join public."EstateProperties" ep
      on ep."Id" = coalesce(b."EstatePropertyId", l."EstatePropertyId")
     and ep."IsDeleted" = false
    left join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    left join public."Members" m_owner
      on m_owner."Id" = o."MemberId"
     and m_owner."IsDeleted" = false
    left join public."Companies" c_owner
      on c_owner."Id" = o."CompanyId"
     and c_owner."IsDeleted" = false
    where ur."InvoiceId" is not null
    order by
      ur."InvoiceId",
      ur."CreatedAt" asc
  ),
  invoice_owner as (
    select
      ib.id,
      coalesce(
        nullif(trim(concat_ws(' ', m_bill."FirstName", m_bill."LastName")), ''),
        nullif(c_bill."Name", ''),
        nullif(ipo.member_name, ''),
        nullif(ipo.company_name, ''),
        'Sin propietario'
      ) as user_name,
      coalesce(
        nullif(m_bill."Email", ''),
        nullif(c_bill."BillingEmail", ''),
        nullif(ipo.member_email, ''),
        nullif(ipo.company_email, ''),
        ''
      ) as user_email,
      nullif(trim(concat_ws(' ', m_bill."FirstName", m_bill."LastName")), '') as bill_member_name,
      nullif(m_bill."Email", '') as bill_member_email,
      nullif(c_bill."Name", '') as bill_company_name,
      nullif(c_bill."BillingEmail", '') as bill_company_email,
      nullif(ipo.member_name, '') as property_member_name,
      nullif(ipo.member_email, '') as property_member_email,
      nullif(ipo.company_name, '') as property_company_name,
      nullif(ipo.company_email, '') as property_company_email
    from invoice_base ib
    left join public."Members" m_bill
      on ib.subject_type = 'member'
     and m_bill."Id" = ib.subject_id
     and m_bill."IsDeleted" = false
    left join public."Companies" c_bill
      on ib.subject_type = 'company'
     and c_bill."Id" = ib.subject_id
     and c_bill."IsDeleted" = false
    left join invoice_property_owner ipo on ipo.invoice_id = ib.id
  ),
  filtered as (
    select ib.*
    from invoice_base ib
    left join invoice_owner io on io.id = ib.id
    where (
      p_owner_name is null
      or coalesce(io.bill_member_name, '') ilike ('%' || p_owner_name || '%')
      or coalesce(io.bill_company_name, '') ilike ('%' || p_owner_name || '%')
      or coalesce(io.property_member_name, '') ilike ('%' || p_owner_name || '%')
      or coalesce(io.property_company_name, '') ilike ('%' || p_owner_name || '%')
      or coalesce(io.user_name, '') ilike ('%' || p_owner_name || '%')
    )
      and (
        p_owner_email is null
        or coalesce(io.bill_member_email, '') ilike ('%' || p_owner_email || '%')
        or coalesce(io.bill_company_email, '') ilike ('%' || p_owner_email || '%')
        or coalesce(io.property_member_email, '') ilike ('%' || p_owner_email || '%')
        or coalesce(io.property_company_email, '') ilike ('%' || p_owner_email || '%')
        or coalesce(io.user_email, '') ilike ('%' || p_owner_email || '%')
      )
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

COMMENT ON FUNCTION public.admin_get_invoices(text, text, date, date, integer) IS
  'Admin: list invoices with billing-subject then property-owner name/email for display and filters.';
