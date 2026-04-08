begin;

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
    and (not p_only_unbilled or j.invoice_id is null)
  order by j.check_in_date desc nulls last
  limit 500;
end;
$$;

commit;
