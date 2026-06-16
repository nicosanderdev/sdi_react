-- Baseline migration squashed from tasks/public_schema.sql (public schema pg_dump).
-- Appendix: auth.users trigger + storage buckets/RLS from archived migrations.
--
-- PostgreSQL database dump (adapted for Supabase migrations)
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


--
-- Name: AppParameterType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AppParameterType" AS ENUM (
    'number',
    'boolean',
    'string',
    'json',
    'date',
    'date_range'
);


--
-- Name: ListingType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ListingType" AS ENUM (
    'SummerRent',
    'EventVenue',
    'AnnualRent',
    'RealEstate'
);


--
-- Name: LocationCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LocationCategory" AS ENUM (
    'rural',
    'city',
    'near_shore'
);


--
-- Name: OwnerType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OwnerType" AS ENUM (
    'member',
    'company'
);


--
-- Name: PropertyCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PropertyCategory" AS ENUM (
    'Casa',
    'Apartamento',
    'Terreno',
    'Chacra',
    'Campo'
);


--
-- Name: PropertyType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PropertyType" AS ENUM (
    'SummerRent',
    'EventVenue',
    'RealEstate'
);


--
-- Name: PropertyTypeOld; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PropertyTypeOld" AS ENUM (
    'SummerRent',
    'EventVenue',
    'AnnualRent',
    'RealEstate'
);


--
-- Name: RentPricePeriod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RentPricePeriod" AS ENUM (
    'PerNight',
    'PerMonth'
);


--
-- Name: ViewType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ViewType" AS ENUM (
    'city',
    'mountain',
    'rural',
    'sea'
);


--
-- Name: company_roles; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.company_roles AS ENUM (
    'admin',
    'manager',
    'member'
);


--
-- Name: plan_keys; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.plan_keys AS ENUM (
    'free',
    'manager',
    'manager_pro',
    'company_small',
    'company_unlimited'
);


--
-- Name: acknowledge_force_logout(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acknowledge_force_logout() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_member_id uuid;
begin
  select "Id" into v_member_id
  from public."Members"
  where "UserId" = auth.uid()
    and "IsDeleted" = false
  limit 1;

  if v_member_id is null then
    return jsonb_build_object('success', false, 'message', 'Member not found');
  end if;

  update public."ForceLogoutRequests"
  set "AcknowledgedAt" = timezone('utc', now())
  where "MemberId" = v_member_id
    and "AcknowledgedAt" is null;

  return jsonb_build_object('success', true, 'message', 'Force logout acknowledged');
end;
$$;


--
-- Name: admin_add_company_member_by_email(uuid, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_add_company_member_by_email(p_company_id uuid, p_email text, p_added_by uuid, p_role text DEFAULT 'Member'::text) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_member_id uuid;
begin
  select m."Id"
  into v_member_id
  from public."Members" m
  where lower(m."Email") = lower(trim(p_email))
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    return query select false, 'No existe un usuario con ese correo.';
    return;
  end if;

  if exists (
    select 1
    from public."CompanyMembers" cm
    where cm."CompanyId" = p_company_id
      and cm."MemberId" = v_member_id
      and cm."IsDeleted" = false
  ) then
    return query select false, 'El usuario ya est├í vinculado a esta compa├▒├¡a.';
    return;
  end if;

  insert into public."CompanyMembers" (
    "MemberId",
    "CompanyId",
    "Role",
    "AddedBy",
    "JoinedAt",
    "IsDeleted"
  )
  values (
    v_member_id,
    p_company_id,
    p_role,
    p_added_by,
    now(),
    false
  );

  return query select true, 'Usuario agregado correctamente.';
end;
$$;


--
-- Name: admin_companies_list(text, text, timestamp with time zone, timestamp with time zone, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_companies_list(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_created_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_created_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_page integer DEFAULT 1, p_limit integer DEFAULT 10) RETURNS TABLE(id uuid, name character varying, billing_email character varying, created_at timestamp with time zone, is_deleted boolean, members_count bigint)
    LANGUAGE sql SECURITY DEFINER
    AS $$
  with filtered as (
    select c.*
    from public."Companies" c
    where
      (p_search is null or c."Name" ilike '%' || p_search || '%' or c."BillingEmail" ilike '%' || p_search || '%')
      and (
        p_status is null
        or (p_status = 'active' and c."IsDeleted" = false)
        or (p_status = 'deleted' and c."IsDeleted" = true)
      )
      and (p_created_from is null or c."CreatedAt" >= p_created_from)
      and (p_created_to is null or c."CreatedAt" <= p_created_to)
  )
  select
    c."Id" as id,
    c."Name" as name,
    c."BillingEmail" as billing_email,
    c."CreatedAt" as created_at,
    c."IsDeleted" as is_deleted,
    coalesce(cm_count.cnt, 0)::bigint as members_count
  from filtered c
  left join lateral (
    select count(*) as cnt
    from public."CompanyMembers" cm
    where cm."CompanyId" = c."Id" and cm."IsDeleted" = false
  ) cm_count on true
  order by c."CreatedAt" desc
  offset greatest((p_page - 1) * p_limit, 0)
  limit greatest(p_limit, 1);
$$;


--
-- Name: admin_companies_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_companies_metrics() RETURNS TABLE(total_companies bigint, active_companies bigint, companies_created_this_month bigint)
    LANGUAGE sql SECURITY DEFINER
    AS $$
  select
    (select count(*) from public."Companies") as total_companies,
    (select count(*) from public."Companies" c where c."IsDeleted" = false) as active_companies,
    (
      select count(*)
      from public."Companies" c
      where c."CreatedAt" >= date_trunc('month', now())
    ) as companies_created_this_month;
$$;


--
-- Name: admin_company_detail(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_company_detail(p_company_id uuid) RETURNS TABLE(company_id uuid, company_name character varying, company_billing_email character varying, company_description character varying, company_created_at timestamp with time zone, member_row_id uuid, member_id uuid, member_name text, member_email character varying, member_role text, member_joined_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    AS $$
  select
    c."Id" as company_id,
    c."Name" as company_name,
    c."BillingEmail" as company_billing_email,
    c."Description" as company_description,
    c."CreatedAt" as company_created_at,
    cm."Id" as member_row_id,
    m."Id" as member_id,
    trim(coalesce(m."FirstName", '') || ' ' || coalesce(m."LastName", '')) as member_name,
    m."Email" as member_email,
    cm."Role" as member_role,
    cm."JoinedAt" as member_joined_at
  from public."Companies" c
  left join public."CompanyMembers" cm
    on cm."CompanyId" = c."Id"
    and cm."IsDeleted" = false
  left join public."Members" m
    on m."Id" = cm."MemberId"
    and m."IsDeleted" = false
  where c."Id" = p_company_id;
$$;


--
-- Name: admin_delete_property(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_property(p_property_id uuid, p_reason text) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_current_user_id uuid;
BEGIN
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'User not authenticated';
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "EstateProperties" WHERE "Id" = p_property_id AND "IsDeleted" = false) THEN
        RETURN QUERY SELECT false, 'Property not found or already deleted';
        RETURN;
    END IF;

    INSERT INTO "PropertyModerationActions" (
        "PropertyId",
        "ActionType",
        "Reason",
        "PerformedBy",
        "PerformedAt"
    ) VALUES (
        p_property_id,
        'delete',
        p_reason,
        v_current_user_id,
        now()
    );

    UPDATE "Listings"
    SET
        "IsDeleted" = true,
        "LastModified" = now(),
        "LastModifiedBy" = v_current_user_id::text
    WHERE "EstatePropertyId" = p_property_id;

    DELETE FROM "EstateProperties" WHERE "Id" = p_property_id;

    RETURN QUERY SELECT true, 'Property permanently deleted';
END;
$$;


--
-- Name: admin_generate_invoice_from_usage(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_generate_invoice_from_usage(p_usage_record_ids uuid[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: FUNCTION admin_generate_invoice_from_usage(p_usage_record_ids uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.admin_generate_invoice_from_usage(p_usage_record_ids uuid[]) IS 'Admin manual invoice: resolves or creates a billing cycle aligned to selected usage CreatedAt; SECURITY DEFINER bypasses BillingCycles RLS.';


--
-- Name: admin_get_billable_usage(text, integer, date, date, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_billable_usage(p_user_search text DEFAULT NULL::text, p_payment_status integer DEFAULT NULL::integer, p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date, p_only_unbilled boolean DEFAULT false) RETURNS TABLE(id uuid, user_name text, user_email text, user_identifier text, property_name text, check_in_date date, check_out_date date, total_amount numeric, currency integer, payment_status integer, operation_type text, target_id text)
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: FUNCTION admin_get_billable_usage(p_user_search text, p_payment_status integer, p_from_date date, p_to_date date, p_only_unbilled boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.admin_get_billable_usage(p_user_search text, p_payment_status integer, p_from_date date, p_to_date date, p_only_unbilled boolean) IS 'Admin: billable usage rows (booking + listing) for invoice generation UI.';


--
-- Name: admin_get_invoices(text, text, date, date, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_invoices(p_owner_name text DEFAULT NULL::text, p_owner_email text DEFAULT NULL::text, p_due_date_from date DEFAULT NULL::date, p_due_date_to date DEFAULT NULL::date, p_status integer DEFAULT NULL::integer) RETURNS TABLE(id uuid, user_name text, user_email text, amount numeric, currency text, item_count integer, created timestamp with time zone, due_date timestamp with time zone, status integer, paid_at timestamp with time zone, items jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: admin_hide_property(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_hide_property(p_property_id uuid, p_reason text DEFAULT NULL::text) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_current_user_id uuid;
    v_updated integer;
BEGIN
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'User not authenticated';
        RETURN;
    END IF;

    UPDATE "Listings"
    SET
        "IsPropertyVisible" = false,
        "LastModified" = now(),
        "LastModifiedBy" = v_current_user_id::text
    WHERE "EstatePropertyId" = p_property_id AND "IsDeleted" = false;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
        RETURN QUERY SELECT false, 'Property not found or already hidden';
        RETURN;
    END IF;

    INSERT INTO "PropertyModerationActions" (
        "PropertyId",
        "ActionType",
        "Reason",
        "PerformedBy",
        "PerformedAt"
    ) VALUES (
        p_property_id,
        'hide',
        p_reason,
        v_current_user_id,
        now()
    );

    RETURN QUERY SELECT true, 'Property hidden successfully';
END;
$$;


--
-- Name: admin_mark_property_invalid(uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_mark_property_invalid(p_property_id uuid, p_reason text, p_mark_as_spam boolean DEFAULT false) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_current_user_id uuid;
    v_action_type text;
    v_updated integer;
BEGIN
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'User not authenticated';
        RETURN;
    END IF;

    v_action_type := CASE WHEN p_mark_as_spam THEN 'mark_spam' ELSE 'mark_invalid' END;

    UPDATE "Listings"
    SET
        "Status" = 4,
        "IsPropertyVisible" = false,
        "IsActive" = false,
        "LastModified" = now(),
        "LastModifiedBy" = v_current_user_id::text
    WHERE "EstatePropertyId" = p_property_id AND "IsDeleted" = false;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
        RETURN QUERY SELECT false, 'Property not found';
        RETURN;
    END IF;

    INSERT INTO "PropertyModerationActions" (
        "PropertyId",
        "ActionType",
        "Reason",
        "PerformedBy",
        "PerformedAt"
    ) VALUES (
        p_property_id,
        v_action_type,
        p_reason,
        v_current_user_id,
        now()
    );

    RETURN QUERY SELECT true, CASE WHEN p_mark_as_spam THEN 'Property marked as spam' ELSE 'Property marked as invalid' END;
END;
$$;


--
-- Name: admin_set_invoice_status(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_invoice_status(p_invoice_id uuid, p_is_paid boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: admin_update_company(uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_company(p_company_id uuid, p_name text, p_billing_email text, p_description text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_last_modified_by text DEFAULT NULL::text) RETURNS TABLE(id uuid, name character varying, billing_email character varying, description character varying, phone character varying)
    LANGUAGE sql SECURITY DEFINER
    AS $$
  update public."Companies" c
  set
    "Name" = p_name,
    "BillingEmail" = p_billing_email,
    "Description" = p_description,
    "Phone" = p_phone,
    "LastModified" = now(),
    "LastModifiedBy" = p_last_modified_by
  where c."Id" = p_company_id
  returning
    c."Id",
    c."Name",
    c."BillingEmail",
    c."Description",
    c."Phone";
$$;


--
-- Name: admin_update_member_contact(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_member_contact(p_member_id uuid, p_first_name text, p_last_name text, p_email text, p_phone text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_admin_member_id uuid;
  v_email_taken boolean;
  v_phone_taken boolean;
  v_phone_norm text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'message', 'Forbidden');
  END IF;

  p_email := trim(coalesce(p_email, ''));
  v_phone_norm := nullif(trim(coalesce(p_phone, '')), '');

  IF p_email = '' THEN
    RETURN json_build_object('success', false, 'message', 'Email is required');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public."Members" m
    WHERE m."IsDeleted" = false
      AND m."Id" <> p_member_id
      AND lower(trim(coalesce(m."Email", ''))) = lower(p_email)
  ) INTO v_email_taken;

  IF v_email_taken THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Email already in use',
      'field_errors', json_build_object('email', 'This email is already used by another member')
    );
  END IF;

  IF v_phone_norm IS NOT NULL AND v_phone_norm <> '' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public."Members" m
      WHERE m."IsDeleted" = false
        AND m."Id" <> p_member_id
        AND trim(coalesce(m."Phone", '')) <> ''
        AND trim(m."Phone") = v_phone_norm
    ) INTO v_phone_taken;

    IF v_phone_taken THEN
      RETURN json_build_object(
        'success', false,
        'message', 'Phone already in use',
        'field_errors', json_build_object('phone', 'This phone number is already used by another member')
      );
    END IF;
  END IF;

  SELECT m."Id"
  INTO v_admin_member_id
  FROM public."Members" m
  WHERE m."UserId" = auth.uid()
    AND m."IsDeleted" = false
  LIMIT 1;

  UPDATE public."Members"
  SET
    "FirstName" = nullif(trim(coalesce(p_first_name, '')), ''),
    "LastName" = nullif(trim(coalesce(p_last_name, '')), ''),
    "Email" = p_email,
    "Phone" = v_phone_norm,
    "LastModified" = now(),
    "LastModifiedBy" = coalesce(v_admin_member_id::text, 'admin_update_member_contact')
  WHERE "Id" = p_member_id
    AND "IsDeleted" = false;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Member not found');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Updated');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;


--
-- Name: booking_matches_guest_site_listing_type(public."ListingType", uuid, timestamp with time zone, timestamp with time zone, public."ListingType"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.booking_matches_guest_site_listing_type(p_booking_listing_type public."ListingType", p_property_id uuid, p_check_in timestamp with time zone, p_check_out timestamp with time zone, p_requested_listing_type public."ListingType") RETURNS boolean
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
begin
  if p_requested_listing_type is null then
    return false;
  end if;

  if p_booking_listing_type is not null then
    return p_booking_listing_type = p_requested_listing_type;
  end if;

  if to_regclass('public.booking_holds') is null then
    return false;
  end if;

  return exists (
    select 1
    from public.booking_holds bh
    where bh.property_id = p_property_id
      and bh.check_in = p_check_in
      and bh.check_out = p_check_out
      and bh.status = 'confirmed'
      and trim(coalesce(bh.listing_type, '')) = p_requested_listing_type::text
  );
end;
$$;


--
-- Name: build_property_amenities_json(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.build_property_amenities_json(p_estate_property_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    jsonb_agg(
      case
        when public.sanitize_amenity_localized_descriptions(epa."LocalizedDescriptions") = '{}'::jsonb then
          jsonb_build_object(
            'id', a."Id",
            'name', a."Name",
            'iconId', a."IconId"
          )
        else
          jsonb_build_object(
            'id', a."Id",
            'name', a."Name",
            'iconId', a."IconId",
            'descriptions', public.sanitize_amenity_localized_descriptions(epa."LocalizedDescriptions")
          )
      end
      order by a."Name"
    ),
    '[]'::jsonb
  )
  from public."EstatePropertyAmenity" epa
  join public."Amenities" a
    on a."Id" = epa."AmenityId"
   and a."IsDeleted" = false
  where epa."EstatePropertyId" = p_estate_property_id
    and coalesce(epa."DeletedAtUtc", 'infinity'::timestamptz) > now();
$$;


--
-- Name: FUNCTION build_property_amenities_json(p_estate_property_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.build_property_amenities_json(p_estate_property_id uuid) IS 'Use in get_public_summer_rent_property_by_id and get_public_event_venue_property_by_id as amenities payload.';


--
-- Name: build_property_content_sections_json(uuid, public."PropertyType"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.build_property_content_sections_json(p_estate_property_id uuid, p_property_type public."PropertyType") RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'propertyType', s.propertytype,
        'localizedName', public.sanitize_localized_text_json(s.localizedname),
        'localizedDescription', public.sanitize_localized_text_json(s.localizeddescription),
        'layoutType', s.layouttype,
        'layoutConfig', coalesce(s.layoutconfig, '{}'::jsonb),
        'displayOrder', s.displayorder,
        'images', coalesce(img.images, '[]'::jsonb)
      )
      order by s.displayorder, s.createdat
    ),
    '[]'::jsonb
  )
  from public.propertydetailssection s
  left join lateral (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'propertyImageId', psi.propertyimageid,
          'url', pi."Url",
          'altText', pi."AltText",
          'displayOrder', psi.displayorder
        )
        order by psi.displayorder
      ),
      '[]'::jsonb
    ) as images
    from public.propertysectionimages psi
    join public."PropertyImages" pi
      on pi."Id" = psi.propertyimageid
     and pi."IsDeleted" = false
    where psi.sectionid = s.id
  ) img on true
  where s.propertyid = p_estate_property_id
    and s.isdeleted = false
    and (s.propertytype is null or s.propertytype = p_property_type)
    and public.sanitize_localized_text_json(s.localizedname) <> '{}'::jsonb;
$$;


--
-- Name: FUNCTION build_property_content_sections_json(p_estate_property_id uuid, p_property_type public."PropertyType"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.build_property_content_sections_json(p_estate_property_id uuid, p_property_type public."PropertyType") IS 'Content sections array for public property detail RPCs, filtered by PropertyType.';


--
-- Name: build_property_policies_json(uuid, public."ListingType"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.build_property_policies_json(p_estate_property_id uuid, p_listing_type public."ListingType") RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', epp."Id",
        'listingType', epp."ListingType",
        'title', public.sanitize_localized_text_json(epp."LocalizedTitle"),
        'description', public.sanitize_localized_text_json(epp."LocalizedDescription"),
        'displayOrder', epp."DisplayOrder"
      )
      order by epp."DisplayOrder", epp."Created"
    ),
    '[]'::jsonb
  )
  from public."EstatePropertyPolicy" epp
  where epp."EstatePropertyId" = p_estate_property_id
    and epp."ListingType" = p_listing_type
    and epp."IsDeleted" = false
    and (
      public.sanitize_localized_text_json(epp."LocalizedTitle") <> '{}'::jsonb
      or public.sanitize_localized_text_json(epp."LocalizedDescription") <> '{}'::jsonb
    );
$$;


--
-- Name: FUNCTION build_property_policies_json(p_estate_property_id uuid, p_listing_type public."ListingType"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.build_property_policies_json(p_estate_property_id uuid, p_listing_type public."ListingType") IS 'Policies array for public property detail RPCs, filtered by ListingType.';


--
-- Name: calculate_conversion_stat(bigint, bigint, bigint, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_conversion_stat(current_messages bigint, current_visits bigint, previous_messages bigint, previous_visits bigint) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_current_rate DECIMAL(10,2);
    v_previous_rate DECIMAL(10,2);
    v_percentage_change DECIMAL(10,2);
    v_change_direction TEXT := 'neutral';
BEGIN
    -- Calculate rates
    v_current_rate := CASE WHEN current_visits > 0 THEN (current_messages::DECIMAL / current_visits::DECIMAL) * 100 ELSE 0 END;
    v_previous_rate := CASE WHEN previous_visits > 0 THEN (previous_messages::DECIMAL / previous_visits::DECIMAL) * 100 ELSE 0 END;

    -- Calculate percentage change
    IF v_previous_rate > 0 THEN
        v_percentage_change := ((v_current_rate - v_previous_rate) / v_previous_rate) * 100;
    ELSIF v_current_rate > 0 THEN
        v_percentage_change := 100;
    ELSE
        v_percentage_change := 0;
    END IF;

    IF v_percentage_change > 0.5 THEN
        v_change_direction := 'increase';
    ELSIF v_percentage_change < -0.5 THEN
        v_change_direction := 'decrease';
    END IF;

    RETURN jsonb_build_object(
        'currentPeriod', ROUND(v_current_rate)::BIGINT,
        'percentageChange', v_percentage_change,
        'changeDirection', v_change_direction
    );
END;
$$;


--
-- Name: calculate_stat(bigint, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_stat(current_val bigint, previous_val bigint) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_percentage_change DECIMAL(10,2);
    v_change_direction TEXT := 'neutral';
BEGIN
    IF previous_val > 0 THEN
        v_percentage_change := ((current_val::DECIMAL - previous_val::DECIMAL) / previous_val::DECIMAL) * 100;
    ELSIF current_val > 0 THEN
        v_percentage_change := 100; -- Infinite increase from 0
    ELSE
        v_percentage_change := 0;
    END IF;

    IF v_percentage_change > 0.5 THEN
        v_change_direction := 'increase';
    ELSIF v_percentage_change < -0.5 THEN
        v_change_direction := 'decrease';
    END IF;

    RETURN jsonb_build_object(
        'currentPeriod', current_val,
        'percentageChange', v_percentage_change,
        'changeDirection', v_change_direction
    );
END;
$$;


--
-- Name: cancel_booking_by_manage_token(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_booking_by_manage_token(p_token text, p_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_token_hash text;
  v_booking_id uuid;
  v_booking record;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('success', false, 'error', 'Missing token');
  end if;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  select t.booking_id
  into v_booking_id
  from public.booking_manage_tokens t
  where t.token_hash = v_token_hash
    and t.revoked_at is null
    and t.expires_at > now()
  limit 1;

  if v_booking_id is null then
    return jsonb_build_object('success', false, 'error', 'Invalid or expired token');
  end if;

  select
    b."Id",
    b."Status",
    b."CheckInDate",
    b."IsDeleted"
  into v_booking
  from public."Bookings" b
  where b."Id" = v_booking_id
  for update;

  if not found or v_booking."IsDeleted" then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if v_booking."Status" not in (0, 1) then
    return jsonb_build_object('success', false, 'error', 'Reservation cannot be cancelled');
  end if;

  if v_booking."CheckInDate" < current_date then
    return jsonb_build_object('success', false, 'error', 'Reservation expired');
  end if;

  update public."Bookings"
  set
    "Status" = 2,
    "LastModified" = now()
  where "Id" = v_booking_id;

  update public.booking_manage_tokens
  set revoked_at = now()
  where token_hash = v_token_hash;

  return jsonb_build_object('success', true, 'status', 'cancelled');
end;
$$;


--
-- Name: cancel_reservation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_reservation(reservation_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_booking record;
begin
  if reservation_id is null then
    return jsonb_build_object('success', false, 'error', 'Missing reservation id');
  end if;

  select
    b."Id",
    b."Status",
    b."CheckInDate",
    b."IsDeleted"
  into v_booking
  from public."Bookings" b
  where b."Id" = reservation_id
  for update;

  if not found or v_booking."IsDeleted" then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if v_booking."Status" not in (0, 1) then
    return jsonb_build_object('success', false, 'error', 'Reservation cannot be cancelled');
  end if;

  if v_booking."CheckInDate" < current_date then
    return jsonb_build_object('success', false, 'error', 'Reservation expired');
  end if;

  update public."Bookings"
  set
    "Status" = 2,
    "LastModified" = now()
  where "Id" = reservation_id;

  return jsonb_build_object('success', true, 'status', 'cancelled');
end;
$$;


--
-- Name: check_and_increment_otp_rate_limit(text, text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_and_increment_otp_rate_limit(p_phone text, p_ip text DEFAULT NULL::text, p_phone_max_hits integer DEFAULT 3, p_ip_max_hits integer DEFAULT 20, p_window_minutes integer DEFAULT 10) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := date_trunc('minute', v_now) - ((extract(minute from v_now)::integer % p_window_minutes) * interval '1 minute');
  v_phone_hits integer;
  v_ip_hits integer;
begin
  insert into public.otp_rate_limits (scope, key, window_start, hits)
  values ('phone', p_phone, v_window_start, 1)
  on conflict (scope, key, window_start)
  do update set
    hits = public.otp_rate_limits.hits + 1,
    updated_at = now()
  returning hits into v_phone_hits;

  if v_phone_hits > p_phone_max_hits then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'phone_rate_limited',
      'phone_hits', v_phone_hits
    );
  end if;

  if p_ip is not null and length(trim(p_ip)) > 0 then
    insert into public.otp_rate_limits (scope, key, window_start, hits)
    values ('ip', p_ip, v_window_start, 1)
    on conflict (scope, key, window_start)
    do update set
      hits = public.otp_rate_limits.hits + 1,
      updated_at = now()
    returning hits into v_ip_hits;

    if v_ip_hits > p_ip_max_hits then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'ip_rate_limited',
        'ip_hits', v_ip_hits
      );
    end if;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'phone_hits', v_phone_hits,
    'ip_hits', coalesce(v_ip_hits, 0)
  );
end;
$$;


--
-- Name: check_force_logout(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_force_logout(p_user_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_user_id uuid;
    v_force_logout boolean := false;
BEGIN
    -- Get user ID from current session if not provided
    IF p_user_id IS NULL THEN
        v_user_id := auth.uid();
    ELSE
        v_user_id := p_user_id;
    END IF;

    -- Check if user has force logout flag
    SELECT "ForceLogout" INTO v_force_logout
    FROM "MemberForceLogout"
    WHERE "MemberId" = (
        SELECT "Id" FROM "Members" WHERE "UserId" = v_user_id AND "IsDeleted" = false
    )
    AND "ForceLogout" = true
    AND "IsDeleted" = false
    ORDER BY "RequestedAt" DESC
    LIMIT 1;

    RETURN COALESCE(v_force_logout, false);
END;
$$;


--
-- Name: cleanup_expired_webhooks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_webhooks() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Mark integrations as inactive if tokens are expired (simplified logic)
    -- In practice, this would be more sophisticated
    UPDATE "CalendarIntegrations"
    SET "IsActive" = false,
        "LastModified" = now()
    WHERE "TokenExpiresAt" < now()
        AND "IsActive" = true;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: cleanup_old_sync_jobs(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_sync_jobs(days_old integer DEFAULT 30) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM "SyncJobs"
    WHERE "Created" < (now() - (days_old || ' days')::interval)
        AND "Status" IN (2, 3); -- completed or failed

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: compute_billing_cycle_total(text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_billing_cycle_total(p_subject_type text, p_subject_id uuid, p_billing_cycle_id uuid) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: compute_guest_review_window(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_guest_review_window(p_check_out timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  v_check_out_date date;
  v_window_start timestamptz;
  v_window_end timestamptz;
begin
  v_check_out_date := (p_check_out at time zone 'UTC')::date;
  v_window_start := v_check_out_date::timestamptz;
  v_window_end := v_window_start + interval '2 days 23 hours 59 minutes 59.999 seconds';

  return jsonb_build_object(
    'windowStart', v_window_start,
    'windowEnd', v_window_end
  );
end;
$$;


--
-- Name: FUNCTION compute_guest_review_window(p_check_out timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.compute_guest_review_window(p_check_out timestamp with time zone) IS 'Guest review window: checkout day 00:00 UTC through end of checkout day + 48 hours (inclusive).';


--
-- Name: compute_property_search_scores(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_property_search_scores(p_estate_property_id uuid, p_listing_type text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_listing_type text;
  v_site_scope text;
  v_params jsonb;
  v_listing record;
  v_quality_weights jsonb;
  v_image_rules jsonb;
  v_desc_rules jsonb;
  v_eng_weights jsonb;
  v_eng_norm jsonb;
  v_rep_weights jsonb;
  v_rep_norm jsonb;
  v_score_weights jsonb;
  v_lookback_days int;
  v_half_life numeric;
  v_new_listing_days int;
  v_exploration_max numeric;
  v_image_count int;
  v_public_count int;
  v_has_main boolean;
  v_distinct_urls int;
  v_image_score numeric := 0;
  v_desc_len int;
  v_desc_text text;
  v_word_count int;
  v_unique_words int;
  v_repeat_ratio numeric;
  v_desc_score numeric := 0;
  v_quality_score numeric := 0;
  v_views bigint := 0;
  v_messages bigint := 0;
  v_bookings bigint := 0;
  v_holds bigint := 0;
  v_engagement_score numeric := 0;
  v_avg_rating numeric;
  v_review_count int := 0;
  v_global_avg_rating numeric := 4.0;
  v_rating_score numeric := 0;
  v_review_count_score numeric := 0;
  v_owner_tenure_days numeric := 0;
  v_owner_tenure_score numeric := 0;
  v_completed_bookings int := 0;
  v_cancelled_bookings int := 0;
  v_completion_ratio numeric := 0;
  v_completion_score numeric := 0;
  v_completed_score numeric := 0;
  v_reputation_score numeric := 0;
  v_freshness_score numeric := 0;
  v_exploration_boost numeric := 0;
  v_listing_age_days numeric;
  v_offline_base numeric := 0;
  v_scores jsonb;
  v_metrics jsonb;
  v_since timestamptz;
begin
  if p_estate_property_id is null then
    raise exception 'estate_property_id is required';
  end if;

  v_listing_type := public.validate_guest_site_listing_type(p_listing_type)::text;
  if v_listing_type not in ('SummerRent', 'EventVenue') then
    raise exception 'Listing type % not supported for search scoring', v_listing_type;
  end if;

  v_site_scope := v_listing_type;
  v_params := public.get_app_parameters(v_site_scope);

  select
    l."Id",
    l."Title",
    l."Description",
    l."Created",
    l."LastModified",
    ep."OwnerId",
    ep."Created" as ep_created
  into v_listing
  from public."Listings" l
  join public."EstateProperties" ep on ep."Id" = l."EstatePropertyId"
  where l."EstatePropertyId" = p_estate_property_id
    and l."ListingType"::text = v_listing_type
    and l."IsDeleted" = false
    and l."IsActive" = true
    and l."IsPropertyVisible" = true
    and ep."IsDeleted" = false
  order by l."IsFeatured" desc nulls last, l."Created" desc
  limit 1;

  if v_listing."Id" is null then
    delete from public."PropertySearchScores"
    where "EstatePropertyId" = p_estate_property_id
      and "ListingType" = v_listing_type;
    return jsonb_build_object('skipped', true, 'reason', 'no_active_listing');
  end if;

  v_quality_weights := public.search_param_json(v_params, 'SEARCH_QUALITY_WEIGHTS', '{"image": 0.55, "description": 0.45}'::jsonb);
  v_image_rules := public.search_param_json(v_params, 'SEARCH_IMAGE_RULES');
  v_desc_rules := public.search_param_json(v_params, 'SEARCH_DESCRIPTION_RULES');
  v_eng_weights := public.search_param_json(v_params, 'SEARCH_ENGAGEMENT_WEIGHTS');
  v_eng_norm := public.search_param_json(v_params, 'SEARCH_ENGAGEMENT_NORMALIZE');
  v_rep_weights := public.search_param_json(v_params, 'SEARCH_REPUTATION_WEIGHTS');
  v_rep_norm := public.search_param_json(v_params, 'SEARCH_REPUTATION_NORMALIZE');
  v_score_weights := public.search_param_json(v_params, 'SEARCH_SCORE_WEIGHTS');
  v_lookback_days := coalesce(public.search_param_num(v_params, 'SEARCH_ENGAGEMENT_LOOKBACK_DAYS', 90)::int, 90);
  v_half_life := public.search_param_num(v_params, 'SEARCH_FRESHNESS_HALF_LIFE_DAYS', 90);
  v_new_listing_days := coalesce(public.search_param_num(v_params, 'SEARCH_EXPLORATION_NEW_LISTING_DAYS', 30)::int, 30);
  v_exploration_max := public.search_param_num(v_params, 'SEARCH_EXPLORATION_BOOST_MAX', 15);
  v_since := now() - make_interval(days => v_lookback_days);

  -- Images (PropertyImages has no IsPublic on this schema; all active images count as public)
  select
    count(*)::int,
    count(*)::int,
    bool_or(pi."IsMain" = true),
    count(distinct lower(trim(pi."Url")))
  into v_image_count, v_public_count, v_has_main, v_distinct_urls
  from public."PropertyImages" pi
  where pi."EstatePropertyId" = p_estate_property_id
    and pi."IsDeleted" = false;

  v_image_score := least(100, greatest(0,
    (v_image_count::numeric / nullif(public.search_param_num(v_image_rules, 'idealCount', 12), 0)) * 70
    + case when v_has_main or not coalesce((v_image_rules ->> 'requireMain')::boolean, true) then 15 else 0 end
    + case
        when v_image_count > 0 then
          (v_public_count::numeric / v_image_count)
          * 15
          * case when (v_public_count::numeric / v_image_count) >= public.search_param_num(v_image_rules, 'minPublicRatio', 0.8) then 1 else 0.5 end
        else 0
      end
    - case when v_image_count > 0 and v_distinct_urls < v_image_count then 10 else 0 end
  ));

  if v_image_count < public.search_param_num(v_image_rules, 'minCount', 3)::int then
    v_image_score := v_image_score * 0.6;
  end if;

  -- Description
  v_desc_text := coalesce(trim(v_listing."Description"), '');
  v_desc_len := length(v_desc_text);

  select
    coalesce(array_length(regexp_split_to_array(lower(v_desc_text), '\s+'), 1), 0),
    coalesce((
      select count(distinct w)
      from unnest(regexp_split_to_array(lower(v_desc_text), '\s+')) as w
      where length(w) > 1
    ), 0)
  into v_word_count, v_unique_words;

  v_repeat_ratio := case
    when v_word_count <= 0 then 1
    else 1 - (v_unique_words::numeric / v_word_count)
  end;

  v_desc_score := least(100, greatest(0,
    (v_desc_len::numeric / nullif(public.search_param_num(v_desc_rules, 'idealLength', 600), 0)) * 100
  ));

  if v_desc_len < public.search_param_num(v_desc_rules, 'minLength', 120) then
    v_desc_score := v_desc_score * 0.5;
  end if;

  if v_repeat_ratio > public.search_param_num(v_desc_rules, 'maxRepeatRatio', 0.35) then
    v_desc_score := v_desc_score * (1 - least(0.5, v_repeat_ratio - 0.35));
  end if;

  v_quality_score := round(
    v_image_score * public.search_param_num(v_quality_weights, 'image', 0.55)
    + v_desc_score * public.search_param_num(v_quality_weights, 'description', 0.45),
    2
  );

  -- Engagement
  if to_regclass('public."PropertyVisitLogs"') is not null then
    select count(*) into v_views
    from public."PropertyVisitLogs" pvl
    where pvl."PropertyId" = p_estate_property_id
      and pvl."VisitedOnUtc" >= v_since;
  end if;

  if to_regclass('public."PropertyMessageLogs"') is not null then
    select count(*) into v_messages
    from public."PropertyMessageLogs" pml
    where pml."PropertyId" = p_estate_property_id
      and pml."SentOnUtc" >= v_since;
  end if;

  select count(*) into v_bookings
  from public."Bookings" b
  where b."EstatePropertyId" = p_estate_property_id
    and b."IsDeleted" = false
    and b."Status" <> 2
    and b."Created" >= v_since
    and (
      b."ListingType" is null
      or b."ListingType"::text = v_listing_type
    );

  if to_regclass('public.booking_holds') is not null then
    select count(*) into v_holds
    from public.booking_holds h
    where h.property_id = p_estate_property_id
      and h.check_in >= (current_date - v_lookback_days)
      and (h.listing_type is null or h.listing_type = v_listing_type);
  end if;

  v_engagement_score := round(
    public.search_normalize_log(v_views, public.search_param_num(v_eng_norm, 'views', 500))
      * public.search_param_num(v_eng_weights, 'views', 0.35)
    + public.search_normalize_log(v_messages, public.search_param_num(v_eng_norm, 'messages', 50))
      * public.search_param_num(v_eng_weights, 'messages', 0.25)
    + public.search_normalize_log(v_bookings, public.search_param_num(v_eng_norm, 'bookings', 30))
      * public.search_param_num(v_eng_weights, 'bookings', 0.30)
    + public.search_normalize_log(v_holds, public.search_param_num(v_eng_norm, 'holds', 40))
      * public.search_param_num(v_eng_weights, 'holds', 0.10),
    2
  );

  -- Reputation
  select
    avg(r."Rating")::numeric,
    count(*)::int
  into v_avg_rating, v_review_count
  from public."Reviews" r
  where r."EstatePropertyId" = p_estate_property_id
    and r."ListingType"::text = v_listing_type;

  select coalesce(avg(r."Rating"), 4.0) into v_global_avg_rating
  from public."Reviews" r
  where r."ListingType"::text = v_listing_type;

  v_rating_score := case
    when v_review_count = 0 then v_global_avg_rating * 20
    else ((v_review_count * v_avg_rating + 5 * v_global_avg_rating) / (v_review_count + 5)) * 20
  end;

  v_review_count_score := public.search_normalize_log(
    v_review_count,
    public.search_param_num(v_rep_norm, 'reviewCount', 25)
  );

  select coalesce(
    extract(day from (now() - coalesce(v_listing.ep_created, v_listing."Created"))),
    0
  )
  into v_owner_tenure_days;

  v_owner_tenure_score := public.search_normalize_log(
    v_owner_tenure_days::bigint,
    public.search_param_num(v_rep_norm, 'ownerTenureDays', 1825)
  );

  select
    count(*) filter (where b."Status" = 3),
    count(*) filter (where b."Status" = 2)
  into v_completed_bookings, v_cancelled_bookings
  from public."Bookings" b
  where b."EstatePropertyId" = p_estate_property_id
    and b."IsDeleted" = false
    and b."Created" >= v_since
    and (b."ListingType" is null or b."ListingType"::text = v_listing_type);

  v_completion_ratio := case
    when (v_completed_bookings + v_cancelled_bookings) = 0 then 0.5
    else v_completed_bookings::numeric / (v_completed_bookings + v_cancelled_bookings)
  end;

  v_completion_score := v_completion_ratio * 100;
  v_completed_score := public.search_normalize_log(
    v_completed_bookings,
    public.search_param_num(v_rep_norm, 'completedBookings', 50)
  );

  v_reputation_score := round(
    v_rating_score * public.search_param_num(v_rep_weights, 'avgRating', 0.40)
    + v_review_count_score * public.search_param_num(v_rep_weights, 'reviewCount', 0.15)
    + v_owner_tenure_score * public.search_param_num(v_rep_weights, 'ownerTenure', 0.15)
    + v_completed_score * public.search_param_num(v_rep_weights, 'completedBookings', 0.15)
    + v_completion_score * public.search_param_num(v_rep_weights, 'bookingCompletionRatio', 0.15),
    2
  );

  -- Freshness + exploration
  v_listing_age_days := greatest(0, extract(day from (now() - coalesce(v_listing."LastModified", v_listing."Created"))));

  v_freshness_score := round(
    100 * power(0.5, v_listing_age_days / nullif(v_half_life, 1)),
    2
  );

  if v_listing_age_days <= v_new_listing_days then
    v_exploration_boost := round(
      v_exploration_max * (1 - (v_listing_age_days / v_new_listing_days)),
      2
    );
  end if;

  v_offline_base := round(
    v_quality_score * public.search_param_num(v_score_weights, 'quality', 0.25)
    + v_engagement_score * public.search_param_num(v_score_weights, 'engagement', 0.20)
    + v_reputation_score * public.search_param_num(v_score_weights, 'reputation', 0.30)
    + v_freshness_score * public.search_param_num(v_score_weights, 'freshness', 0.15)
    + v_exploration_boost * public.search_param_num(v_score_weights, 'exploration', 0.10),
    2
  );

  v_scores := jsonb_build_object(
    'quality_score', v_quality_score,
    'engagement_score', v_engagement_score,
    'reputation_score', v_reputation_score,
    'freshness_score', v_freshness_score,
    'exploration_boost', v_exploration_boost,
    'offline_base_score', v_offline_base
  );

  v_metrics := jsonb_build_object(
    'imageCount', v_image_count,
    'publicImageCount', v_public_count,
    'hasMainImage', v_has_main,
    'distinctImageUrls', v_distinct_urls,
    'descriptionLength', v_desc_len,
    'descriptionRepeatRatio', round(v_repeat_ratio, 4),
    'views', v_views,
    'messages', v_messages,
    'bookings', v_bookings,
    'holds', v_holds,
    'avgRating', v_avg_rating,
    'reviewCount', v_review_count,
    'ownerTenureDays', v_owner_tenure_days,
    'completedBookings', v_completed_bookings,
    'cancelledBookings', v_cancelled_bookings,
    'listingAgeDays', v_listing_age_days
  );

  insert into public."PropertySearchScores" (
    "EstatePropertyId",
    "ListingType",
    "ListingId",
    "Scores",
    "Metrics",
    "ComputedAt"
  )
  values (
    p_estate_property_id,
    v_listing_type,
    v_listing."Id",
    v_scores,
    v_metrics,
    now()
  )
  on conflict ("EstatePropertyId", "ListingType") do update
  set
    "ListingId" = excluded."ListingId",
    "Scores" = excluded."Scores",
    "Metrics" = excluded."Metrics",
    "ComputedAt" = excluded."ComputedAt";

  return jsonb_build_object('success', true, 'scores', v_scores, 'metrics', v_metrics);
end;
$$;


--
-- Name: confirm_booking_from_hold(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_booking_from_hold(p_hold_id uuid, p_guest_payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_hold public.booking_holds%rowtype;
  v_booking_id uuid;
  v_guest_id uuid;
  v_manage_token jsonb;
  v_reservation_code text;
  v_estimated_guests integer;
  v_attempt integer := 0;
  v_first_name text;
  v_last_name text;
  v_email text;
  v_phone text;
  v_full_name text;
  v_booking_listing_type public."ListingType" := null;
  v_overlap_message text := 'You already have a reservation that overlaps these dates.';
begin
  select * into v_hold
  from public.booking_holds
  where id = p_hold_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Hold not found');
  end if;

  if v_hold.status <> 'pending' or v_hold.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'Hold expired');
  end if;

  if v_hold.otp_verified_at is null then
    return jsonb_build_object('success', false, 'error', 'OTP verification required');
  end if;

  if coalesce(trim(v_hold.listing_type), '') <> '' then
    begin
      v_booking_listing_type := public.validate_guest_site_listing_type(v_hold.listing_type);
    exception
      when others then
        return jsonb_build_object('success', false, 'error', 'Invalid listing type on booking hold');
    end;
  end if;

  v_first_name := trim(coalesce(p_guest_payload->>'firstName', ''));
  v_last_name := trim(coalesce(p_guest_payload->>'lastName', ''));
  v_email := trim(coalesce(p_guest_payload->>'email', ''));
  v_phone := trim(coalesce(p_guest_payload->>'phone', ''));

  if v_first_name = '' or v_last_name = '' then
    v_full_name := trim(coalesce(p_guest_payload->>'fullName', ''));
    if v_full_name <> '' then
      v_first_name := split_part(v_full_name, ' ', 1);
      v_last_name := nullif(trim(substring(v_full_name from position(' ' in v_full_name) + 1)), '');
      if v_last_name is null then
        v_last_name := '-';
      end if;
    end if;
  end if;

  if v_first_name = '' or v_last_name = '' or v_email = '' or v_phone = '' then
    return jsonb_build_object(
      'success', false,
      'error', 'Guest first name, last name, email, and phone are required'
    );
  end if;

  begin
    v_guest_id := public.upsert_guest_by_email(
      v_first_name,
      v_last_name,
      v_email,
      v_phone
    );
  exception
    when others then
      return jsonb_build_object('success', false, 'error', sqlerrm);
  end;

  perform pg_advisory_xact_lock(hashtextextended(v_guest_id::text, 0));

  if public.guest_has_overlapping_booking(
    v_guest_id,
    v_hold.check_in,
    v_hold.check_out
  ) then
    return jsonb_build_object(
      'success', false,
      'error_code', 'GUEST_BOOKING_OVERLAP',
      'error', v_overlap_message
    );
  end if;

  v_estimated_guests := coalesce(
    (p_guest_payload->>'estimatedGuests')::integer,
    v_hold.estimated_guests
  );

  loop
    v_attempt := v_attempt + 1;
    v_reservation_code := 'RSV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    exit when not exists (
      select 1
      from public."Bookings" b
      where b."ReservationCode" = v_reservation_code
        and b."IsDeleted" = false
    );

    if v_attempt >= 20 then
      return jsonb_build_object('success', false, 'error', 'Could not allocate reservation code');
    end if;
  end loop;

  insert into public."Bookings" (
    "EstatePropertyId",
    "GuestId",
    "CheckInDate",
    "CheckOutDate",
    "GuestCount",
    "TotalAmount",
    "Status",
    "Created",
    "LastModified",
    "IsDeleted",
    "Notes",
    "ReservationCode",
    "ListingType"
  ) values (
    v_hold.property_id,
    v_guest_id,
    v_hold.check_in,
    v_hold.check_out,
    v_hold.guests,
    coalesce((p_guest_payload->>'totalPrice')::numeric, 0),
    0,
    now(),
    now(),
    false,
    concat(
      'Guest booking ',
      v_reservation_code,
      case
        when v_estimated_guests is not null
        then concat(' | Estimated guests: ', v_estimated_guests)
        else ''
      end
    ),
    v_reservation_code,
    v_booking_listing_type
  )
  returning "Id" into v_booking_id;

  update public.booking_holds
  set
    status = 'confirmed',
    full_name = coalesce(
      nullif(trim(p_guest_payload->>'fullName'), ''),
      trim(v_first_name || ' ' || v_last_name)
    ),
    email = v_email,
    phone = v_phone,
    document_id = p_guest_payload->>'documentId',
    estimated_guests = v_estimated_guests,
    updated_at = now()
  where id = p_hold_id;

  v_manage_token := public.issue_booking_manage_token(v_booking_id);

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'guest_id', v_guest_id,
    'reservation_code', v_reservation_code,
    'listing_type', v_booking_listing_type::text,
    'manage_token', v_manage_token->>'token',
    'manage_expires_at', v_manage_token->>'expires_at'
  );
end;
$$;


--
-- Name: count_member_accessible_properties(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_member_accessible_properties(p_member_id uuid) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_count bigint;
begin
  if not public.member_rpc_caller_ok(p_member_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select count(*)::bigint
  into v_count
  from public."EstateProperties" ep
  join public."Owners" o
    on o."Id" = ep."OwnerId"
   and o."IsDeleted" = false
  where ep."IsDeleted" = false
    and (
      (o."OwnerType" = 'member' and o."MemberId" = p_member_id)
      or (
        o."OwnerType" = 'company'
        and exists (
          select 1
          from public."CompanyMembers" cm
          where cm."CompanyId" = o."CompanyId"
            and cm."MemberId" = p_member_id
            and cm."IsDeleted" = false
        )
      )
    );

  return coalesce(v_count, 0);
end;
$$;


--
-- Name: count_member_published_properties(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_member_published_properties(p_member_id uuid) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_count bigint;
begin
  if not public.member_rpc_caller_ok(p_member_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  with accessible as (
    select ep."Id"
    from public."EstateProperties" ep
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and (
        (o."OwnerType" = 'member' and o."MemberId" = p_member_id)
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = p_member_id
              and cm."IsDeleted" = false
          )
        )
      )
  )
  select count(distinct l."EstatePropertyId")::bigint
  into v_count
  from public."Listings" l
  join accessible a
    on a."Id" = l."EstatePropertyId"
  where l."IsDeleted" = false
    and l."IsPropertyVisible" = true
    and l."IsActive" = true;

  return coalesce(v_count, 0);
end;
$$;


--
-- Name: create_booking_hold(uuid, date, date, integer, text, text, date, integer, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_booking_hold(p_property_id uuid, p_check_in date, p_check_out date, p_guests integer, p_ip_hash text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text, p_visible_check_out date DEFAULT NULL::date, p_estimated_guests integer DEFAULT NULL::integer, p_listing_type text DEFAULT NULL::text, p_client_total numeric DEFAULT NULL::numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_validation jsonb;
  v_hold_id uuid;
  v_listing_type text := null;
  v_scope text := null;
begin
  if coalesce(trim(p_listing_type), '') <> '' then
    begin
      v_listing_type := public.validate_guest_site_listing_type(p_listing_type)::text;
      v_scope := v_listing_type;
    exception
      when others then
        return jsonb_build_object('success', false, 'error', 'Invalid listing type');
    end;
  end if;

  v_validation := public.validate_booking_selection(
    p_property_id,
    p_check_in,
    coalesce(p_visible_check_out, p_check_out),
    p_guests,
    v_listing_type,
    p_client_total,
    v_scope
  );

  if not coalesce((v_validation->>'is_valid')::boolean, false) then
    return jsonb_build_object(
      'success', false,
      'error', coalesce(v_validation->'errors'->>0, 'Validation failed'),
      'error_code', v_validation->>'error_code',
      'validation', v_validation
    );
  end if;

  if exists (
    select 1
    from public.booking_holds h
    where h.property_id = p_property_id
      and h.status = 'pending'
      and h.expires_at > now()
      and daterange(h.check_in, h.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) then
    return jsonb_build_object('success', false, 'error', 'Selected dates are temporarily held by another guest');
  end if;

  insert into public.booking_holds (
    property_id, check_in, check_out, guests, estimated_guests, ip_hash, idempotency_key, listing_type
  ) values (
    p_property_id, p_check_in, p_check_out, p_guests, p_estimated_guests, p_ip_hash, p_idempotency_key, v_listing_type
  )
  returning id into v_hold_id;

  return jsonb_build_object(
    'success', true,
    'hold', jsonb_build_object(
      'id', v_hold_id,
      'expires_at', (select expires_at from public.booking_holds where id = v_hold_id),
      'listing_type', v_listing_type
    ),
    'validation', v_validation
  );
end;
$$;


--
-- Name: create_estate_property(uuid, text, text, text, text, text, text, text, double precision, double precision, integer, double precision, integer, integer, integer, integer, boolean, boolean, boolean, boolean, integer, integer, integer, boolean, boolean, boolean, double precision, integer, boolean, text, boolean, integer, boolean, boolean, text, text, integer, integer, integer, integer, text, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_estate_property(p_member_id uuid, p_street_name text, p_house_number text, p_neighborhood text, p_city text, p_state text, p_zip_code text, p_country text, p_location_lat double precision, p_location_lng double precision, p_property_category integer, p_area_value double precision, p_area_unit integer, p_bedrooms integer, p_bathrooms integer, p_garage_spaces integer, p_has_laundry_room boolean, p_has_pool boolean, p_has_balcony boolean, p_is_furnished boolean, p_capacity integer, p_location_category integer, p_view_type integer, p_allows_financing boolean, p_is_new_construction boolean, p_has_mortgage boolean, p_hoa_fees double precision, p_min_contract_months integer, p_requires_guarantee boolean, p_guarantee_type text, p_allows_pets boolean, p_max_guests integer, p_has_catering boolean, p_has_sound_system boolean, p_closing_hour text, p_allowed_events_description text, p_min_stay_days integer, p_max_stay_days integer, p_lead_time_days integer, p_buffer_days integer, p_extension_type text DEFAULT NULL::text, p_amenity_ids uuid[] DEFAULT NULL::uuid[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_property_id uuid;
  v_owner_id uuid;
  v_member_id uuid;
  v_company_id uuid;
  v_result jsonb;
  v_existing_property_count integer;
  v_subscription_plan_max_properties integer;
  v_hard_cap_limit integer := 10;
  v_free_user_limit integer := 2;
  v_effective_extension_type text;
begin
  v_member_id := p_member_id;
  v_company_id := null;

  if v_member_id is null then
    raise exception 'Member ID is required to create an estate property.';
  end if;

  begin
    v_owner_id := get_or_create_owner(v_member_id, v_company_id, null);
  exception when undefined_function then
    v_owner_id := coalesce(v_member_id, v_company_id);
  end;

  begin
    select count(*) into v_existing_property_count
    from public."EstateProperties" ep
    inner join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
    where ep."IsDeleted" = false
    and (
      (o."OwnerType" = 'member' and o."MemberId" = v_member_id) or
      (o."OwnerType" = 'company' and o."CompanyId" in (
        select cm."CompanyId"
        from public."CompanyMembers" cm
        where cm."MemberId" = v_member_id and cm."IsDeleted" = false
      ))
    );

    -- Plan limit lookup migrated from MemberPlans to BillingPlanAssignments.
    select coalesce(p."ListingLimit", p."MaxProperties", v_free_user_limit)
      into v_subscription_plan_max_properties
    from public."Members" m
    left join lateral (
      select bpa."PlanId"
      from public."BillingPlanAssignments" bpa
      where bpa."SubjectType" = 'member'
        and bpa."MemberOrCompanyId" = v_member_id
        and bpa."IsActive" = true
        and bpa."StartDate" <= now()
        and (bpa."EndDate" is null or bpa."EndDate" >= now())
      order by bpa."StartDate" desc
      limit 1
    ) active_plan on true
    left join public."Plans" p
      on p."Id" = active_plan."PlanId"
      and coalesce(p."IsActiveV2", p."IsActive", true) = true
      and p."IsDeleted" = false
    where m."Id" = v_member_id
      and m."IsDeleted" = false;

    if v_subscription_plan_max_properties is null then
      v_subscription_plan_max_properties := v_free_user_limit;
    end if;

    v_subscription_plan_max_properties := least(v_subscription_plan_max_properties, v_hard_cap_limit);

    if v_existing_property_count >= v_subscription_plan_max_properties then
      raise exception 'Property limit exceeded. You have % properties but your plan allows maximum %. Please upgrade your subscription or delete existing properties to create new ones.',
        v_existing_property_count, v_subscription_plan_max_properties;
    end if;
  end;

  v_property_id := gen_random_uuid();

  insert into public."EstateProperties" (
    "Id",
    "StreetName",
    "HouseNumber",
    "Neighborhood",
    "City",
    "State",
    "ZipCode",
    "Country",
    "LocationLatitude",
    "LocationLongitude",
    "AreaValue",
    "AreaUnit",
    "Bedrooms",
    "Bathrooms",
    "HasGarage",
    "GarageSpaces",
    "OwnerId",
    "IsDeleted",
    "HasLaundryRoom",
    "HasPool",
    "HasBalcony",
    "IsFurnished",
    "Capacity",
    "LocationCategory",
    "ViewType"
  ) values (
    v_property_id,
    p_street_name,
    p_house_number,
    p_neighborhood,
    p_city,
    p_state,
    p_zip_code,
    p_country,
    p_location_lat,
    p_location_lng,
    p_area_value,
    p_area_unit,
    p_bedrooms,
    p_bathrooms,
    (p_garage_spaces is not null and p_garage_spaces > 0),
    p_garage_spaces,
    v_owner_id,
    false,
    coalesce(p_has_laundry_room, false),
    coalesce(p_has_pool, false),
    coalesce(p_has_balcony, false),
    coalesce(p_is_furnished, false),
    p_capacity,
    case coalesce(p_location_category, 1)
      when 0 then 'rural'::public."LocationCategory"
      when 1 then 'city'::public."LocationCategory"
      when 2 then 'near_shore'::public."LocationCategory"
      else 'city'::public."LocationCategory"
    end,
    case coalesce(p_view_type, 0)
      when 0 then 'city'::public."ViewType"
      when 1 then 'mountain'::public."ViewType"
      when 2 then 'rural'::public."ViewType"
      when 3 then 'sea'::public."ViewType"
      else 'city'::public."ViewType"
    end
  );

  v_effective_extension_type := coalesce(p_extension_type, 'RealEstate');

  if lower(v_effective_extension_type) = 'realestate' then
    insert into public."RealEstateExtension" (
      "EstatePropertyId",
      "AllowsFinancing",
      "IsNewConstruction",
      "HasMortgage",
      "HOAFees",
      "MinContractMonths",
      "RequiresGuarantee",
      "GuaranteeType",
      "AllowsPets",
      "Category"
    ) values (
      v_property_id,
      p_allows_financing,
      p_is_new_construction,
      p_has_mortgage,
      p_hoa_fees,
      p_min_contract_months,
      p_requires_guarantee,
      p_guarantee_type,
      p_allows_pets,
      case coalesce(p_property_category, 0)
        when 0 then 'Casa'::public."PropertyCategory"
        when 1 then 'Apartamento'::public."PropertyCategory"
        when 2 then 'Terreno'::public."PropertyCategory"
        when 3 then 'Chacra'::public."PropertyCategory"
        when 4 then 'Campo'::public."PropertyCategory"
        else 'Casa'::public."PropertyCategory"
      end
    );
  elsif lower(v_effective_extension_type) = 'eventvenue' then
    insert into public."EventVenueExtension" (
      "EstatePropertyId",
      "MaxGuests",
      "HasCatering",
      "HasSoundSystem",
      "ClosingHour",
      "AllowedEventsDescription",
      "Created",
      "LastModified"
    ) values (
      v_property_id,
      p_max_guests,
      p_has_catering,
      p_has_sound_system,
      nullif(p_closing_hour, '')::time,
      p_allowed_events_description,
      now(),
      now()
    );
  elsif lower(v_effective_extension_type) = 'summerrent' then
    insert into public."SummerRentExtension" (
      "EstatePropertyId",
      "MinStayDays",
      "MaxStayDays",
      "LeadTimeDays",
      "BufferDays"
    ) values (
      v_property_id,
      p_min_stay_days,
      p_max_stay_days,
      p_lead_time_days,
      p_buffer_days
    );
  end if;

  if p_amenity_ids is not null and array_length(p_amenity_ids, 1) > 0 then
    insert into public."EstatePropertyAmenity" (
      "EstatePropertyId",
      "AmenityId",
      "CreatedAtUtc",
      "DeletedAtUtc"
    )
    select
      v_property_id,
      amenity_id,
      now(),
      null
    from unnest(p_amenity_ids) as amenity_id;
  end if;

  v_result := jsonb_build_object(
    'id', v_property_id,
    'streetName', p_street_name,
    'houseNumber', p_house_number,
    'neighborhood', p_neighborhood,
    'city', p_city,
    'state', p_state,
    'zipCode', p_zip_code,
    'country', p_country,
    'location', jsonb_build_object('lat', p_location_lat, 'lng', p_location_lng),
    'areaValue', p_area_value,
    'areaUnit', p_area_unit,
    'bedrooms', p_bedrooms,
    'bathrooms', p_bathrooms,
    'hasGarage', (p_garage_spaces is not null and p_garage_spaces > 0),
    'garageSpaces', p_garage_spaces,
    'hasLaundryRoom', p_has_laundry_room,
    'hasPool', p_has_pool,
    'hasBalcony', p_has_balcony,
    'isFurnished', p_is_furnished,
    'capacity', p_capacity,
    'locationCategory', p_location_category,
    'viewType', p_view_type,
    'ownerId', v_owner_id,
    'created', now()
  );

  return v_result;
exception
  when others then
    raise exception 'Failed to create estate property: %', sqlerrm;
end;
$$;


--
-- Name: create_estate_property(uuid, text, text, text, text, text, text, text, double precision, double precision, integer, double precision, integer, integer, integer, integer, boolean, boolean, boolean, boolean, integer, integer, integer, boolean, boolean, boolean, double precision, integer, boolean, text, boolean, integer, boolean, boolean, text, text, integer, integer, integer, integer, text, uuid[], jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_estate_property(p_member_id uuid, p_street_name text, p_house_number text, p_neighborhood text, p_city text, p_state text, p_zip_code text, p_country text, p_location_lat double precision, p_location_lng double precision, p_property_category integer, p_area_value double precision, p_area_unit integer, p_bedrooms integer, p_bathrooms integer, p_garage_spaces integer, p_has_laundry_room boolean, p_has_pool boolean, p_has_balcony boolean, p_is_furnished boolean, p_capacity integer, p_location_category integer, p_view_type integer, p_allows_financing boolean, p_is_new_construction boolean, p_has_mortgage boolean, p_hoa_fees double precision, p_min_contract_months integer, p_requires_guarantee boolean, p_guarantee_type text, p_allows_pets boolean, p_max_guests integer, p_has_catering boolean, p_has_sound_system boolean, p_closing_hour text, p_allowed_events_description text, p_min_stay_days integer, p_max_stay_days integer, p_lead_time_days integer, p_buffer_days integer, p_extension_type text DEFAULT NULL::text, p_amenity_ids uuid[] DEFAULT NULL::uuid[], p_amenity_links jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_property_id uuid;
  v_owner_id uuid;
  v_member_id uuid;
  v_company_id uuid;
  v_result jsonb;
  v_existing_property_count integer;
  v_subscription_plan_max_properties integer;
  v_hard_cap_limit integer := 10;
  v_free_user_limit integer := 2;
  v_effective_extension_type text;
  v_link jsonb;
  v_amenity_id uuid;
  v_descriptions jsonb;
begin
  v_member_id := p_member_id;
  v_company_id := null;

  if v_member_id is null then
    raise exception 'Member ID is required to create an estate property.';
  end if;

  begin
    v_owner_id := get_or_create_owner(v_member_id, v_company_id, null);
  exception when undefined_function then
    v_owner_id := coalesce(v_member_id, v_company_id);
  end;

  begin
    select count(*) into v_existing_property_count
    from public."EstateProperties" ep
    inner join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
    where ep."IsDeleted" = false
    and (
      (o."OwnerType" = 'member' and o."MemberId" = v_member_id) or
      (o."OwnerType" = 'company' and o."CompanyId" in (
        select cm."CompanyId"
        from public."CompanyMembers" cm
        where cm."MemberId" = v_member_id and cm."IsDeleted" = false
      ))
    );

    select coalesce(p."ListingLimit", p."MaxProperties", v_free_user_limit)
      into v_subscription_plan_max_properties
    from public."Members" m
    left join lateral (
      select bpa."PlanId"
      from public."BillingPlanAssignments" bpa
      where bpa."SubjectType" = 'member'
        and bpa."MemberOrCompanyId" = v_member_id
        and bpa."IsActive" = true
        and bpa."StartDate" <= now()
        and (bpa."EndDate" is null or bpa."EndDate" >= now())
      order by bpa."StartDate" desc
      limit 1
    ) active_plan on true
    left join public."Plans" p
      on p."Id" = active_plan."PlanId"
      and coalesce(p."IsActiveV2", p."IsActive", true) = true
      and p."IsDeleted" = false
    where m."Id" = v_member_id
      and m."IsDeleted" = false;

    if v_subscription_plan_max_properties is null then
      v_subscription_plan_max_properties := v_free_user_limit;
    end if;

    v_subscription_plan_max_properties := least(v_subscription_plan_max_properties, v_hard_cap_limit);

    if v_existing_property_count >= v_subscription_plan_max_properties then
      raise exception 'Property limit exceeded. You have % properties but your plan allows maximum %. Please upgrade your subscription or delete existing properties to create new ones.',
        v_existing_property_count, v_subscription_plan_max_properties;
    end if;
  end;

  v_property_id := gen_random_uuid();

  insert into public."EstateProperties" (
    "Id",
    "StreetName",
    "HouseNumber",
    "Neighborhood",
    "City",
    "State",
    "ZipCode",
    "Country",
    "LocationLatitude",
    "LocationLongitude",
    "AreaValue",
    "AreaUnit",
    "Bedrooms",
    "Bathrooms",
    "HasGarage",
    "GarageSpaces",
    "OwnerId",
    "IsDeleted",
    "HasLaundryRoom",
    "HasPool",
    "HasBalcony",
    "IsFurnished",
    "Capacity",
    "LocationCategory",
    "ViewType"
  ) values (
    v_property_id,
    p_street_name,
    p_house_number,
    p_neighborhood,
    p_city,
    p_state,
    p_zip_code,
    p_country,
    p_location_lat,
    p_location_lng,
    p_area_value,
    p_area_unit,
    p_bedrooms,
    p_bathrooms,
    (p_garage_spaces is not null and p_garage_spaces > 0),
    p_garage_spaces,
    v_owner_id,
    false,
    coalesce(p_has_laundry_room, false),
    coalesce(p_has_pool, false),
    coalesce(p_has_balcony, false),
    coalesce(p_is_furnished, false),
    p_capacity,
    case coalesce(p_location_category, 1)
      when 0 then 'rural'::public."LocationCategory"
      when 1 then 'city'::public."LocationCategory"
      when 2 then 'near_shore'::public."LocationCategory"
      else 'city'::public."LocationCategory"
    end,
    case coalesce(p_view_type, 0)
      when 0 then 'city'::public."ViewType"
      when 1 then 'mountain'::public."ViewType"
      when 2 then 'rural'::public."ViewType"
      when 3 then 'sea'::public."ViewType"
      else 'city'::public."ViewType"
    end
  );

  v_effective_extension_type := coalesce(p_extension_type, 'RealEstate');

  if lower(v_effective_extension_type) = 'realestate' then
    insert into public."RealEstateExtension" (
      "EstatePropertyId",
      "AllowsFinancing",
      "IsNewConstruction",
      "HasMortgage",
      "HOAFees",
      "MinContractMonths",
      "RequiresGuarantee",
      "GuaranteeType",
      "AllowsPets",
      "Category"
    ) values (
      v_property_id,
      p_allows_financing,
      p_is_new_construction,
      p_has_mortgage,
      p_hoa_fees,
      p_min_contract_months,
      p_requires_guarantee,
      p_guarantee_type,
      p_allows_pets,
      case coalesce(p_property_category, 0)
        when 0 then 'Casa'::public."PropertyCategory"
        when 1 then 'Apartamento'::public."PropertyCategory"
        when 2 then 'Terreno'::public."PropertyCategory"
        when 3 then 'Chacra'::public."PropertyCategory"
        when 4 then 'Campo'::public."PropertyCategory"
        else 'Casa'::public."PropertyCategory"
      end
    );
  elsif lower(v_effective_extension_type) = 'eventvenue' then
    insert into public."EventVenueExtension" (
      "EstatePropertyId",
      "MaxGuests",
      "HasCatering",
      "HasSoundSystem",
      "ClosingHour",
      "AllowedEventsDescription",
      "Created",
      "LastModified"
    ) values (
      v_property_id,
      p_max_guests,
      p_has_catering,
      p_has_sound_system,
      nullif(p_closing_hour, '')::time,
      p_allowed_events_description,
      now(),
      now()
    );
  elsif lower(v_effective_extension_type) = 'summerrent' then
    insert into public."SummerRentExtension" (
      "EstatePropertyId",
      "MinStayDays",
      "MaxStayDays",
      "LeadTimeDays",
      "BufferDays"
    ) values (
      v_property_id,
      p_min_stay_days,
      p_max_stay_days,
      p_lead_time_days,
      p_buffer_days
    );
  end if;

  if p_amenity_links is not null and jsonb_typeof(p_amenity_links) = 'array' and jsonb_array_length(p_amenity_links) > 0 then
    for v_link in select * from jsonb_array_elements(p_amenity_links)
    loop
      v_amenity_id := nullif(trim(both from coalesce(v_link->>'amenityId', v_link->>'amenity_id', '')), '')::uuid;
      if v_amenity_id is null then
        continue;
      end if;
      v_descriptions := public.sanitize_amenity_localized_descriptions(v_link->'descriptions');
      insert into public."EstatePropertyAmenity" (
        "EstatePropertyId",
        "AmenityId",
        "LocalizedDescriptions",
        "CreatedAtUtc",
        "DeletedAtUtc"
      ) values (
        v_property_id,
        v_amenity_id,
        v_descriptions,
        now(),
        null
      );
    end loop;
  elsif p_amenity_ids is not null and array_length(p_amenity_ids, 1) > 0 then
    insert into public."EstatePropertyAmenity" (
      "EstatePropertyId",
      "AmenityId",
      "LocalizedDescriptions",
      "CreatedAtUtc",
      "DeletedAtUtc"
    )
    select
      v_property_id,
      amenity_id,
      '{}'::jsonb,
      now(),
      null
    from unnest(p_amenity_ids) as amenity_id;
  end if;

  v_result := jsonb_build_object(
    'id', v_property_id,
    'streetName', p_street_name,
    'houseNumber', p_house_number,
    'neighborhood', p_neighborhood,
    'city', p_city,
    'state', p_state,
    'zipCode', p_zip_code,
    'country', p_country,
    'location', jsonb_build_object('lat', p_location_lat, 'lng', p_location_lng),
    'areaValue', p_area_value,
    'areaUnit', p_area_unit,
    'bedrooms', p_bedrooms,
    'bathrooms', p_bathrooms,
    'hasGarage', (p_garage_spaces is not null and p_garage_spaces > 0),
    'garageSpaces', p_garage_spaces,
    'hasLaundryRoom', p_has_laundry_room,
    'hasPool', p_has_pool,
    'hasBalcony', p_has_balcony,
    'isFurnished', p_is_furnished,
    'capacity', p_capacity,
    'locationCategory', p_location_category,
    'viewType', p_view_type,
    'ownerId', v_owner_id,
    'created', now()
  );

  return v_result;
exception
  when others then
    raise exception 'Failed to create estate property: %', sqlerrm;
end;
$$;


--
-- Name: create_guest_review_by_reservation_code(text, text, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_guest_review_by_reservation_code(p_reservation_code text, p_guest_email text, p_rating integer, p_comment text, p_listing_type text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_code text;
  v_listing_type public."ListingType";
  v_booking record;
  v_guest_email text;
  v_profile_email text;
  v_review_id uuid;
  v_window jsonb;
  v_window_start timestamptz;
  v_window_end timestamptz;
begin
  v_code := upper(trim(coalesce(p_reservation_code, '')));

  if v_code = '' or v_code !~ '^RSV-[A-Z0-9]{6}$' then
    return jsonb_build_object('success', false, 'error', 'Invalid reservation code format');
  end if;

  begin
    v_listing_type := public.validate_guest_site_listing_type(p_listing_type);
  exception
    when others then
      return jsonb_build_object('success', false, 'error', 'Invalid listing type');
  end;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('success', false, 'error', 'Rating must be between 1 and 5');
  end if;

  if coalesce(trim(p_comment), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Comment is required');
  end if;

  if coalesce(trim(p_guest_email), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Guest email does not match');
  end if;

  select
    b."Id" as booking_id,
    b."GuestId" as guest_id,
    b."EstatePropertyId" as estate_property_id,
    b."ListingType" as booking_listing_type,
    b."CheckInDate" as check_in,
    b."CheckOutDate" as check_out,
    b."Status" as status_code,
    b."IsDeleted" as is_deleted
  into v_booking
  from public."Bookings" b
  where b."ReservationCode" = v_code
    and b."IsDeleted" = false
  order by b."Created" desc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if not public.booking_matches_guest_site_listing_type(
    v_booking.booking_listing_type,
    v_booking.estate_property_id,
    v_booking.check_in,
    v_booking.check_out,
    v_listing_type
  ) then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if coalesce(v_booking.is_deleted, false) then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if v_booking.guest_id is null then
    return jsonb_build_object('success', false, 'error', 'Booking not eligible for review');
  end if;

  if v_booking.status_code not in (1, 3) then
    return jsonb_build_object('success', false, 'error', 'Booking not eligible for review');
  end if;

  v_window := public.compute_guest_review_window(v_booking.check_out);
  v_window_start := (v_window->>'windowStart')::timestamptz;
  v_window_end := (v_window->>'windowEnd')::timestamptz;

  if now() < v_window_start then
    return jsonb_build_object('success', false, 'error', 'Checkout has not passed');
  end if;

  if now() > v_window_end then
    return jsonb_build_object('success', false, 'error', 'Review window expired');
  end if;

  v_guest_email := lower(trim(p_guest_email));
  v_profile_email := lower(trim(coalesce(public.resolve_guest_profile(v_booking.guest_id)->>'email', '')));

  if v_guest_email = '' or v_profile_email = '' or v_guest_email <> v_profile_email then
    return jsonb_build_object('success', false, 'error', 'Guest email does not match');
  end if;

  if exists (
    select 1
    from public."Reviews" r
    where r."BookingId" = v_booking.booking_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Review already exists');
  end if;

  begin
    insert into public."Reviews" (
      "BookingId",
      "GuestId",
      "EstatePropertyId",
      "ListingType",
      "Rating",
      "Comment"
    ) values (
      v_booking.booking_id,
      v_booking.guest_id,
      v_booking.estate_property_id,
      v_listing_type,
      p_rating,
      trim(p_comment)
    )
    returning "Id" into v_review_id;
  exception
    when unique_violation then
      return jsonb_build_object('success', false, 'error', 'Review already exists');
  end;

  return jsonb_build_object(
    'success', true,
    'reviewId', v_review_id,
    'listingType', v_listing_type::text
  );
end;
$_$;


--
-- Name: create_listing_version(uuid, text, text, text, timestamp with time zone, integer, double precision, double precision, text, boolean, boolean, boolean, boolean, numeric, numeric, numeric, boolean, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_listing_version(p_estate_property_id uuid, p_listing_type text, p_title text, p_description text DEFAULT NULL::text, p_available_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_currency integer DEFAULT 0, p_sale_price double precision DEFAULT NULL::double precision, p_rent_price double precision DEFAULT NULL::double precision, p_rent_price_period text DEFAULT NULL::text, p_is_price_visible boolean DEFAULT true, p_is_active boolean DEFAULT true, p_is_property_visible boolean DEFAULT true, p_blocked_for_booking boolean DEFAULT false, p_base_price numeric DEFAULT NULL::numeric, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_long_stay_discount_enabled boolean DEFAULT false, p_long_stay_min_days integer DEFAULT NULL::integer, p_long_stay_discount_percentage numeric DEFAULT NULL::numeric) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_new_listing_id uuid;
  v_rent double precision := p_rent_price;
  v_base numeric := p_base_price;
  v_period public."RentPricePeriod" := null;
begin
  if p_rent_price_period is not null and p_rent_price_period not in ('PerNight', 'PerMonth') then
    raise exception 'Invalid rent price period: %', p_rent_price_period;
  end if;

  if p_rent_price_period is not null then
    v_period := p_rent_price_period::public."RentPricePeriod";
  end if;

  if v_base is not null and v_rent is null then
    v_rent := v_base::double precision;
  elsif v_rent is not null and v_base is null then
    v_base := v_rent::numeric;
  end if;

  update public."Listings"
  set
    "IsFeatured" = false,
    "IsActive" = false,
    "IsPropertyVisible" = false,
    "LastModified" = now()
  where "EstatePropertyId" = p_estate_property_id
    and "ListingType" = p_listing_type::public."ListingType"
    and "IsDeleted" = false
    and "IsFeatured" = true;

  insert into public."Listings" (
    "EstatePropertyId", "ListingType", "Title", "Description", "AvailableFrom", "Currency",
    "SalePrice", "RentPrice", "RentPricePeriod", "IsPriceVisible", "IsActive", "IsPropertyVisible",
    "IsFeatured", "BlockedForBooking", "BasePrice", "MinPrice", "MaxPrice",
    "LongStayDiscountEnabled", "LongStayMinDays", "LongStayDiscountPercentage",
    "IsDeleted", "Created", "LastModified"
  )
  values (
    p_estate_property_id, p_listing_type::public."ListingType", p_title, p_description,
    coalesce(p_available_from, now()), p_currency, p_sale_price, v_rent, v_period,
    p_is_price_visible, p_is_active, p_is_property_visible, true, p_blocked_for_booking,
    v_base, p_min_price, p_max_price,
    coalesce(p_long_stay_discount_enabled, false), p_long_stay_min_days, p_long_stay_discount_percentage,
    false, now(), now()
  )
  returning "Id" into v_new_listing_id;

  return v_new_listing_id;
end;
$$;


--
-- Name: create_property_message_thread(uuid, uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_property_message_thread(p_property_id uuid, p_user_id uuid, p_subject character varying) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_member_id UUID;
    v_owner_id UUID;
    v_thread_id UUID;
BEGIN
    -- Get member ID from user ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Get property owner ID
    SELECT "OwnerId" INTO v_owner_id
    FROM "EstateProperties"
    WHERE "Id" = p_property_id AND "IsDeleted" = false;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    -- Check if user is not the property owner (prevent self-messaging)
    IF v_owner_id = v_member_id THEN
        RAISE EXCEPTION 'Cannot create message thread for your own property';
    END IF;

    -- Create new thread
    INSERT INTO "MessageThreads" (
        "Id",
        "Subject",
        "PropertyId",
        "CreatedAtUtc",
        "LastMessageAtUtc",
        "IsDeleted",
        "Created",
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    ) VALUES (
        gen_random_uuid(),
        p_subject,
        p_property_id,
        NOW(),
        NOW(),
        false,
        NOW(),
        v_member_id::text,
        NOW(),
        v_member_id::text
    ) RETURNING "Id" INTO v_thread_id;

    RETURN v_thread_id;
END;
$$;


--
-- Name: create_review(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_review(p_booking_id uuid, p_rating integer, p_comment text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_member_id uuid;
  v_booking record;
  v_review_id uuid;
begin
  -- 1. Resolve current user (member id)
  select "Id" into v_member_id
  from "Members"
  where "UserId" = auth.uid() and "IsDeleted" = false;

  if v_member_id is null then
    raise exception 'Unauthorized';
  end if;

  -- 2. Load booking
  select "Id", "GuestId", "EstatePropertyId", "Status", "CheckOutDate", "PaymentStatus"
  into v_booking
  from "Bookings"
  where "Id" = p_booking_id and "IsDeleted" = false;

  if v_booking is null or v_booking."Id" is null then
    raise exception 'Booking not found';
  end if;

  -- 3. Guest check (use MemberId instead of GuestId if your schema uses it)
  if v_booking."GuestId" is distinct from v_member_id then
    raise exception 'Not your booking';
  end if;

  -- 4. Status = Completed (3)
  if v_booking."Status" <> 3 then
    raise exception 'Booking not completed';
  end if;

  -- 5. Checkout has passed
  if v_booking."CheckOutDate" > current_date then
    raise exception 'Checkout has not passed';
  end if;

  -- 6. Payment = Paid (1)
  if v_booking."PaymentStatus" is null or v_booking."PaymentStatus" <> 1 then
    raise exception 'Payment required';
  end if;

  -- 7. Within review window (14 days after checkout)
  if current_date > v_booking."CheckOutDate" + 14 then
    raise exception 'Review window expired';
  end if;

  -- 8. No existing review for this booking
  if exists (select 1 from "Reviews" where "BookingId" = p_booking_id) then
    raise exception 'Review already exists';
  end if;

  -- 9. Rating 1ÔÇô5
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  -- 10. Insert review
  insert into "Reviews" ("BookingId", "UserId", "EstatePropertyId", "Rating", "Comment", "CreatedAt")
  values (p_booking_id, v_member_id, v_booking."EstatePropertyId", p_rating, nullif(trim(p_comment), ''), now())
  returning "Id" into v_review_id;

  return v_review_id;
end;
$$;


--
-- Name: cron_invoice_ready_cycles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cron_invoice_ready_cycles() RETURNS TABLE(billing_cycle_id uuid, subject_type text, member_or_company_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: cron_property_search_scores_batch(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cron_property_search_scores_batch(p_offset integer DEFAULT 0, p_limit integer DEFAULT 100) RETURNS TABLE(estate_property_id uuid, listing_type text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with featured_listings as (
    select distinct on (l."EstatePropertyId", l."ListingType")
      l."EstatePropertyId",
      l."ListingType"::text as listing_type
    from public."Listings" l
    join public."EstateProperties" ep on ep."Id" = l."EstatePropertyId"
    where l."IsDeleted" = false
      and l."IsActive" = true
      and l."IsPropertyVisible" = true
      and ep."IsDeleted" = false
      and l."ListingType"::text in ('SummerRent', 'EventVenue')
    order by l."EstatePropertyId", l."ListingType", l."IsFeatured" desc nulls last, l."Created" desc
  )
  select fl."EstatePropertyId", fl.listing_type
  from featured_listings fl
  order by fl."EstatePropertyId", fl.listing_type
  offset greatest(p_offset, 0)
  limit greatest(p_limit, 1);
$$;


--
-- Name: current_member_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_member_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select m."Id"
  from public."Members" m
  where m."UserId" = auth.uid()
    and m."IsDeleted" = false
  limit 1;
$$;


--
-- Name: FUNCTION current_member_id(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.current_member_id() IS 'Members.Id for the current auth user (security definer; safe inside Members RLS policies).';


--
-- Name: decrypt_oauth_token(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrypt_oauth_token(encrypted_token text, encryption_key text DEFAULT 'default_key_change_in_prod'::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    decrypted_token text;
BEGIN
    -- Use pgcrypto to decrypt the token
    SELECT convert_from(decrypt(decode(encrypted_token, 'base64'), encryption_key::bytea, 'aes'), 'utf8') INTO decrypted_token;
    RETURN decrypted_token;
END;
$$;


--
-- Name: detect_availability_conflicts(uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_availability_conflicts(property_id uuid, start_date timestamp with time zone, end_date timestamp with time zone) RETURNS TABLE("Id" uuid, "Title" text, "BlockType" integer, "Source" text, "IsReadOnly" boolean, "ConflictFlagged" boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        ab."Id",
        ab."Title",
        ab."BlockType",
        ab."Source",
        ab."IsReadOnly",
        ab."ConflictFlagged"
    FROM "AvailabilityBlocks" ab
    WHERE ab."EstatePropertyId" = property_id
        AND ab."IsDeleted" = false
        AND ab."IsAvailable" = false
        AND (
            (ab."StartDate" <= start_date AND ab."EndDate" > start_date) OR
            (ab."StartDate" < end_date AND ab."EndDate" >= end_date) OR
            (ab."StartDate" >= start_date AND ab."EndDate" <= end_date)
        );
END;
$$;


--
-- Name: duplicate_estate_property(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.duplicate_estate_property(p_original_property_id text, p_user_id text, p_new_title text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_original_property record;
  v_new_property_id uuid;
  v_member_id uuid;
  v_company_id uuid;
  v_owner_id uuid;
  v_new_title text;
  v_old_section_id uuid;
  v_new_section_id uuid;
begin
  select
    "StreetName", "HouseNumber", "Neighborhood", "City", "State", "ZipCode", "Country",
    "LocationLatitude", "LocationLongitude", "Title", "Type", "AreaValue", "AreaUnit",
    "Bedrooms", "Bathrooms", "HasGarage", "GarageSpaces", "OwnerId"
  into v_original_property
  from "EstateProperties"
  where "Id" = p_original_property_id::uuid;

  select id, company_id into v_member_id, v_company_id
  from members
  where id::text = p_user_id;

  begin
    v_owner_id := get_or_create_owner(v_member_id, v_company_id, null);
  exception when undefined_function then
    v_owner_id := coalesce(v_member_id, v_company_id);
  end;

  v_new_title := coalesce(p_new_title, v_original_property."Title" || ' (Copy)');
  v_new_property_id := gen_random_uuid();

  insert into "EstateProperties" (
    "Id",
    "StreetName",
    "HouseNumber",
    "Neighborhood",
    "City",
    "State",
    "ZipCode",
    "Country",
    "LocationLatitude",
    "LocationLongitude",
    "Title",
    "Type",
    "AreaValue",
    "AreaUnit",
    "Bedrooms",
    "Bathrooms",
    "HasGarage",
    "GarageSpaces",
    "OwnerId",
    "Created",
    "LastModified"
  ) values (
    v_new_property_id,
    v_original_property."StreetName",
    v_original_property."HouseNumber",
    v_original_property."Neighborhood",
    v_original_property."City",
    v_original_property."State",
    v_original_property."ZipCode",
    v_original_property."Country",
    v_original_property."LocationLatitude",
    v_original_property."LocationLongitude",
    v_new_title,
    v_original_property."Type",
    v_original_property."AreaValue",
    v_original_property."AreaUnit",
    v_original_property."Bedrooms",
    v_original_property."Bathrooms",
    v_original_property."HasGarage",
    v_original_property."GarageSpaces",
    v_owner_id,
    now(),
    now()
  );

  insert into "Listings" (
    "Id",
    "EstatePropertyId",
    "ListingType",
    "Description",
    "AvailableFrom",
    "Capacity",
    "Currency",
    "SalePrice",
    "RentPrice",
    "HasCommonExpenses",
    "CommonExpensesValue",
    "IsElectricityIncluded",
    "IsWaterIncluded",
    "IsPriceVisible",
    "Status",
    "IsActive",
    "IsPropertyVisible",
    "IsFeatured",
    "BlockedForBooking",
    "IsDeleted",
    "Created",
    "CreatedBy",
    "LastModified",
    "LastModifiedBy"
  )
  select
    gen_random_uuid(),
    v_new_property_id,
    src."ListingType",
    src."Description",
    src."AvailableFrom",
    src."Capacity",
    src."Currency",
    src."SalePrice",
    src."RentPrice",
    src."HasCommonExpenses",
    src."CommonExpensesValue",
    src."IsElectricityIncluded",
    src."IsWaterIncluded",
    src."IsPriceVisible",
    src."Status",
    src."IsActive",
    src."IsPropertyVisible",
    false,
    coalesce(src."BlockedForBooking", false),
    false,
    now(),
    p_user_id,
    now(),
    p_user_id
  from "Listings" src
  where src."EstatePropertyId" = p_original_property_id::uuid
    and src."IsDeleted" = false
  order by src."Created" desc
  limit 1;

  insert into "PropertyImages" ("Id", "EstatePropertyId", "Url", "IsMain", "Order", "CreatedAtUtc")
  select gen_random_uuid(), v_new_property_id, "Url", "IsMain", "Order", now()
  from "PropertyImages"
  where "EstatePropertyId" = p_original_property_id::uuid;

  insert into "PropertyDocuments" ("Id", "EstatePropertyId", "Title", "Url", "CreatedAtUtc")
  select gen_random_uuid(), v_new_property_id, "Title", "Url", now()
  from "PropertyDocuments"
  where "EstatePropertyId" = p_original_property_id::uuid;

  insert into "PropertyVideos" ("Id", "EstatePropertyId", "Url", "Title", "ThumbnailUrl", "CreatedAtUtc")
  select gen_random_uuid(), v_new_property_id, "Url", "Title", "ThumbnailUrl", now()
  from "PropertyVideos"
  where "EstatePropertyId" = p_original_property_id::uuid;

  insert into "EstatePropertyAmenity" (
    "EstatePropertyId",
    "AmenityId",
    "LocalizedDescriptions",
    "CreatedAtUtc",
    "DeletedAtUtc"
  )
  select
    v_new_property_id,
    epa."AmenityId",
    epa."LocalizedDescriptions",
    now(),
    null
  from "EstatePropertyAmenity" epa
  where epa."EstatePropertyId" = p_original_property_id::uuid
    and epa."DeletedAtUtc" is null;

  insert into public."EstatePropertyPolicy" (
    "EstatePropertyId",
    "ListingType",
    "LocalizedTitle",
    "LocalizedDescription",
    "DisplayOrder",
    "IsDeleted",
    "Created",
    "LastModified"
  )
  select
    v_new_property_id,
    epp."ListingType",
    epp."LocalizedTitle",
    epp."LocalizedDescription",
    epp."DisplayOrder",
    false,
    now(),
    now()
  from public."EstatePropertyPolicy" epp
  where epp."EstatePropertyId" = p_original_property_id::uuid
    and epp."IsDeleted" = false;

  for v_old_section_id in
    select s.id
    from public.propertydetailssection s
    where s.propertyid = p_original_property_id::uuid
      and s.isdeleted = false
    order by s.displayorder, s.createdat
  loop
    v_new_section_id := gen_random_uuid();

    insert into public.propertydetailssection (
      id, propertyid, name, description, localizedname, localizeddescription,
      propertytype, layouttype, layoutconfig, displayorder, isdeleted, createdat, updatedat
    )
    select
      v_new_section_id,
      v_new_property_id,
      src.name,
      src.description,
      src.localizedname,
      src.localizeddescription,
      src.propertytype,
      src.layouttype,
      src.layoutconfig,
      src.displayorder,
      false,
      now(),
      now()
    from public.propertydetailssection src
    where src.id = v_old_section_id;

    insert into public.propertysectionimages (
      id, sectionid, propertyimageid, displayorder, createdat, updatedat
    )
    select
      gen_random_uuid(),
      v_new_section_id,
      psi.propertyimageid,
      psi.displayorder,
      now(),
      now()
    from public.propertysectionimages psi
    where psi.sectionid = v_old_section_id;
  end loop;

  return get_estate_property_by_id(v_new_property_id::text);
end;
$$;


--
-- Name: encrypt_oauth_token(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.encrypt_oauth_token(token_text text, encryption_key text DEFAULT 'default_key_change_in_prod'::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    encrypted_token text;
BEGIN
    -- Use pgcrypto to encrypt the token
    SELECT encode(encrypt(token_text::bytea, encryption_key::bytea, 'aes'), 'base64') INTO encrypted_token;
    RETURN encrypted_token;
END;
$$;


--
-- Name: find_overlapping_bookings(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_overlapping_bookings(property_id uuid, check_in_date date, check_out_date date) RETURNS TABLE("Id" uuid, "CheckInDate" date, "CheckOutDate" date, "Status" integer, "HasConflict" boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        b."Id",
        b."CheckInDate",
        b."CheckOutDate",
        b."Status",
        b."HasConflict"
    FROM "Bookings" b
    WHERE b."EstatePropertyId" = property_id
        AND b."IsDeleted" = false
        AND b."Status" IN (0, 1, 2) -- Pending, Confirmed, Cancelled
        AND (
            (b."CheckInDate" <= check_in_date AND b."CheckOutDate" > check_in_date) OR
            (b."CheckInDate" < check_out_date AND b."CheckOutDate" >= check_out_date) OR
            (b."CheckInDate" >= check_in_date AND b."CheckOutDate" <= check_out_date)
        );
END;
$$;


--
-- Name: flexible_usage_limit_check(text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.flexible_usage_limit_check(p_subject_type text, p_subject_id uuid, p_usage_type text, p_reference_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: force_user_logout(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.force_user_logout(p_member_id uuid, p_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_admin_member_id uuid;
begin
  select m."Id" into v_admin_member_id
  from public."Members" m
  where m."UserId" = auth.uid()
    and m."IsDeleted" = false
    and m."Role" = 'admin'
  limit 1;

  if v_admin_member_id is null then
    raise exception 'Forbidden: admin only';
  end if;

  insert into public."ForceLogoutRequests" ("MemberId", "RequestedByMemberId", "Reason")
  values (p_member_id, v_admin_member_id, p_reason);

  return jsonb_build_object('success', true, 'message', 'Force logout requested');
end;
$$;


--
-- Name: force_user_logout(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.force_user_logout(p_member_id uuid, p_reason text DEFAULT NULL::text, p_admin_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Get admin ID from current user if not provided
    IF p_admin_id IS NULL THEN
        SELECT "Id" INTO v_admin_id
        FROM "Members"
        WHERE "UserId" = auth.uid() AND "IsDeleted" = false;
    ELSE
        v_admin_id := p_admin_id;
    END IF;

    -- Update or insert force logout record
    INSERT INTO "MemberForceLogout" ("MemberId", "ForceLogout", "Reason", "RequestedBy", "RequestedAt")
    VALUES (p_member_id, true, p_reason, v_admin_id, now())
    ON CONFLICT ("MemberId")
    DO UPDATE SET
        "ForceLogout" = true,
        "Reason" = p_reason,
        "RequestedBy" = v_admin_id,
        "RequestedAt" = now(),
        "AcknowledgedAt" = NULL;

    -- Insert audit history
    INSERT INTO "MemberActionHistory" ("MemberId", "ActionType", "ActionDetails", "PerformedBy")
    VALUES (p_member_id, 'force_logout', json_build_object('reason', p_reason), v_admin_id);

    RETURN json_build_object('success', true, 'message', 'Force logout initiated successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;


--
-- Name: generate_invoice_for_cycle(text, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_for_cycle(p_subject_type text, p_subject_id uuid, p_billing_cycle_id uuid, p_created_by text DEFAULT 'system'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: generate_message_snippet(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_message_snippet(text_body text, max_length integer DEFAULT 150) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
    IF text_body IS NULL OR text_body = '' THEN
        RETURN '';
    END IF;

    IF LENGTH(text_body) <= max_length THEN
        RETURN text_body;
    ELSE
        RETURN SUBSTRING(text_body, 1, max_length) || '...';
    END IF;
END;
$$;


--
-- Name: get_active_member_plan(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_member_plan(p_member_id uuid, p_at timestamp with time zone DEFAULT now()) RETURNS TABLE(member_plan_id uuid, member_id uuid, plan_id uuid, pricing_model text, price numeric, min_monthly_fee numeric, price_per_booking numeric, listing_limit integer, booking_limit integer, duration_days integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: get_active_plan_assignment(text, uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_plan_assignment(p_subject_type text, p_subject_id uuid, p_at timestamp with time zone DEFAULT now()) RETURNS TABLE(assignment_id uuid, subject_type text, subject_id uuid, plan_id uuid, pricing_model text, price numeric, min_monthly_fee numeric, price_per_booking numeric, listing_limit integer, booking_limit integer, duration_days integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: FUNCTION get_active_plan_assignment(p_subject_type text, p_subject_id uuid, p_at timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_active_plan_assignment(p_subject_type text, p_subject_id uuid, p_at timestamp with time zone) IS 'Active plan for a billing subject (member or company).';


--
-- Name: get_active_users_count(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_users_count(days_back integer DEFAULT 30) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_is_admin boolean := false;
  v_days int := coalesce(days_back, 30);
begin
  if v_days < 1 or v_days > 3650 then
    raise exception 'days_back must be between 1 and 3650';
  end if;

  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Forbidden: admin only';
  end if;

  return (
    select count(*)::bigint
    from auth.users u
    inner join public."Members" m on m."UserId" = u.id
    where m."IsDeleted" = false
      and u.last_sign_in_at is not null
      and u.last_sign_in_at >= timezone('utc', now()) - (v_days::text || ' days')::interval
  );
end;
$$;


--
-- Name: get_admin_company_edit_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_company_edit_stats(p_company_id uuid) RETURNS TABLE(active_owned_properties bigint, linked_users bigint, unpublished_or_inactive bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_is_admin boolean := false;
  v_total bigint;
  v_active bigint;
  v_linked bigint;
begin
  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Forbidden: admin only';
  end if;

  select count(*)::bigint
  into v_linked
  from public."CompanyMembers" cm
  where cm."CompanyId" = p_company_id
    and cm."IsDeleted" = false;

  with latest_listing as (
    select distinct on (l."EstatePropertyId")
      l."EstatePropertyId",
      l."IsActive",
      l."IsPropertyVisible"
    from public."Listings" l
    where l."IsDeleted" = false
    order by l."EstatePropertyId", l."Created" desc
  ),
  company_props as (
    select ep."Id"
    from public."EstateProperties" ep
    join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and o."OwnerType" = 'company'
      and o."CompanyId" = p_company_id
  )
  select
    (select count(*)::bigint from company_props),
    (
      select count(*)::bigint
      from company_props cp
      join latest_listing ll on ll."EstatePropertyId" = cp."Id"
      where ll."IsActive" = true
        and ll."IsPropertyVisible" = true
    )
  into v_total, v_active;

  return query
  select
    coalesce(v_active, 0)::bigint as active_owned_properties,
    coalesce(v_linked, 0)::bigint as linked_users,
    greatest(coalesce(v_total, 0) - coalesce(v_active, 0), 0)::bigint as unpublished_or_inactive;
end;
$$;


--
-- Name: get_admin_dashboard_stats(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_dashboard_stats(period text DEFAULT '30d'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_is_admin boolean := false;
  v_users bigint;
  v_properties bigint;
  v_active_users bigint;
  v_now timestamptz := timezone('utc', now());
  v_7d timestamptz := v_now - interval '7 days';
  v_30d timestamptz := v_now - interval '30 days';
  v_active_properties int;
  v_new_users_7d bigint;
  v_new_users_30d bigint;
  v_new_props_7d bigint;
  v_new_props_30d bigint;
  v_users_without_properties bigint;
begin
  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Forbidden: admin only';
  end if;

  select count(*) into v_users from public."Members" where "IsDeleted" = false;
  select count(*) into v_properties from public."EstateProperties" where "IsDeleted" = false;

  select count(*)::bigint into v_active_users
  from auth.users u
  inner join public."Members" m on m."UserId" = u.id
  where m."IsDeleted" = false
    and u.last_sign_in_at is not null
    and u.last_sign_in_at >= timezone('utc', now()) - interval '30 days';

  select count(distinct "EstatePropertyId")::int into v_active_properties
  from public."Listings"
  where "IsDeleted" = false
    and "IsActive" = true
    and "IsPropertyVisible" = true;

  select count(*) into v_new_users_7d
  from public."Members"
  where "IsDeleted" = false
    and "Created" >= v_7d
    and "Created" <= v_now;

  select count(*) into v_new_users_30d
  from public."Members"
  where "IsDeleted" = false
    and "Created" >= v_30d
    and "Created" <= v_now;

  select count(*)::bigint into v_new_props_7d
  from public."EstateProperties"
  where "IsDeleted" = false
    and "Created" >= v_7d
    and "Created" <= v_now;

  select count(*)::bigint into v_new_props_30d
  from public."EstateProperties"
  where "IsDeleted" = false
    and "Created" >= v_30d
    and "Created" <= v_now;

  select count(*)::bigint into v_users_without_properties
  from public."Members" m
  where m."IsDeleted" = false
    and not exists (
      select 1
      from public."EstateProperties" ep
      inner join public."Owners" o on o."Id" = ep."OwnerId"
      where ep."IsDeleted" = false
        and o."IsDeleted" = false
        and o."OwnerType" = 'member'
        and o."MemberId" = m."Id"
    );

  return json_build_object(
    'propertiesCount', v_properties,
    'usersCount', v_users,
    'activeUsers', v_active_users,
    'inactiveUsers', greatest(v_users - coalesce(v_active_users, 0), 0),
    'activeProperties', coalesce(v_active_properties, 0),
    'archivedProperties', greatest(v_properties - coalesce(v_active_properties, 0), 0),
    'subscriptionStats', json_build_object(
      'withoutSubscription', 0,
      'active', 0,
      'expired', 0
    ),
    'mrr', 0,
    'growth', json_build_object(
      'newUsers7d', v_new_users_7d,
      'newUsers30d', v_new_users_30d,
      'newProperties7d', v_new_props_7d,
      'newProperties30d', v_new_props_30d
    ),
    'usageStats', json_build_object(
      'avgPropertiesPerUser',
      case
        when v_users > 0 then (v_properties::numeric / v_users::numeric)
        else 0::numeric
      end,
      'usersWithoutProperties', coalesce(v_users_without_properties, 0)
    )
  );
end;
$$;


--
-- Name: get_admin_guest_detail(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_guest_detail(p_guest_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_is_admin boolean := false;
  v_row record;
  v_bookings_count bigint;
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

  select
    g."Id",
    g."FirstName",
    g."LastName",
    g."Email",
    g."PhoneNumber",
    g."Created",
    g."LastModified"
  into v_row
  from public."Guests" g
  where g."Id" = p_guest_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Guest not found');
  end if;

  select count(*)::bigint
  into v_bookings_count
  from public."Bookings" b
  where b."GuestId" = p_guest_id
    and b."IsDeleted" = false;

  return jsonb_build_object(
    'success', true,
    'guest', jsonb_build_object(
      'id', v_row."Id",
      'firstName', v_row."FirstName",
      'lastName', v_row."LastName",
      'email', v_row."Email",
      'phoneNumber', v_row."PhoneNumber",
      'created', v_row."Created",
      'lastModified', v_row."LastModified",
      'bookingsCount', v_bookings_count
    )
  );
end;
$$;


--
-- Name: get_admin_guests_list(integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_guests_list(p_page integer DEFAULT 1, p_limit integer DEFAULT 20, p_search text DEFAULT NULL::text) RETURNS TABLE(id uuid, first_name text, last_name text, email text, phone_number text, created timestamp with time zone, bookings_count bigint, total_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_is_admin boolean := false;
  v_offset int;
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_lim int := greatest(least(coalesce(p_limit, 20), 200), 1);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
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
      g."Id" as gid,
      g."FirstName" as fn,
      g."LastName" as ln,
      g."Email" as em,
      g."PhoneNumber" as ph,
      g."Created" as cr,
      (
        select count(*)::bigint
        from public."Bookings" b
        where b."GuestId" = g."Id"
          and b."IsDeleted" = false
      ) as bc
    from public."Guests" g
    where (
      v_search is null
      or g."Email" ilike '%' || v_search || '%'
      or g."FirstName" ilike '%' || v_search || '%'
      or g."LastName" ilike '%' || v_search || '%'
      or g."PhoneNumber" ilike '%' || v_search || '%'
      or (g."FirstName" || ' ' || g."LastName") ilike '%' || v_search || '%'
    )
  ),
  counted as (
    select count(*)::bigint as tc from base
  )
  select
    b.gid,
    b.fn,
    b.ln,
    b.em,
    b.ph,
    b.cr,
    b.bc,
    c.tc
  from base b
  cross join counted c
  order by b.cr desc
  offset v_offset
  limit v_lim;
end;
$$;


--
-- Name: get_admin_logs_for_date(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_logs_for_date(p_date date) RETURNS TABLE(event_type text, action text, at timestamp with time zone, target_id uuid, target_display text, performed_by_display text, details jsonb)
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  select event_type, action, at, target_id, target_display, performed_by_display, details
  from (
    select
      'user'::text as event_type,
      mah."ActionType"::text as action,
      mah."PerformedAt" as at,
      mah."MemberId" as target_id,
      trim(coalesce(t."FirstName", '') || ' ' || coalesce(t."LastName", ''))
        || coalesce(' <' || nullif(trim(t."Email"), '') || '>', '') as target_display,
      coalesce(
        nullif(trim(coalesce(p."FirstName", '') || ' ' || coalesce(p."LastName", '')), ''),
        nullif(trim(p."Email"), ''),
        mah."PerformedBy"::text,
        'Unknown User'
      ) as performed_by_display,
      mah."ActionDetails" as details
    from public."MemberActionHistory" mah
    join public."Members" t on t."Id" = mah."MemberId" and t."IsDeleted" = false
    left join public."Members" p on p."Id" = mah."PerformedBy" and p."IsDeleted" = false
    where mah."IsDeleted" = false
      and mah."PerformedAt" >= p_date::timestamptz
      and mah."PerformedAt" < (p_date + interval '1 day')::timestamptz

    union all

    select
      'property'::text as event_type,
      pma."ActionType"::text as action,
      pma."PerformedAt" as at,
      pma."PropertyId" as target_id,
      coalesce(ll."Title", '') as target_display,
      coalesce(
        nullif(trim(coalesce(m."FirstName", '') || ' ' || coalesce(m."LastName", '')), ''),
        nullif(trim(m."Email"), ''),
        pma."PerformedBy"::text,
        'Unknown User'
      ) as performed_by_display,
      jsonb_build_object('reason', pma."Reason") as details
    from public."PropertyModerationActions" pma
    join public."EstateProperties" ep
      on ep."Id" = pma."PropertyId" and ep."IsDeleted" = false
    left join lateral (
      select l."Title"
      from public."Listings" l
      where l."EstatePropertyId" = pma."PropertyId" and l."IsDeleted" = false
      order by l."Created" desc
      limit 1
    ) ll on true
    left join public."Members" m
      on m."UserId" = pma."PerformedBy" and m."IsDeleted" = false
    where pma."IsDeleted" = false
      and pma."PerformedAt" >= p_date::timestamptz
      and pma."PerformedAt" < (p_date + interval '1 day')::timestamptz

    union all

    select
      'booking'::text as event_type,
      'created'::text as action,
      b."Created" as at,
      b."Id" as target_id,
      'Booking ' || b."Id"::text as target_display,
      coalesce(
        nullif(trim(coalesce(mc_id."FirstName", '') || ' ' || coalesce(mc_id."LastName", '')), ''),
        nullif(trim(mc_id."Email"), ''),
        nullif(trim(coalesce(mc_user."FirstName", '') || ' ' || coalesce(mc_user."LastName", '')), ''),
        nullif(trim(mc_user."Email"), ''),
        nullif(b."CreatedBy", ''),
        'Unknown User'
      ) as performed_by_display,
      jsonb_build_object('estatePropertyId', b."EstatePropertyId", 'checkIn', b."CheckInDate", 'checkOut', b."CheckOutDate") as details
    from public."Bookings" b
    left join public."Members" mc_id
      on mc_id."Id"::text = b."CreatedBy" and mc_id."IsDeleted" = false
    left join public."Members" mc_user
      on mc_user."UserId"::text = b."CreatedBy" and mc_user."IsDeleted" = false
    where b."IsDeleted" = false
      and b."Created" >= p_date::timestamptz
      and b."Created" < (p_date + interval '1 day')::timestamptz

    union all

    select
      'booking'::text as event_type,
      'updated'::text as action,
      b."LastModified" as at,
      b."Id" as target_id,
      'Booking ' || b."Id"::text as target_display,
      coalesce(
        nullif(trim(coalesce(mu_id."FirstName", '') || ' ' || coalesce(mu_id."LastName", '')), ''),
        nullif(trim(mu_id."Email"), ''),
        nullif(trim(coalesce(mu_user."FirstName", '') || ' ' || coalesce(mu_user."LastName", '')), ''),
        nullif(trim(mu_user."Email"), ''),
        nullif(b."LastModifiedBy", ''),
        'Unknown User'
      ) as performed_by_display,
      jsonb_build_object('estatePropertyId', b."EstatePropertyId", 'checkIn', b."CheckInDate", 'checkOut', b."CheckOutDate") as details
    from public."Bookings" b
    left join public."Members" mu_id
      on mu_id."Id"::text = b."LastModifiedBy" and mu_id."IsDeleted" = false
    left join public."Members" mu_user
      on mu_user."UserId"::text = b."LastModifiedBy" and mu_user."IsDeleted" = false
    where b."IsDeleted" = false
      and b."LastModified" >= p_date::timestamptz
      and b."LastModified" < (p_date + interval '1 day')::timestamptz
      and b."LastModified" <> b."Created"
  ) logs
  order by at desc;
$$;


--
-- Name: FUNCTION get_admin_logs_for_date(p_date date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_admin_logs_for_date(p_date date) IS 'Returns admin audit events for a given date: user actions (MemberActionHistory), property moderation (PropertyModerationActions), and booking created/updated. Caller must be admin (RLS on underlying tables).';


--
-- Name: get_admin_properties_list(integer, integer, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_properties_list(p_page integer DEFAULT 1, p_limit integer DEFAULT 10, p_user_id uuid DEFAULT NULL::uuid, p_location text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_offer_kind text DEFAULT NULL::text) RETURNS TABLE(id uuid, title character varying, owner_name text, owner_email character varying, city character varying, state character varying, status integer, is_active boolean, is_property_visible boolean, created timestamp with time zone, last_modified timestamp with time zone, property_types_summary text, total_count bigint)
    LANGUAGE plpgsql
    AS $$
begin
  return query
  with latest_listing as (
    select distinct on (l."EstatePropertyId")
      l."EstatePropertyId",
      l."Title",
      l."Status",
      l."IsActive",
      l."IsPropertyVisible"
    from public."Listings" l
    where l."IsDeleted" = false
    order by l."EstatePropertyId", l."Created" desc
  ),
  filtered_properties as (
    select
      ep."Id",
      ll."Title" as "Title",
      case
        when o."OwnerType" = 'member' then concat(m."FirstName", ' ', m."LastName")
        when o."OwnerType" = 'company' then c."Name"
        else 'Unknown Owner'
      end as owner_name,
      case
        when o."OwnerType" = 'member' then m."Email"
        when o."OwnerType" = 'company' then c."BillingEmail"
        else null
      end as owner_email,
      ep."City",
      ep."State",
      ll."Status",
      ll."IsActive",
      ll."IsPropertyVisible",
      coalesce(re."Created", ev."Created", sr."Created") as "Created",
      coalesce(re."LastModified", ev."LastModified", sr."LastModified") as "LastModified",
      nullif(
        trim(both from concat_ws(', ',
          case when exists (
            select 1
            from public."Listings" lx
            where lx."EstatePropertyId" = ep."Id"
              and lx."IsDeleted" = false
              and lx."ListingType" = 'RealEstate'::public."ListingType"
          ) then 'En venta' end,
          case when exists (
            select 1
            from public."Listings" lx
            where lx."EstatePropertyId" = ep."Id"
              and lx."IsDeleted" = false
              and lx."ListingType" = 'AnnualRent'::public."ListingType"
          ) then 'En alquiler' end,
          case when
            exists (select 1 from public."SummerRentExtension" sx where sx."EstatePropertyId" = ep."Id")
            or exists (
              select 1
              from public."Listings" lx
              where lx."EstatePropertyId" = ep."Id"
                and lx."IsDeleted" = false
                and lx."ListingType" = 'SummerRent'::public."ListingType"
            )
          then 'Alquiler de temporada' end,
          case when
            exists (select 1 from public."EventVenueExtension" ex where ex."EstatePropertyId" = ep."Id")
            or exists (
              select 1
              from public."Listings" lx
              where lx."EstatePropertyId" = ep."Id"
                and lx."IsDeleted" = false
                and lx."ListingType" = 'EventVenue'::public."ListingType"
            )
          then 'Eventos' end
        )),
        ''
      ) as property_types_summary
    from public."EstateProperties" ep
    join latest_listing ll on ep."Id" = ll."EstatePropertyId"
    join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
    left join public."Members" m on o."OwnerType" = 'member' and o."MemberId" = m."Id" and m."IsDeleted" = false
    left join public."Companies" c on o."OwnerType" = 'company' and o."CompanyId" = c."Id" and c."IsDeleted" = false
    left join public."RealEstateExtension" re on re."EstatePropertyId" = ep."Id"
    left join public."EventVenueExtension" ev on ev."EstatePropertyId" = ep."Id"
    left join public."SummerRentExtension" sr on sr."EstatePropertyId" = ep."Id"
    where ep."IsDeleted" = false
      and (
        p_user_id is null
        or (
          (o."OwnerType" = 'member' and o."MemberId" = p_user_id)
          or (
            o."OwnerType" = 'company'
            and exists (
              select 1
              from public."CompanyMembers" cm
              where cm."CompanyId" = o."CompanyId"
                and cm."MemberId" = p_user_id
                and cm."IsDeleted" = false
            )
          )
        )
      )
      and (
        p_offer_kind is null
        or p_offer_kind not in ('real_estate', 'annual_rent', 'summer_rent', 'event_venue')
        or (
          (p_offer_kind = 'real_estate' and exists (
            select 1
            from public."Listings" lx
            where lx."EstatePropertyId" = ep."Id"
              and lx."IsDeleted" = false
              and lx."ListingType" = 'RealEstate'::public."ListingType"
          ))
          or (p_offer_kind = 'annual_rent' and exists (
            select 1
            from public."Listings" lx
            where lx."EstatePropertyId" = ep."Id"
              and lx."IsDeleted" = false
              and lx."ListingType" = 'AnnualRent'::public."ListingType"
          ))
          or (p_offer_kind = 'summer_rent' and (
            exists (
              select 1
              from public."SummerRentExtension" sx
              where sx."EstatePropertyId" = ep."Id"
            )
            or exists (
              select 1
              from public."Listings" lx
              where lx."EstatePropertyId" = ep."Id"
                and lx."IsDeleted" = false
                and lx."ListingType" = 'SummerRent'::public."ListingType"
            )
          ))
          or (p_offer_kind = 'event_venue' and (
            exists (
              select 1
              from public."EventVenueExtension" ex
              where ex."EstatePropertyId" = ep."Id"
            )
            or exists (
              select 1
              from public."Listings" lx
              where lx."EstatePropertyId" = ep."Id"
                and lx."IsDeleted" = false
                and lx."ListingType" = 'EventVenue'::public."ListingType"
            )
          ))
        )
      )
      and (
        p_location is null
        or ep."City" ilike '%' || p_location || '%'
        or ep."State" ilike '%' || p_location || '%'
        or concat(ep."City", ', ', ep."State") ilike '%' || p_location || '%'
      )
      and (
        p_search is null
        or ll."Title" ilike '%' || p_search || '%'
        or case
          when o."OwnerType" = 'member' then concat(m."FirstName", ' ', m."LastName")
          when o."OwnerType" = 'company' then c."Name"
          else ''
        end ilike '%' || p_search || '%'
        or ep."City" ilike '%' || p_search || '%'
        or ep."State" ilike '%' || p_search || '%'
      )
    order by coalesce(re."Created", ev."Created", sr."Created") desc
  ),
  total_count as (
    select count(*)::bigint as count
    from filtered_properties
  )
  select
    fp."Id",
    fp."Title"::character varying,
    fp.owner_name,
    fp.owner_email::character varying,
    fp."City"::character varying,
    fp."State"::character varying,
    fp."Status",
    fp."IsActive",
    fp."IsPropertyVisible",
    fp."Created",
    fp."LastModified",
    fp.property_types_summary,
    tc.count
  from filtered_properties fp
  cross join total_count tc
  limit p_limit
  offset ((p_page - 1) * p_limit);
end;
$$;


--
-- Name: get_admin_property_detail(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_property_detail(p_property_id uuid) RETURNS TABLE(id uuid, street_name character varying, house_number character varying, neighborhood character varying, city character varying, state character varying, zip_code character varying, country character varying, location_latitude numeric, location_longitude numeric, category integer, area_value numeric, area_unit integer, bedrooms integer, bathrooms integer, garage_spaces integer, haslaundryroom boolean, haspool boolean, hasbalcony boolean, isfurnished boolean, capacity integer, location_category integer, view_type integer, owner_id uuid, allowsfinancing boolean, isnewconstruction boolean, hasmortgage boolean, hoafees numeric, mincontractmonths integer, requiresguarantee boolean, guaranteetype text, allowspets boolean, maxguests integer, hascatering boolean, hassoundsystem boolean, closinghour text, allowedeventsdescription text, minstaydays integer, maxstaydays integer, leadtimedays integer, bufferdays integer, isdeleted boolean, created timestamp with time zone, createdby text, lastmodified timestamp with time zone, lastmodifiedby text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        ep."Id",
        ep."StreetName"::character varying,
        ep."HouseNumber"::character varying,
        ep."Neighborhood"::character varying,
        ep."City"::character varying,
        ep."State"::character varying,
        ep."ZipCode"::character varying,
        ep."Country"::character varying,
        ep."LocationLatitude",
        ep."LocationLongitude",
        CASE re."Category"
            WHEN 'Casa'::public."PropertyCategory" THEN 0
            WHEN 'Apartamento'::public."PropertyCategory" THEN 1
            WHEN 'Terreno'::public."PropertyCategory" THEN 2
            WHEN 'Chacra'::public."PropertyCategory" THEN 3
            WHEN 'Campo'::public."PropertyCategory" THEN 4
            ELSE NULL
        END,
        ep."AreaValue",
        ep."AreaUnit",
        ep."Bedrooms",
        ep."Bathrooms",
        ep."GarageSpaces",
        ep."HasLaundryRoom",
        ep."HasPool",
        ep."HasBalcony",
        ep."IsFurnished",
        ep."Capacity",
        CASE ep."LocationCategory"
            WHEN 'rural'::public."LocationCategory" THEN 0
            WHEN 'city'::public."LocationCategory" THEN 1
            WHEN 'near_shore'::public."LocationCategory" THEN 2
            ELSE NULL
        END,
        CASE ep."ViewType"
            WHEN 'city'::public."ViewType" THEN 0
            WHEN 'mountain'::public."ViewType" THEN 1
            WHEN 'rural'::public."ViewType" THEN 2
            WHEN 'sea'::public."ViewType" THEN 3
            ELSE NULL
        END,
        ep."OwnerId",
        re."AllowsFinancing",
        re."IsNewConstruction",
        re."HasMortgage",
        re."HOAFees",
        re."MinContractMonths",
        re."RequiresGuarantee",
        re."GuaranteeType",
        re."AllowsPets",
        ev."MaxGuests",
        ev."HasCatering",
        ev."HasSoundSystem",
        ev."ClosingHour"::text,
        ev."AllowedEventsDescription",
        sr."MinStayDays",
        sr."MaxStayDays",
        sr."LeadTimeDays",
        sr."BufferDays",
        ep."IsDeleted",
        COALESCE(re."Created", ev."Created", sr."Created"),
        COALESCE(re."CreatedBy", ev."CreatedBy", sr."CreatedBy"),
        COALESCE(re."LastModified", ev."LastModified", sr."LastModified"),
        COALESCE(re."LastModifiedBy", ev."LastModifiedBy", sr."LastModifiedBy")
    FROM "EstateProperties" ep
    LEFT JOIN "RealEstateExtension" re ON re."EstatePropertyId" = ep."Id"
    LEFT JOIN "EventVenueExtension" ev ON ev."EstatePropertyId" = ep."Id"
    LEFT JOIN "SummerRentExtension" sr ON sr."EstatePropertyId" = ep."Id"
    WHERE ep."Id" = p_property_id
      AND ep."IsDeleted" = false;
END;
$$;


--
-- Name: get_admin_property_statistics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_property_statistics() RETURNS TABLE(total_properties bigint, unpublished_properties bigint, active_properties bigint, archived_properties bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_is_admin boolean := false;
  v_total bigint;
  v_active bigint;
begin
  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Forbidden: admin only';
  end if;

  select count(*)::bigint
  into v_total
  from public."EstateProperties" ep
  where ep."IsDeleted" = false;

  select count(distinct l."EstatePropertyId")::bigint
  into v_active
  from public."Listings" l
  where l."IsDeleted" = false
    and l."IsActive" = true
    and l."IsPropertyVisible" = true;

  return query
  with latest_listing as (
    select distinct on (l."EstatePropertyId")
      l."EstatePropertyId",
      l."IsPropertyVisible"
    from public."Listings" l
    where l."IsDeleted" = false
    order by l."EstatePropertyId", l."Created" desc
  )
  select
    v_total as total_properties,
    (
      select count(*)::bigint
      from public."EstateProperties" ep
      left join latest_listing ll
        on ll."EstatePropertyId" = ep."Id"
      where ep."IsDeleted" = false
        and coalesce(ll."IsPropertyVisible", false) = false
    ) as unpublished_properties,
    coalesce(v_active, 0) as active_properties,
    greatest(v_total - coalesce(v_active, 0), 0) as archived_properties;
end;
$$;


--
-- Name: get_admin_property_views_summary(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_property_views_summary(p_period_7d text DEFAULT NULL::text, p_period_30d text DEFAULT NULL::text) RETURNS TABLE("totalPropertyViews" bigint, "viewsLast7Days" bigint, "viewsLast30Days" bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_is_admin boolean := false;
begin
  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Forbidden: admin only';
  end if;

  return query
  select
    (
      select count(*)::bigint
      from public."PropertyVisitLogs" pvl
      join public."EstateProperties" ep
        on ep."Id" = pvl."PropertyId"
       and ep."IsDeleted" = false
    ) as "totalPropertyViews",
    (
      select count(*)::bigint
      from public."PropertyVisitLogs" pvl
      join public."EstateProperties" ep
        on ep."Id" = pvl."PropertyId"
       and ep."IsDeleted" = false
      where pvl."VisitedOnUtc" >= (timezone('utc', now()) - interval '7 days')
    ) as "viewsLast7Days",
    (
      select count(*)::bigint
      from public."PropertyVisitLogs" pvl
      join public."EstateProperties" ep
        on ep."Id" = pvl."PropertyId"
       and ep."IsDeleted" = false
      where pvl."VisitedOnUtc" >= (timezone('utc', now()) - interval '30 days')
    ) as "viewsLast30Days";
end;
$$;


--
-- Name: get_admin_user_detail(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_user_detail(p_user_id uuid) RETURNS TABLE(id uuid, user_id uuid, first_name text, last_name text, email text, avatar_url text, phone text, street text, street2 text, city text, state text, postal_code text, country text, role text, subscription_status text, subscription_tier integer, subscription_expires_at timestamp with time zone, account_status text, registration_date timestamp with time zone, last_login timestamp with time zone, properties_count bigint, payment_status text, onboarding_step integer, onboarding_complete boolean, action_history jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_internal.require_admin();

  return query
  select
    m."Id",
    m."UserId",
    m."FirstName"::text,
    m."LastName"::text,
    m."Email"::text,
    m."AvatarUrl"::text,
    m."Phone"::text,
    m."Street"::text,
    m."Street2"::text,
    m."City"::text,
    m."State"::text,
    m."PostalCode"::text,
    m."Country"::text,
    m."Role"::text,
    'none'::text as subscription_status,
    null::integer as subscription_tier,
    null::timestamptz as subscription_expires_at,
    (
      case
        when m."IsDeleted" then 'deleted'
        when u.banned_until is not null and u.banned_until > timezone('utc', now()) then 'suspended'
        else 'active'
      end
    )::text as account_status,
    m."Created"::timestamptz as registration_date,
    u.last_sign_in_at::timestamptz as last_login,
    0::bigint as properties_count,
    'none'::text as payment_status,
    coalesce(m."OnboardingStep", 0)::integer as onboarding_step,
    coalesce(m."OnboardingComplete", false) as onboarding_complete,
    '[]'::jsonb as action_history
  from public."Members" m
  join auth.users u on u.id = m."UserId"
  where m."Id" = p_user_id
  limit 1;
end;
$$;


--
-- Name: get_admin_users_list(integer, integer, text, integer, text, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_users_list(p_page integer DEFAULT 1, p_limit integer DEFAULT 20, p_subscription_status text DEFAULT NULL::text, p_subscription_tier integer DEFAULT NULL::integer, p_account_status text DEFAULT NULL::text, p_registration_date_from date DEFAULT NULL::date, p_registration_date_to date DEFAULT NULL::date, p_search text DEFAULT NULL::text) RETURNS TABLE(id uuid, user_id uuid, first_name text, last_name text, email text, avatar_url text, role text, subscription_status text, subscription_tier integer, subscription_expires_at timestamp with time zone, account_status text, registration_date timestamp with time zone, last_login timestamp with time zone, properties_count bigint, payment_status text, total_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: get_app_parameters(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_app_parameters(p_site_scope text DEFAULT 'global'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_scope text := coalesce(nullif(trim(p_site_scope), ''), 'global');
  v_result jsonb := '{}'::jsonb;
  v_row record;
begin
  if v_scope not in ('global', 'SummerRent', 'EventVenue') then
    v_scope := 'global';
  end if;

  for v_row in
    select ap."Name", ap."Value"
    from public."AppParameters" ap
    where ap."IsDeleted" = false
      and ap."IsActive" = true
      and ap."SiteScope" = 'global'
    order by ap."Name"
  loop
    v_result := v_result || jsonb_build_object(v_row."Name", v_row."Value");
  end loop;

  if v_scope <> 'global' then
    for v_row in
      select ap."Name", ap."Value"
      from public."AppParameters" ap
      where ap."IsDeleted" = false
        and ap."IsActive" = true
        and ap."SiteScope" = v_scope
      order by ap."Name"
    loop
      v_result := v_result || jsonb_build_object(v_row."Name", v_row."Value");
    end loop;
  end if;

  return v_result;
end;
$$;


--
-- Name: FUNCTION get_app_parameters(p_site_scope text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_app_parameters(p_site_scope text) IS 'Returns merged app parameter map (global + site scope; site overrides).';


--
-- Name: get_booking_by_manage_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_booking_by_manage_token(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_token_hash text;
  v_booking_id uuid;
  v_row record;
  v_status text;
  v_host_contact jsonb := jsonb_build_object('name', null, 'email', null, 'phone', null);
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('success', false, 'error', 'Missing token');
  end if;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  select t.booking_id
  into v_booking_id
  from public.booking_manage_tokens t
  where t.token_hash = v_token_hash
    and t.revoked_at is null
    and t.expires_at > now()
  limit 1;

  if v_booking_id is null then
    return jsonb_build_object('success', false, 'error', 'Invalid or expired token');
  end if;

  update public.booking_manage_tokens
  set last_used_at = now()
  where token_hash = v_token_hash;

  select
    b."Id" as booking_id,
    b."ReservationCode" as reservation_code,
    b."EstatePropertyId" as property_id,
    l."Title" as property_title,
    b."CheckInDate" as check_in,
    b."CheckOutDate" as check_out,
    b."GuestCount" as guests,
    b."Status" as status_code
  into v_row
  from public."Bookings" b
  left join lateral (
    select l2."Title"
    from public."Listings" l2
    where l2."EstatePropertyId" = b."EstatePropertyId"
      and l2."IsDeleted" = false
    order by l2."IsActive" desc nulls last, l2."Created" desc nulls last
    limit 1
  ) l on true
  where b."Id" = v_booking_id
    and b."IsDeleted" = false;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  v_status := case v_row.status_code
    when 0 then 'pending'
    when 1 then 'confirmed'
    when 2 then 'cancelled'
    when 3 then 'completed'
    else 'unknown'
  end;

  if v_row.status_code in (1, 3) then
    v_host_contact := public.resolve_host_contact_for_property(v_row.property_id);
  end if;

  return jsonb_build_object(
    'success', true,
    'booking', jsonb_build_object(
      'bookingId', v_row.booking_id,
      'reservationCode', coalesce(v_row.reservation_code, ''),
      'propertyTitle', coalesce(v_row.property_title, 'Property'),
      'checkIn', v_row.check_in,
      'checkOut', v_row.check_out,
      'guests', v_row.guests,
      'status', v_status,
      'hostName', v_host_contact->>'name',
      'hostEmail', v_host_contact->>'email',
      'hostPhone', v_host_contact->>'phone',
      'canCancel', (v_row.status_code in (0, 1) and v_row.check_in >= current_date)
    )
  );
end;
$$;


--
-- Name: get_daily_dashboard_messages(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_daily_dashboard_messages(p_period text, p_company_id text DEFAULT NULL::text, p_user_id text DEFAULT NULL::text) RETURNS TABLE(date date, count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_current_start_date TIMESTAMP WITH TIME ZONE;
    v_current_end_date TIMESTAMP WITH TIME ZONE;
    v_user_companies UUID[];
    v_member_id UUID;
BEGIN
    -- Parse period to get date ranges (reuse same helper as get_dashboard_summary)
    SELECT start_date, end_date
    INTO v_current_start_date, v_current_end_date
    FROM parse_period(p_period);

    -- Resolve current member ID from user ID
    SELECT "Id"
    INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id::UUID
      AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Get accessible company IDs for the user (for property-related threads)
    IF p_company_id IS NOT NULL THEN
        -- If specific company requested, validate user has access
        SELECT ARRAY[uc."CompanyId"]
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = v_member_id
          AND uc."CompanyId" = p_company_id::UUID
          AND uc."IsDeleted" = false
        INTO v_user_companies;
    ELSE
        -- Get all accessible companies for the user
        SELECT ARRAY_AGG(uc."CompanyId")
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = v_member_id
          AND uc."IsDeleted" = false
        INTO v_user_companies;
    END IF;

    /*
      Messages metric (daily):
      For the current member, we count unique threads where the first
      message received by this user falls within the requested period.
      Threads may be direct (no PropertyId) or property-related. For
      property threads we respect company scoping via v_user_companies;
      direct threads are always included.
    */

    RETURN QUERY
    WITH member_threads AS (
        SELECT
            mt."Id" AS thread_id,
            MIN(mr."ReceivedAtUtc") AS first_received_at
        FROM "MessageRecipients" mr
        JOIN "Messages" m ON mr."MessageId" = m."Id"
        JOIN "MessageThreads" mt ON m."ThreadId" = mt."Id"
        LEFT JOIN "EstateProperties" ep ON mt."PropertyId" = ep."Id"
        WHERE mr."RecipientId" = v_member_id
          AND mr."IsDeleted" = false
          AND m."IsDeleted" = false
          AND mt."IsDeleted" = false
          AND (
                mt."PropertyId" IS NULL
                OR ep."OwnerId" = ANY(v_user_companies)
          )
        GROUP BY mt."Id"
    )
    SELECT
        (first_received_at::date) AS "date",
        COUNT(*) AS "count"
    FROM member_threads
    WHERE first_received_at >= v_current_start_date
      AND first_received_at <= v_current_end_date
    GROUP BY (first_received_at::date)
    ORDER BY (first_received_at::date);
END;
$$;


--
-- Name: get_dashboard_summary(text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_summary(p_period text DEFAULT 'last30days'::text, p_company_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_member_id uuid;
  v_start timestamptz;
  v_total_properties bigint := 0;
  v_visits bigint := 0;
begin
  select m."Id"
  into v_member_id
  from public."Members" m
  where m."UserId" = coalesce(p_user_id, auth.uid())
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    return jsonb_build_object(
      'visits', jsonb_build_object('currentPeriod', 0),
      'messages', jsonb_build_object('currentPeriod', 0),
      'totalProperties', jsonb_build_object('currentPeriod', 0),
      'propertiesNeedingAttention', '[]'::jsonb
    );
  end if;

  v_start := case
    when p_period = 'last7days' then timezone('utc', now()) - interval '7 days'
    when p_period = 'last90days' then timezone('utc', now()) - interval '90 days'
    when p_period = 'thisyear' then date_trunc('year', timezone('utc', now()))
    else timezone('utc', now()) - interval '30 days'
  end;

  with accessible_properties as (
    select ep."Id"
    from public."EstateProperties" ep
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and (
        (o."OwnerType" = 'member' and o."MemberId" = v_member_id)
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = v_member_id
              and cm."IsDeleted" = false
              and (p_company_id is null or cm."CompanyId" = p_company_id)
          )
        )
      )
      and (
        p_company_id is null
        or (o."OwnerType" = 'company' and o."CompanyId" = p_company_id)
      )
  )
  select count(*)::bigint into v_total_properties
  from accessible_properties;

  with accessible_properties as (
    select ep."Id"
    from public."EstateProperties" ep
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and (
        (o."OwnerType" = 'member' and o."MemberId" = v_member_id)
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = v_member_id
              and cm."IsDeleted" = false
              and (p_company_id is null or cm."CompanyId" = p_company_id)
          )
        )
      )
      and (
        p_company_id is null
        or (o."OwnerType" = 'company' and o."CompanyId" = p_company_id)
      )
  )
  select count(*)::bigint into v_visits
  from public."PropertyVisitLogs" pvl
  join accessible_properties ap
    on ap."Id" = pvl."PropertyId"
  where pvl."VisitedOnUtc" >= v_start;

  return jsonb_build_object(
    'visits', jsonb_build_object('currentPeriod', coalesce(v_visits, 0)),
    'messages', jsonb_build_object('currentPeriod', 0),
    'totalProperties', jsonb_build_object('currentPeriod', coalesce(v_total_properties, 0)),
    'propertiesNeedingAttention', '[]'::jsonb
  );
end;
$$;


--
-- Name: get_dashboard_views_timeseries(text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_views_timeseries(p_period text DEFAULT 'last30days'::text, p_company_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid) RETURNS TABLE(date date, count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_member_id uuid;
  v_start timestamptz;
begin
  select m."Id"
  into v_member_id
  from public."Members" m
  where m."UserId" = coalesce(p_user_id, auth.uid())
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    return;
  end if;

  v_start := case
    when p_period = 'last7days' then timezone('utc', now()) - interval '7 days'
    when p_period = 'last90days' then timezone('utc', now()) - interval '90 days'
    when p_period = 'thisyear' then date_trunc('year', timezone('utc', now()))
    else timezone('utc', now()) - interval '30 days'
  end;

  return query
  with accessible_properties as (
    select ep."Id"
    from public."EstateProperties" ep
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and (
        (o."OwnerType" = 'member' and o."MemberId" = v_member_id)
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = v_member_id
              and cm."IsDeleted" = false
              and (p_company_id is null or cm."CompanyId" = p_company_id)
          )
        )
      )
      and (
        p_company_id is null
        or (o."OwnerType" = 'company' and o."CompanyId" = p_company_id)
      )
  )
  select
    timezone('utc', pvl."VisitedOnUtc")::date as date,
    count(*)::bigint as count
  from public."PropertyVisitLogs" pvl
  join accessible_properties ap
    on ap."Id" = pvl."PropertyId"
  where pvl."VisitedOnUtc" >= v_start
  group by 1
  order by 1;
end;
$$;


--
-- Name: get_estate_property_editor_content(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_estate_property_editor_content(p_property_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_policies jsonb;
  v_sections jsonb;
begin
  if p_property_id is null then
    raise exception 'p_property_id is required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', epp."Id",
        'listingType', epp."ListingType",
        'title', public.sanitize_localized_text_json(epp."LocalizedTitle"),
        'description', public.sanitize_localized_text_json(epp."LocalizedDescription"),
        'displayOrder', epp."DisplayOrder"
      )
      order by epp."DisplayOrder", epp."Created"
    ),
    '[]'::jsonb
  )
  into v_policies
  from public."EstatePropertyPolicy" epp
  where epp."EstatePropertyId" = p_property_id
    and epp."IsDeleted" = false;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'propertyType', s.propertytype,
        'localizedName', public.sanitize_localized_text_json(s.localizedname),
        'localizedDescription', public.sanitize_localized_text_json(s.localizeddescription),
        'layoutType', s.layouttype,
        'layoutConfig', coalesce(s.layoutconfig, '{}'::jsonb),
        'displayOrder', s.displayorder,
        'propertyImageIds', coalesce(
          (
            select jsonb_agg(psi.propertyimageid order by psi.displayorder)
            from public.propertysectionimages psi
            where psi.sectionid = s.id
          ),
          '[]'::jsonb
        )
      )
      order by s.displayorder, s.createdat
    ),
    '[]'::jsonb
  )
  into v_sections
  from public.propertydetailssection s
  where s.propertyid = p_property_id
    and s.isdeleted = false;

  return jsonb_build_object(
    'policies', v_policies,
    'contentSections', v_sections
  );
end;
$$;


--
-- Name: get_guest_inbox_threads(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_guest_inbox_threads(p_user_id uuid, p_page integer DEFAULT 1, p_limit integer DEFAULT 50) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
    v_member_id uuid;
    v_result jsonb;
begin
    -- Resolve auth user to member
    select "Id" into v_member_id
    from "Members"
    where "UserId" = p_user_id
      and "IsDeleted" = false;

    if v_member_id is null then
        raise exception 'User not authenticated';
    end if;

    with thread_data as (
        select
            mt."Id" as thread_id,
            mt."PropertyId" as property_id,
            ep."Title" as property_title,
            coalesce(ep."City" || ', ' || ep."State", ep."City", '') as property_location,
            ep."OwnerId" as host_id,
            coalesce(mem_host."FirstName" || ' ' || mem_host."LastName", mem_host."FirstName", '') as host_name,
            max(m."CreatedAtUtc") as last_message_at
        from "MessageThreads" mt
        join "Messages" m on m."ThreadId" = mt."Id"
        left join "MessageRecipients" mr on mr."MessageId" = m."Id"
        left join "EstateProperties" ep on ep."Id" = mt."PropertyId"
        left join "Members" mem_host on mem_host."Id" = ep."OwnerId"
        where (m."SenderId" = v_member_id or mr."RecipientId" = v_member_id)
          -- guest-only: exclude threads where the member is the property owner/host
          and (ep."OwnerId" is null or ep."OwnerId" <> v_member_id)
          and mt."IsDeleted" = false
          and m."IsDeleted" = false
        group by
            mt."Id",
            mt."PropertyId",
            ep."Title",
            ep."City",
            ep."State",
            ep."OwnerId",
            mem_host."FirstName",
            mem_host."LastName"
    ),
    paged_threads as (
        select
            td.*,
            row_number() over (order by td.last_message_at desc) as rn
        from thread_data td
    )
    select jsonb_agg(
        jsonb_build_object(
            'threadId', pt.thread_id,
            'propertyId', pt.property_id,
            'propertyTitle', pt.property_title,
            'propertyLocation', pt.property_location,
            'otherParticipantId', pt.host_id,
            'otherParticipantName', pt.host_name,
            'lastMessageSnippet', (
                select generate_message_snippet(m2."Body", 120)
                from "Messages" m2
                where m2."ThreadId" = pt.thread_id
                  and m2."IsDeleted" = false
                order by m2."CreatedAtUtc" desc
                limit 1
            ),
            'lastMessageAt', pt.last_message_at,
            'unreadCount', (
                select count(*)
                from "Messages" m3
                join "MessageRecipients" mr2 on mr2."MessageId" = m3."Id"
                where m3."ThreadId" = pt.thread_id
                  and mr2."RecipientId" = v_member_id
                  and mr2."IsRead" = false
                  and mr2."IsArchived" = false
                  and mr2."IsDeleted" = false
            )
        )
    )
    into v_result
    from paged_threads pt
    where pt.rn > (coalesce(p_page, 1) - 1) * coalesce(p_limit, 50)
      and pt.rn <= coalesce(p_page, 1) * coalesce(p_limit, 50);

    if v_result is null then
        return '[]'::jsonb;
    end if;

    return v_result;
end;
$$;


--
-- Name: get_listing_daily_factors(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_listing_daily_factors(p_listing_id uuid, p_from date, p_to date) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', ldf."Date",
        'seasonFactor', ldf."SeasonFactor",
        'specialFactor', ldf."SpecialFactor",
        'demandFactor', ldf."DemandFactor",
        'demandScore', ldf."DemandScore"
      )
      order by ldf."Date"
    ),
    '[]'::jsonb
  )
  from public."ListingDailyFactors" ldf
  where ldf."ListingId" = p_listing_id
    and ldf."Date" >= p_from
    and ldf."Date" < p_to;
$$;


--
-- Name: get_message_by_id(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_message_by_id(p_message_id uuid, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_member_id UUID;
    v_result JSONB;
BEGIN
    -- Get member ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Get message with access control (user must be sender or recipient)
    SELECT jsonb_build_object(
        'id', m."Id",
        'threadId', m."ThreadId",
        'senderId', m."SenderId",
        'senderName', COALESCE(mem."FirstName" || ' ' || mem."LastName", mem."FirstName", ''),
        'recipientId', mr."RecipientId",
        'propertyId', mt."PropertyId",
        'propertyTitle', ep."Title",
        'subject', mt."Subject",
        'snippet', m."Snippet",
        'fullBody', m."Body",
        'createdAt', m."CreatedAtUtc",
        'isRead', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsRead" ELSE true END,
        'isReplied', CASE WHEN mr."RecipientId" = v_member_id THEN mr."HasBeenRepliedToByRecipient" ELSE false END,
        'isStarred', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsStarred" ELSE false END,
        'isArchived', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsArchived" ELSE false END
    ) INTO v_result
    FROM "Messages" m
    JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
    LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
    LEFT JOIN "Members" mem ON mem."Id" = m."SenderId"
    LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
    WHERE m."Id" = p_message_id
    AND (m."SenderId" = v_member_id OR mr."RecipientId" = v_member_id);

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Message not found or access denied';
    END IF;

    RETURN v_result;
END;
$$;


--
-- Name: get_message_counts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_message_counts(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_member_id UUID;
    v_inbox_count INTEGER := 0;
    v_starred_count INTEGER := 0;
    v_replied_count INTEGER := 0;
    v_archived_count INTEGER := 0;
    v_sent_count INTEGER := 0;
    v_trash_count INTEGER := 0;
BEGIN
    -- Get member ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RETURN jsonb_build_object(
            'inbox', 0, 'starred', 0, 'replied', 0, 'archived', 0, 'sent', 0, 'trash', 0
        );
    END IF;

    -- Count inbox (unread messages that are not archived and not deleted)
    SELECT COUNT(*) INTO v_inbox_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."IsArchived" = false
    AND mr."IsDeleted" = false
    AND mr."IsRead" = false;

    -- Count starred messages
    SELECT COUNT(*) INTO v_starred_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."IsStarred" = true
    AND mr."IsDeleted" = false;

    -- Count replied messages
    SELECT COUNT(*) INTO v_replied_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."HasBeenRepliedToByRecipient" = true
    AND mr."IsArchived" = false
    AND mr."IsDeleted" = false;

    -- Count archived messages
    SELECT COUNT(*) INTO v_archived_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."IsArchived" = true
    AND mr."IsDeleted" = false;

    -- Count sent messages
    SELECT COUNT(*) INTO v_sent_count
    FROM "Messages" m
    WHERE m."SenderId" = v_member_id;

    -- Count trash messages
    SELECT COUNT(*) INTO v_trash_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."IsDeleted" = true;

    RETURN jsonb_build_object(
        'inbox', v_inbox_count,
        'starred', v_starred_count,
        'replied', v_replied_count,
        'archived', v_archived_count,
        'sent', v_sent_count,
        'trash', v_trash_count
    );
END;
$$;


--
-- Name: get_messages(uuid, integer, integer, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_messages(p_user_id uuid, p_page integer DEFAULT 1, p_limit integer DEFAULT 15, p_filter text DEFAULT 'inbox'::text, p_query text DEFAULT NULL::text, p_property_id uuid DEFAULT NULL::uuid, p_sort_by text DEFAULT 'createdAt_desc'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_member_id uuid;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_limit integer := greatest(least(coalesce(p_limit, 15), 100), 1);
  v_offset integer;
  v_total bigint := 0;
  v_total_pages integer := 0;
begin
  v_offset := (v_page - 1) * v_limit;

  select m."Id"
  into v_member_id
  from public."Members" m
  where m."UserId" = coalesce(p_user_id, auth.uid())
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    return jsonb_build_object(
      'data', '[]'::jsonb,
      'total', 0,
      'page', v_page,
      'totalPages', 0
    );
  end if;

  with base as (
    select
      mr."MessageId",
      mr."RecipientId",
      mr."IsRead",
      mr."HasBeenRepliedToByRecipient",
      mr."IsStarred",
      mr."IsArchived",
      mr."IsDeleted" as recipient_deleted,
      msg."ThreadId",
      msg."SenderId",
      msg."PropertyId",
      msg."Subject",
      msg."Body",
      msg."Created",
      msg."IsDeleted" as message_deleted,
      sender."FirstName" as sender_first_name,
      sender."LastName" as sender_last_name,
      sender."Email" as sender_email,
      ll."Title" as property_title
    from public."MessageRecipients" mr
    join public."Messages" msg
      on msg."Id" = mr."MessageId"
    left join public."Members" sender
      on sender."Id" = msg."SenderId"
    left join lateral (
      select l."Title"
      from public."Listings" l
      where l."EstatePropertyId" = msg."PropertyId"
        and l."IsDeleted" = false
      order by l."Created" desc
      limit 1
    ) ll on true
    where mr."RecipientId" = v_member_id
      and coalesce(msg."IsDeleted", false) = false
      and (
        p_property_id is null
        or msg."PropertyId" = p_property_id
      )
      and (
        p_query is null
        or msg."Subject" ilike '%' || p_query || '%'
        or msg."Body" ilike '%' || p_query || '%'
        or coalesce(ll."Title", '') ilike '%' || p_query || '%'
      )
      and (
        p_filter = 'inbox'
        and coalesce(mr."IsDeleted", false) = false
        and coalesce(mr."IsArchived", false) = false
        or p_filter = 'archived'
        and coalesce(mr."IsArchived", false) = true
        and coalesce(mr."IsDeleted", false) = false
        or p_filter = 'starred'
        and coalesce(mr."IsStarred", false) = true
        and coalesce(mr."IsDeleted", false) = false
        or p_filter = 'replied'
        and coalesce(mr."HasBeenRepliedToByRecipient", false) = true
        and coalesce(mr."IsDeleted", false) = false
        or p_filter = 'trash'
        and coalesce(mr."IsDeleted", false) = true
        or p_filter = 'all'
      )
  ),
  counted as (
    select count(*)::bigint as total_rows
    from base
  ),
  paged as (
    select *
    from base
    order by
      case when p_sort_by = 'createdAt_asc' then "Created" end asc,
      case when p_sort_by <> 'createdAt_asc' then "Created" end desc
    limit v_limit
    offset v_offset
  )
  select total_rows into v_total from counted;

  v_total_pages := case
    when v_total = 0 then 0
    else ceil(v_total::numeric / v_limit::numeric)::integer
  end;

  return (
    with base as (
      select
        mr."MessageId",
        msg."ThreadId",
        msg."SenderId",
        msg."PropertyId",
        msg."Subject",
        msg."Body",
        msg."Created",
        mr."IsRead",
        mr."HasBeenRepliedToByRecipient",
        mr."IsStarred",
        mr."IsArchived",
        sender."FirstName" as sender_first_name,
        sender."LastName" as sender_last_name,
        sender."Email" as sender_email,
        ll."Title" as property_title
      from public."MessageRecipients" mr
      join public."Messages" msg
        on msg."Id" = mr."MessageId"
      left join public."Members" sender
        on sender."Id" = msg."SenderId"
      left join lateral (
        select l."Title"
        from public."Listings" l
        where l."EstatePropertyId" = msg."PropertyId"
          and l."IsDeleted" = false
        order by l."Created" desc
        limit 1
      ) ll on true
      where mr."RecipientId" = v_member_id
        and coalesce(msg."IsDeleted", false) = false
        and (
          p_property_id is null
          or msg."PropertyId" = p_property_id
        )
        and (
          p_query is null
          or msg."Subject" ilike '%' || p_query || '%'
          or msg."Body" ilike '%' || p_query || '%'
          or coalesce(ll."Title", '') ilike '%' || p_query || '%'
        )
        and (
          p_filter = 'inbox'
          and coalesce(mr."IsDeleted", false) = false
          and coalesce(mr."IsArchived", false) = false
          or p_filter = 'archived'
          and coalesce(mr."IsArchived", false) = true
          and coalesce(mr."IsDeleted", false) = false
          or p_filter = 'starred'
          and coalesce(mr."IsStarred", false) = true
          and coalesce(mr."IsDeleted", false) = false
          or p_filter = 'replied'
          and coalesce(mr."HasBeenRepliedToByRecipient", false) = true
          and coalesce(mr."IsDeleted", false) = false
          or p_filter = 'trash'
          and coalesce(mr."IsDeleted", false) = true
          or p_filter = 'all'
        )
    ),
    paged as (
      select *
      from base
      order by
        case when p_sort_by = 'createdAt_asc' then "Created" end asc,
        case when p_sort_by <> 'createdAt_asc' then "Created" end desc
      limit v_limit
      offset v_offset
    )
    select jsonb_build_object(
      'data',
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', p."MessageId",
            'threadId', p."ThreadId",
            'senderId', p."SenderId",
            'senderName', nullif(trim(coalesce(p.sender_first_name, '') || ' ' || coalesce(p.sender_last_name, '')), ''),
            'senderEmail', p.sender_email,
            'recipientId', v_member_id,
            'propertyId', p."PropertyId",
            'propertyTitle', p.property_title,
            'subject', coalesce(p."Subject", ''),
            'snippet', left(coalesce(p."Body", ''), 160),
            'createdAt', p."Created",
            'isRead', coalesce(p."IsRead", false),
            'isReplied', coalesce(p."HasBeenRepliedToByRecipient", false),
            'isStarred', coalesce(p."IsStarred", false),
            'isArchived', coalesce(p."IsArchived", false)
          )
        ),
        '[]'::jsonb
      ),
      'total', coalesce(v_total, 0),
      'page', v_page,
      'totalPages', v_total_pages
    )
    from paged p
  );
end;
$$;


--
-- Name: get_messages_by_property_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_messages_by_property_id(p_property_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Validate property exists
    IF NOT EXISTS (SELECT 1 FROM "EstateProperties" WHERE "Id" = p_property_id AND "IsDeleted" = false) THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Get all messages for this property
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', m."Id",
            'threadId', m."ThreadId",
            'senderId', m."SenderId",
            'senderName', COALESCE(mem."FirstName" || ' ' || mem."LastName", mem."FirstName", ''),
            'recipientId', mr."RecipientId",
            'propertyId', mt."PropertyId",
            'propertyTitle', ep."Title",
            'subject', mt."Subject",
            'snippet', m."Snippet",
            'createdAt', m."CreatedAtUtc",
            'isRead', mr."IsRead",
            'isReplied', mr."HasBeenRepliedToByRecipient",
            'isStarred', mr."IsStarred",
            'isArchived', mr."IsArchived"
        )
    ) INTO v_result
    FROM "Messages" m
    JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
    LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
    LEFT JOIN "Members" mem ON mem."Id" = m."SenderId"
    LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
    WHERE mt."PropertyId" = p_property_id
    ORDER BY m."CreatedAtUtc" DESC;

    IF v_result IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    RETURN v_result;
END;
$$;


--
-- Name: get_messages_by_thread_id(uuid, uuid, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_messages_by_thread_id(p_thread_id uuid, p_user_id uuid, p_page integer DEFAULT 1, p_limit integer DEFAULT 100, p_sort_by text DEFAULT 'createdAt_asc'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_member_id UUID;
    v_result JSONB;
    v_has_access BOOLEAN := false;
BEGIN
    -- Get member ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Check if user has access to this thread (sender or recipient of any message)
    SELECT EXISTS(
        SELECT 1 FROM "Messages" m
        LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
        WHERE m."ThreadId" = p_thread_id
        AND (m."SenderId" = v_member_id OR mr."RecipientId" = v_member_id)
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Access denied to thread';
    END IF;

    -- Get messages in thread with pagination
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', m."Id",
            'threadId', m."ThreadId",
            'senderId', m."SenderId",
            'senderName', COALESCE(mem."FirstName" || ' ' || mem."LastName", mem."FirstName", ''),
            'recipientId', mr."RecipientId",
            'propertyId', mt."PropertyId",
            'propertyTitle', ep."Title",
            'subject', mt."Subject",
            'snippet', m."Snippet",
            'fullBody', m."Body",
            'createdAt', m."CreatedAtUtc",
            'isRead', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsRead" ELSE true END,
            'isReplied', CASE WHEN mr."RecipientId" = v_member_id THEN mr."HasBeenRepliedToByRecipient" ELSE false END,
            'isStarred', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsStarred" ELSE false END,
            'isArchived', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsArchived" ELSE false END
        )
    ) INTO v_result
    FROM (
        SELECT m.*, ROW_NUMBER() OVER (
            ORDER BY CASE WHEN LOWER(p_sort_by) = 'createdat_asc' THEN m."CreatedAtUtc" END ASC,
                     CASE WHEN LOWER(p_sort_by) != 'createdat_asc' THEN m."CreatedAtUtc" END DESC
        ) as rn
        FROM "Messages" m
        WHERE m."ThreadId" = p_thread_id
    ) m
    JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
    LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
    LEFT JOIN "Members" mem ON mem."Id" = m."SenderId"
    LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
    WHERE m.rn > (p_page - 1) * p_limit AND m.rn <= p_page * p_limit;

    IF v_result IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    RETURN v_result;
END;
$$;


--
-- Name: get_or_create_owner(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_owner(p_member_id uuid DEFAULT NULL::uuid, p_company_id uuid DEFAULT NULL::uuid, p_owner_type text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_owner_id uuid;
    v_actual_owner_type text;
BEGIN
    -- Determine owner type if not provided
    IF p_owner_type IS NULL THEN
        IF p_member_id IS NOT NULL AND p_company_id IS NULL THEN
            v_actual_owner_type := 'member';
        ELSIF p_company_id IS NOT NULL AND p_member_id IS NULL THEN
            v_actual_owner_type := 'company';
        ELSE
            RAISE EXCEPTION 'Invalid owner parameters: must provide either member_id or company_id, but not both';
        END IF;
    ELSE
        v_actual_owner_type := p_owner_type;
    END IF;

    -- Validate parameters based on owner type
    IF v_actual_owner_type = 'member' AND p_member_id IS NULL THEN
        RAISE EXCEPTION 'member_id is required for member owner type';
    END IF;

    IF v_actual_owner_type = 'company' AND p_company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required for company owner type';
    END IF;

    -- Check if owner already exists
    SELECT "Id" INTO v_owner_id
    FROM "public"."Owners"
    WHERE "IsDeleted" = false
    AND (
        ("OwnerType" = 'member' AND "MemberId" = p_member_id) OR
        ("OwnerType" = 'company' AND "CompanyId" = p_company_id)
    )
    LIMIT 1;

    -- Create owner if it doesn't exist
    IF v_owner_id IS NULL THEN
        INSERT INTO "public"."Owners" (
            "OwnerType",
            "MemberId",
            "CompanyId",
            "Created",
            "LastModified"
        ) VALUES (
            v_actual_owner_type::"OwnerType",
            CASE WHEN v_actual_owner_type = 'member' THEN p_member_id ELSE NULL END,
            CASE WHEN v_actual_owner_type = 'company' THEN p_company_id ELSE NULL END,
            now(),
            now()
        )
        RETURNING "Id" INTO v_owner_id;
    END IF;

    RETURN v_owner_id;
END;
$$;


--
-- Name: get_owner_info(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_owner_info(p_owner_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT
        jsonb_build_object(
            'id', o."Id",
            'ownerType', o."OwnerType",
            'ownerDetails', CASE
                WHEN o."OwnerType" = 'member' THEN (
                    SELECT jsonb_build_object(
                        'id', m."Id",
                        'userId', m."UserId",
                        'firstName', m."FirstName",
                        'lastName', m."LastName",
                        'email', m."Email",
                        'phone', m."Phone"
                    )
                    FROM "public"."Members" m
                    WHERE m."Id" = o."MemberId"
                    AND m."IsDeleted" = false
                )
                WHEN o."OwnerType" = 'company' THEN (
                    SELECT jsonb_build_object(
                        'id', c."Id",
                        'name', c."Name",
                        'billingEmail', c."BillingEmail",
                        'phone', c."Phone"
                    )
                    FROM "public"."Companies" c
                    WHERE c."Id" = o."CompanyId"
                    AND c."IsDeleted" = false
                )
                ELSE NULL
            END
        ) INTO v_result
    FROM "public"."Owners" o
    WHERE o."Id" = p_owner_id
    AND o."IsDeleted" = false;

    RETURN v_result;
END;
$$;


--
-- Name: get_owner_onboarding_state(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_owner_onboarding_state(p_member_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_needs boolean := true;
  v_ev_at timestamptz;
  v_pv_at timestamptz;
  v_lm timestamptz;
  v_step integer;
  v_completed timestamptz;
  v_pub bigint;
  v_plan_limit integer := 5;
  v_plan_key integer := 0;
begin
  if not public.member_rpc_caller_ok(p_member_id) then
    return jsonb_build_object('error', 'forbidden');
  end if;

  select
    m."NeedsOnboarding",
    m."EmailVerifiedAt",
    m."PhoneVerifiedAt",
    m."LastModified"
  into v_needs, v_ev_at, v_pv_at, v_lm
  from public."Members" m
  where m."Id" = p_member_id
    and m."IsDeleted" = false;

  if not found then
    return jsonb_build_object('error', 'member_not_found');
  end if;

  -- Server only tracks coarse flow: in-tour vs exited ("NeedsOnboarding" = false).
  -- Step 5+ after exit is merged with sessionStorage on the client.
  if coalesce(v_needs, true) then
    v_step := 0;
    v_completed := null;
  else
    v_step := 5;
    v_completed := v_lm;
  end if;

  select public.count_member_published_properties(p_member_id)
  into v_pub;

  select
    coalesce(p."ListingLimit", p."MaxPublishedProperties", 5)::integer,
    coalesce(p."Key", 0)::integer
  into v_plan_limit, v_plan_key
  from public.get_active_member_plan(p_member_id) amp
  join public."Plans" p
    on p."Id" = amp.plan_id
  limit 1;

  return jsonb_build_object(
    'current_step', v_step,
    'completed_at', to_jsonb(v_completed),
    'dismissed_at', null,
    'published_properties_count', v_pub,
    'email_verified', (v_ev_at is not null),
    'phone_verified', (v_pv_at is not null),
    'plan_published_limit', coalesce(v_plan_limit, 5),
    'plan_key', coalesce(v_plan_key, 0)
  );
end;
$$;


--
-- Name: get_property_availability(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_property_availability(property_id uuid, start_date date, end_date date) RETURNS TABLE(date date, is_available boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  property_record RECORD;
  booking_record RECORD;
  block_record RECORD;
  current_check_date DATE;
  is_blocked BOOLEAN;
BEGIN
  -- Validate input dates
  IF start_date IS NULL OR end_date IS NULL OR start_date >= end_date THEN
    RAISE EXCEPTION 'Invalid date range provided';
  END IF;

  -- Check if property exists and is not deleted, and load booking rules.
  -- Booking rules currently come from SummerRentExtension.
  SELECT
    sx."MinStayDays" AS "MinStayDays",
    sx."MaxStayDays" AS "MaxStayDays",
    sx."LeadTimeDays" AS "LeadTimeDays",
    sx."BufferDays" AS "BufferDays"
  INTO property_record
  FROM public."EstateProperties" ep
  LEFT JOIN public."SummerRentExtension" sx
    ON sx."EstatePropertyId" = ep."Id"
  WHERE ep."Id" = property_id
    AND ep."IsDeleted" = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  -- Generate date series and check availability for each date
  current_check_date := start_date;

  WHILE current_check_date < end_date LOOP
    is_blocked := false;

    -- Check against bookings (pending, confirmed, cancelled)
    FOR booking_record IN
      SELECT "CheckInDate", "CheckOutDate"
      FROM public."Bookings"
      WHERE "EstatePropertyId" = property_id
        AND "IsDeleted" = false
        AND "Status" IN (0, 1, 2)
        AND current_check_date >= "CheckInDate"
        AND current_check_date < "CheckOutDate"
    LOOP
      is_blocked := true;
      EXIT;
    END LOOP;

    -- If not blocked by booking, check availability blocks
    IF NOT is_blocked THEN
      FOR block_record IN
        SELECT "StartDate", "EndDate", "IsAvailable"
        FROM public."AvailabilityBlocks"
        WHERE "EstatePropertyId" = property_id
          AND "IsDeleted" = false
          AND "IsAvailable" = false
          AND current_check_date >= "StartDate"::date
          AND current_check_date < "EndDate"::date
      LOOP
        is_blocked := true;
        EXIT;
      END LOOP;
    END IF;

    -- Apply lead time rule (earliest bookable date)
    IF property_record."LeadTimeDays" IS NOT NULL
       AND current_check_date < (CURRENT_DATE + INTERVAL '1 day' * property_record."LeadTimeDays") THEN
      is_blocked := true;
    END IF;

    -- BufferDays handling can be expanded here if needed; for now we keep
    -- the same simplified logic as the previous implementation.
    RETURN QUERY SELECT current_check_date, NOT is_blocked;

    -- Move to next date
    current_check_date := current_check_date + INTERVAL '1 day';
  END LOOP;

  RETURN;
END;
$$;


--
-- Name: get_property_booking_rules(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_property_booking_rules(p_property_id uuid) RETURNS TABLE("MinStayDays" integer, "MaxStayDays" integer, "LeadTimeDays" integer, "BufferDays" integer)
    LANGUAGE sql SECURITY DEFINER
    AS $$
    SELECT
        sx."MinStayDays",
        sx."MaxStayDays",
        sx."LeadTimeDays",
        sx."BufferDays"
    FROM public."SummerRentExtension" sx
    JOIN public."EstateProperties" ep
      ON ep."Id" = sx."EstatePropertyId"
    WHERE sx."EstatePropertyId" = p_property_id
      AND ep."IsDeleted" = false;
$$;


--
-- Name: get_property_ical_export_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_property_ical_export_token(property_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid;
  v_member_id uuid;
  v_is_admin boolean;
  v_token uuid;
begin
  if auth.role() = 'service_role' then
    select s."ICalExportToken" into v_token
    from public."SummerRentExtension" s
    where s."EstatePropertyId" = property_id;

    if not found then
      raise exception 'Summer rent extension not found for property'
        using errcode = 'P0001';
    end if;

    if v_token is null then
      v_token := gen_random_uuid();
      update public."SummerRentExtension" s
      set "ICalExportToken" = v_token,
          "LastModified" = now()
      where s."EstatePropertyId" = property_id;
    end if;

    return v_token::text;
  end if;

  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'P0001';
  end if;

  select m."Id", lower(coalesce(m."Role", '')) = 'admin'
  into v_member_id, v_is_admin
  from public."Members" m
  where m."UserId" = v_uid
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    raise exception 'Member not found'
      using errcode = 'P0001';
  end if;

  if not (
    v_is_admin
    or exists (
      select 1
      from public."EstateProperties" ep
      join public."Owners" o on o."Id" = ep."OwnerId" and o."IsDeleted" = false
      where ep."Id" = property_id
        and ep."IsDeleted" = false
        and (
          (o."OwnerType" = 'member' and o."MemberId" = v_member_id)
          or (
            o."OwnerType" = 'company'
            and exists (
              select 1
              from public."CompanyMembers" cm
              where cm."CompanyId" = o."CompanyId"
                and cm."MemberId" = v_member_id
                and cm."IsDeleted" = false
            )
          )
        )
    )
  ) then
    raise exception 'Access denied'
      using errcode = 'P0001';
  end if;

  select s."ICalExportToken" into v_token
  from public."SummerRentExtension" s
  where s."EstatePropertyId" = property_id;

  if not found then
    raise exception 'No summer rental extension for this property'
      using errcode = 'P0001';
  end if;

  if v_token is null then
    v_token := gen_random_uuid();
    update public."SummerRentExtension" s
    set "ICalExportToken" = v_token,
        "LastModified" = now()
    where s."EstatePropertyId" = property_id;
  end if;

  return v_token::text;
end;
$$;


--
-- Name: get_property_ical_export_url(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_property_ical_export_url(property_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    export_token uuid;
    export_url text;
BEGIN
    -- Get the export token for this property
    SELECT "ICalExportToken" INTO export_token
    FROM "EstateProperties"
    WHERE "Id" = property_id
        AND "IsDeleted" = false;

    -- Return null if property doesn't exist or no token
    IF export_token IS NULL THEN
        RETURN NULL;
    END IF;

    -- Construct the public export URL
    -- Note: Replace 'your-domain.com' with actual domain in production
    export_url := 'https://your-domain.com/functions/v1/ical-export/' || property_id || '?token=' || export_token;

    RETURN export_url;
END;
$$;


--
-- Name: FUNCTION get_property_ical_export_url(property_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_property_ical_export_url(property_id uuid) IS 'Returns the public iCal export URL for a property. Returns NULL if property not found or no export token.';


--
-- Name: get_property_search_scores(uuid[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_property_search_scores(p_property_ids uuid[], p_listing_type text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_listing_type text;
begin
  v_listing_type := public.validate_guest_site_listing_type(p_listing_type)::text;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'estatePropertyId', pss."EstatePropertyId",
          'listingType', pss."ListingType",
          'listingId', pss."ListingId",
          'scores', pss."Scores",
          'metrics', pss."Metrics",
          'computedAt', pss."ComputedAt"
        )
      )
      from public."PropertySearchScores" pss
      where pss."ListingType" = v_listing_type
        and pss."EstatePropertyId" = any(p_property_ids)
    ),
    '[]'::jsonb
  );
end;
$$;


--
-- Name: get_property_views(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_property_views(p_property_id uuid, p_period text DEFAULT 'last30days'::text, p_user_id uuid DEFAULT NULL::uuid) RETURNS TABLE(date date, count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_start timestamptz;
  v_end timestamptz := timezone('utc', now());
begin
  case lower(coalesce(p_period, 'last30days'))
    when 'last7days' then v_start := v_end - interval '7 days';
    when 'last30days' then v_start := v_end - interval '30 days';
    when 'last90days' then v_start := v_end - interval '90 days';
    when 'thisyear' then v_start := date_trunc('year', v_end);
    else v_start := v_end - interval '30 days';
  end case;

  return query
  select
    date_trunc('day', pvl."VisitedOnUtc")::date as date,
    count(*)::bigint as count
  from public."PropertyVisitLogs" pvl
  join public."EstateProperties" ep
    on ep."Id" = pvl."PropertyId"
   and ep."IsDeleted" = false
  join public."Owners" o
    on o."Id" = ep."OwnerId"
   and o."IsDeleted" = false
  where pvl."PropertyId" = p_property_id
    and pvl."VisitedOnUtc" >= v_start
    and pvl."VisitedOnUtc" <= v_end
    and (
      p_user_id is null
      or (
        (o."OwnerType" = 'member' and o."MemberId" = p_user_id)
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = p_user_id
              and cm."IsDeleted" = false
          )
        )
      )
    )
  group by 1
  order by 1;
end;
$$;


--
-- Name: get_property_views_by_source(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_property_views_by_source(p_property_id uuid, p_period text DEFAULT 'last30days'::text, p_user_id uuid DEFAULT NULL::uuid) RETURNS TABLE(source text, visits bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_start timestamptz;
  v_end timestamptz := timezone('utc', now());
begin
  case lower(coalesce(p_period, 'last30days'))
    when 'last7days' then v_start := v_end - interval '7 days';
    when 'last30days' then v_start := v_end - interval '30 days';
    when 'last90days' then v_start := v_end - interval '90 days';
    when 'thisyear' then v_start := date_trunc('year', v_end);
    else v_start := v_end - interval '30 days';
  end case;

  return query
  select
    coalesce(nullif(trim(pvl."Source"), ''), 'website')::text as source,
    count(*)::bigint as visits
  from public."PropertyVisitLogs" pvl
  join public."EstateProperties" ep
    on ep."Id" = pvl."PropertyId"
   and ep."IsDeleted" = false
  join public."Owners" o
    on o."Id" = ep."OwnerId"
   and o."IsDeleted" = false
  where pvl."PropertyId" = p_property_id
    and pvl."VisitedOnUtc" >= v_start
    and pvl."VisitedOnUtc" <= v_end
    and (
      p_user_id is null
      or (
        (o."OwnerType" = 'member' and o."MemberId" = p_user_id)
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = p_user_id
              and cm."IsDeleted" = false
          )
        )
      )
    )
  group by 1
  order by 2 desc, 1 asc;
end;
$$;


--
-- Name: get_public_event_venue_properties(numeric, numeric, integer, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_event_venue_properties(p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_min_guests integer DEFAULT NULL::integer, p_location text DEFAULT NULL::text, p_only_featured boolean DEFAULT false) RETURNS TABLE("EstatePropertyId" uuid, "OwnerId" uuid, "Neighborhood" character varying, "City" character varying, "State" character varying, "Country" character varying, "LocationLatitude" numeric, "LocationLongitude" numeric, "AreaValue" numeric, "AreaUnit" integer, "Bedrooms" integer, "Bathrooms" integer, "HasGarage" boolean, "GarageSpaces" integer, "HasLaundryRoom" boolean, "HasPool" boolean, "HasBalcony" boolean, "IsFurnished" boolean, "Capacity" integer, "LocationCategory" public."LocationCategory", "ViewType" public."ViewType", "ListingId" uuid, "ListingType" public."ListingType", "Title" text, "ListingDescription" character varying, "AvailableFrom" timestamp with time zone, "ListingCapacity" integer, "Currency" integer, "SalePrice" numeric, "RentPrice" numeric, "HasCommonExpenses" boolean, "CommonExpensesValue" numeric, "IsElectricityIncluded" boolean, "IsWaterIncluded" boolean, "IsPriceVisible" boolean, "Status" integer, "IsActive" boolean, "IsPropertyVisible" boolean, "IsFeatured" boolean, "BlockedForBooking" boolean, "MaxGuests" integer, "HasCatering" boolean, "HasSoundSystem" boolean, "ClosingHour" time without time zone, "AllowedEventsDescription" text, "AmenityNames" text[])
    LANGUAGE sql STABLE
    AS $$
  SELECT
    ep."Id" AS "EstatePropertyId",
    ep."OwnerId",
    ep."Neighborhood",
    ep."City",
    ep."State",
    ep."Country",
    ep."LocationLatitude",
    ep."LocationLongitude",
    ep."AreaValue",
    ep."AreaUnit",
    ep."Bedrooms",
    ep."Bathrooms",
    ep."HasGarage",
    ep."GarageSpaces",
    ep."HasLaundryRoom",
    ep."HasPool",
    ep."HasBalcony",
    ep."IsFurnished",
    ep."Capacity",
    ep."LocationCategory",
    ep."ViewType",
    l."Id" AS "ListingId",
    l."ListingType",
    l."Title",
    l."Description" AS "ListingDescription",
    l."AvailableFrom",
    l."Capacity" AS "ListingCapacity",
    l."Currency",
    l."SalePrice",
    l."RentPrice",
    l."HasCommonExpenses",
    l."CommonExpensesValue",
    l."IsElectricityIncluded",
    l."IsWaterIncluded",
    l."IsPriceVisible",
    l."Status",
    l."IsActive",
    l."IsPropertyVisible",
    l."IsFeatured",
    l."BlockedForBooking",
    ev."MaxGuests",
    ev."HasCatering",
    ev."HasSoundSystem",
    ev."ClosingHour",
    ev."AllowedEventsDescription",
    COALESCE(a_names."AmenityNames", ARRAY[]::text[]) AS "AmenityNames"
  FROM public."EstateProperties" ep
  JOIN public."Listings" l
    ON l."EstatePropertyId" = ep."Id"
   AND l."IsDeleted" = false
   AND l."IsActive" = true
   AND l."IsPropertyVisible" = true
   AND l."ListingType" = 'EventVenue'::public."ListingType"
  LEFT JOIN public."EventVenueExtension" ev
    ON ev."EstatePropertyId" = ep."Id"
  LEFT JOIN (
    SELECT
      epa."EstatePropertyId",
      array_agg(a."Name" ORDER BY a."Name") AS "AmenityNames"
    FROM public."EstatePropertyAmenity" epa
    JOIN public."Amenities" a
      ON a."Id" = epa."AmenityId"
     AND a."IsDeleted" = false
     AND a."PropertyType" = 'EventVenue'::public."PropertyType"
    WHERE epa."DeletedAtUtc" IS NULL
    GROUP BY epa."EstatePropertyId"
  ) AS a_names
    ON a_names."EstatePropertyId" = ep."Id"
  WHERE ep."IsDeleted" = false
    AND (p_min_price IS NULL OR l."RentPrice" >= p_min_price)
    AND (p_max_price IS NULL OR l."RentPrice" <= p_max_price)
    AND (
      p_min_guests IS NULL
      OR COALESCE(ev."MaxGuests", l."Capacity", ep."Capacity", ep."Bedrooms" * 2) >= p_min_guests
    )
    AND (
      p_location IS NULL
      OR (
        ep."City" ILIKE '%' || p_location || '%'
        OR ep."State" ILIKE '%' || p_location || '%'
        OR ep."Neighborhood" ILIKE '%' || p_location || '%'
      )
    )
    AND (NOT p_only_featured OR l."IsFeatured" = true);
$$;


--
-- Name: get_public_event_venue_property_by_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_event_venue_property_by_id(p_property_id uuid) RETURNS TABLE("EstatePropertyId" uuid, "OwnerId" uuid, "Neighborhood" character varying, "City" character varying, "State" character varying, "Country" character varying, "LocationLatitude" numeric, "LocationLongitude" numeric, "AreaValue" numeric, "AreaUnit" integer, "Bedrooms" integer, "Bathrooms" integer, "HasGarage" boolean, "GarageSpaces" integer, "HasLaundryRoom" boolean, "HasPool" boolean, "HasBalcony" boolean, "IsFurnished" boolean, "Capacity" integer, "LocationCategory" public."LocationCategory", "ViewType" public."ViewType", "ListingId" uuid, "ListingType" public."ListingType", "Title" text, "ListingDescription" character varying, "AvailableFrom" timestamp with time zone, "ListingCapacity" integer, "Currency" integer, "SalePrice" numeric, "RentPrice" numeric, "HasCommonExpenses" boolean, "CommonExpensesValue" numeric, "IsElectricityIncluded" boolean, "IsWaterIncluded" boolean, "IsPriceVisible" boolean, "Status" integer, "IsActive" boolean, "IsPropertyVisible" boolean, "IsFeatured" boolean, "BlockedForBooking" boolean, "MaxGuests" integer, "HasCatering" boolean, "HasSoundSystem" boolean, "ClosingHour" time without time zone, "AllowedEventsDescription" text, "AmenityNames" text[], "Amenities" jsonb, "Policies" jsonb, "ContentSections" jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    ep."Id" as "EstatePropertyId",
    ep."OwnerId",
    ep."Neighborhood",
    ep."City",
    ep."State",
    ep."Country",
    ep."LocationLatitude",
    ep."LocationLongitude",
    ep."AreaValue",
    ep."AreaUnit",
    ep."Bedrooms",
    ep."Bathrooms",
    ep."HasGarage",
    ep."GarageSpaces",
    ep."HasLaundryRoom",
    ep."HasPool",
    ep."HasBalcony",
    ep."IsFurnished",
    ep."Capacity",
    ep."LocationCategory",
    ep."ViewType",
    l."Id" as "ListingId",
    l."ListingType",
    l."Title",
    l."Description" as "ListingDescription",
    l."AvailableFrom",
    l."Capacity" as "ListingCapacity",
    l."Currency",
    l."SalePrice",
    l."RentPrice",
    l."HasCommonExpenses",
    l."CommonExpensesValue",
    l."IsElectricityIncluded",
    l."IsWaterIncluded",
    l."IsPriceVisible",
    l."Status",
    l."IsActive",
    l."IsPropertyVisible",
    l."IsFeatured",
    l."BlockedForBooking",
    ev."MaxGuests",
    ev."HasCatering",
    ev."HasSoundSystem",
    ev."ClosingHour",
    ev."AllowedEventsDescription",
    coalesce(a_names."AmenityNames", array[]::text[]) as "AmenityNames",
    public.build_property_amenities_json(ep."Id") as "Amenities",
    public.build_property_policies_json(ep."Id", 'EventVenue'::public."ListingType") as "Policies",
    public.build_property_content_sections_json(ep."Id", 'EventVenue'::public."PropertyType") as "ContentSections"
  from public."EstateProperties" ep
  join public."Listings" l
    on l."EstatePropertyId" = ep."Id"
   and l."IsDeleted" = false
   and l."IsActive" = true
   and l."IsPropertyVisible" = true
   and l."ListingType" = 'EventVenue'::public."ListingType"
  left join public."EventVenueExtension" ev
    on ev."EstatePropertyId" = ep."Id"
  left join (
    select
      epa."EstatePropertyId",
      array_agg(a."Name" order by a."Name") as "AmenityNames"
    from public."EstatePropertyAmenity" epa
    join public."Amenities" a
      on a."Id" = epa."AmenityId"
     and a."IsDeleted" = false
     and a."PropertyType" = 'EventVenue'::public."PropertyType"
    where epa."DeletedAtUtc" is null
    group by epa."EstatePropertyId"
  ) as a_names
    on a_names."EstatePropertyId" = ep."Id"
  where ep."IsDeleted" = false
    and ep."Id" = p_property_id;
$$;


--
-- Name: get_public_summer_rent_properties(numeric, numeric, integer, integer, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_summer_rent_properties(p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_min_bedrooms integer DEFAULT NULL::integer, p_min_guests integer DEFAULT NULL::integer, p_location text DEFAULT NULL::text, p_only_featured boolean DEFAULT false) RETURNS TABLE("EstatePropertyId" uuid, "OwnerId" uuid, "Neighborhood" character varying, "City" character varying, "State" character varying, "Country" character varying, "LocationLatitude" numeric, "LocationLongitude" numeric, "AreaValue" numeric, "AreaUnit" integer, "Bedrooms" integer, "Bathrooms" integer, "HasGarage" boolean, "GarageSpaces" integer, "HasLaundryRoom" boolean, "HasPool" boolean, "HasBalcony" boolean, "IsFurnished" boolean, "Capacity" integer, "LocationCategory" public."LocationCategory", "ViewType" public."ViewType", "MinStayDays" integer, "MaxStayDays" integer, "LeadTimeDays" integer, "BufferDays" integer, "ListingId" uuid, "ListingType" public."ListingType", "Title" text, "ListingDescription" character varying, "AvailableFrom" timestamp with time zone, "ListingCapacity" integer, "Currency" integer, "SalePrice" numeric, "RentPrice" numeric, "HasCommonExpenses" boolean, "CommonExpensesValue" numeric, "IsElectricityIncluded" boolean, "IsWaterIncluded" boolean, "IsPriceVisible" boolean, "Status" integer, "IsActive" boolean, "IsPropertyVisible" boolean, "IsFeatured" boolean, "BlockedForBooking" boolean, "AmenityNames" text[])
    LANGUAGE sql STABLE
    AS $$
  SELECT
    ep."Id" AS "EstatePropertyId",
    ep."OwnerId",
    ep."Neighborhood",
    ep."City",
    ep."State",
    ep."Country",
    ep."LocationLatitude",
    ep."LocationLongitude",
    ep."AreaValue",
    ep."AreaUnit",
    ep."Bedrooms",
    ep."Bathrooms",
    ep."HasGarage",
    ep."GarageSpaces",
    ep."HasLaundryRoom",
    ep."HasPool",
    ep."HasBalcony",
    ep."IsFurnished",
    ep."Capacity",
    ep."LocationCategory",
    ep."ViewType",
    sx."MinStayDays",
    sx."MaxStayDays",
    sx."LeadTimeDays",
    sx."BufferDays",
    l."Id" AS "ListingId",
    l."ListingType",
    l."Title",
    l."Description" AS "ListingDescription",
    l."AvailableFrom",
    l."Capacity" AS "ListingCapacity",
    l."Currency",
    l."SalePrice",
    l."RentPrice",
    l."HasCommonExpenses",
    l."CommonExpensesValue",
    l."IsElectricityIncluded",
    l."IsWaterIncluded",
    l."IsPriceVisible",
    l."Status",
    l."IsActive",
    l."IsPropertyVisible",
    l."IsFeatured",
    l."BlockedForBooking",
    COALESCE(a_names."AmenityNames", ARRAY[]::text[]) AS "AmenityNames"
  FROM public."EstateProperties" ep
  JOIN public."Listings" l
    ON l."EstatePropertyId" = ep."Id"
   AND l."IsDeleted" = false
   AND l."IsActive" = true
   AND l."IsPropertyVisible" = true
   AND l."ListingType" = 'SummerRent'::public."ListingType"
  LEFT JOIN public."SummerRentExtension" sx
    ON sx."EstatePropertyId" = ep."Id"
  LEFT JOIN (
    SELECT
      epa."EstatePropertyId",
      array_agg(a."Name" ORDER BY a."Name") AS "AmenityNames"
    FROM public."EstatePropertyAmenity" epa
    JOIN public."Amenities" a
      ON a."Id" = epa."AmenityId"
     AND a."IsDeleted" = false
     AND a."PropertyType" = 'SummerRent'::public."PropertyType"
    WHERE epa."DeletedAtUtc" IS NULL
    GROUP BY epa."EstatePropertyId"
  ) AS a_names
    ON a_names."EstatePropertyId" = ep."Id"
  WHERE ep."IsDeleted" = false
    AND (p_min_price IS NULL OR l."RentPrice" >= p_min_price)
    AND (p_max_price IS NULL OR l."RentPrice" <= p_max_price)
    AND (p_min_bedrooms IS NULL OR ep."Bedrooms" >= p_min_bedrooms)
    AND (
      p_min_guests IS NULL
      OR COALESCE(l."Capacity", ep."Capacity", ep."Bedrooms" * 2) >= p_min_guests
    )
    AND (
      p_location IS NULL
      OR (
        ep."City" ILIKE '%' || p_location || '%'
        OR ep."State" ILIKE '%' || p_location || '%'
        OR ep."Neighborhood" ILIKE '%' || p_location || '%'
      )
    )
    AND (NOT p_only_featured OR l."IsFeatured" = true);
$$;


--
-- Name: get_public_summer_rent_property_by_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_summer_rent_property_by_id(p_property_id uuid) RETURNS TABLE("EstatePropertyId" uuid, "OwnerId" uuid, "Neighborhood" character varying, "City" character varying, "State" character varying, "Country" character varying, "LocationLatitude" numeric, "LocationLongitude" numeric, "AreaValue" numeric, "AreaUnit" integer, "Bedrooms" integer, "Bathrooms" integer, "HasGarage" boolean, "GarageSpaces" integer, "HasLaundryRoom" boolean, "HasPool" boolean, "HasBalcony" boolean, "IsFurnished" boolean, "Capacity" integer, "LocationCategory" public."LocationCategory", "ViewType" public."ViewType", "MinStayDays" integer, "MaxStayDays" integer, "LeadTimeDays" integer, "BufferDays" integer, "ListingId" uuid, "ListingType" public."ListingType", "Title" text, "ListingDescription" character varying, "AvailableFrom" timestamp with time zone, "ListingCapacity" integer, "Currency" integer, "SalePrice" numeric, "RentPrice" numeric, "HasCommonExpenses" boolean, "CommonExpensesValue" numeric, "IsElectricityIncluded" boolean, "IsWaterIncluded" boolean, "IsPriceVisible" boolean, "Status" integer, "IsActive" boolean, "IsPropertyVisible" boolean, "IsFeatured" boolean, "BlockedForBooking" boolean, "AmenityNames" text[], "Amenities" jsonb, "Policies" jsonb, "ContentSections" jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    ep."Id" as "EstatePropertyId",
    ep."OwnerId",
    ep."Neighborhood",
    ep."City",
    ep."State",
    ep."Country",
    ep."LocationLatitude",
    ep."LocationLongitude",
    ep."AreaValue",
    ep."AreaUnit",
    ep."Bedrooms",
    ep."Bathrooms",
    ep."HasGarage",
    ep."GarageSpaces",
    ep."HasLaundryRoom",
    ep."HasPool",
    ep."HasBalcony",
    ep."IsFurnished",
    ep."Capacity",
    ep."LocationCategory",
    ep."ViewType",
    sx."MinStayDays",
    sx."MaxStayDays",
    sx."LeadTimeDays",
    sx."BufferDays",
    l."Id" as "ListingId",
    l."ListingType",
    l."Title",
    l."Description" as "ListingDescription",
    l."AvailableFrom",
    l."Capacity" as "ListingCapacity",
    l."Currency",
    l."SalePrice",
    l."RentPrice",
    l."HasCommonExpenses",
    l."CommonExpensesValue",
    l."IsElectricityIncluded",
    l."IsWaterIncluded",
    l."IsPriceVisible",
    l."Status",
    l."IsActive",
    l."IsPropertyVisible",
    l."IsFeatured",
    l."BlockedForBooking",
    coalesce(a_names."AmenityNames", array[]::text[]) as "AmenityNames",
    public.build_property_amenities_json(ep."Id") as "Amenities",
    public.build_property_policies_json(ep."Id", 'SummerRent'::public."ListingType") as "Policies",
    public.build_property_content_sections_json(ep."Id", 'SummerRent'::public."PropertyType") as "ContentSections"
  from public."EstateProperties" ep
  join public."Listings" l
    on l."EstatePropertyId" = ep."Id"
   and l."IsDeleted" = false
   and l."IsActive" = true
   and l."IsPropertyVisible" = true
   and l."ListingType" = 'SummerRent'::public."ListingType"
  left join public."SummerRentExtension" sx
    on sx."EstatePropertyId" = ep."Id"
  left join (
    select
      epa."EstatePropertyId",
      array_agg(a."Name" order by a."Name") as "AmenityNames"
    from public."EstatePropertyAmenity" epa
    join public."Amenities" a
      on a."Id" = epa."AmenityId"
     and a."IsDeleted" = false
     and a."PropertyType" = 'SummerRent'::public."PropertyType"
    where epa."DeletedAtUtc" is null
    group by epa."EstatePropertyId"
  ) as a_names
    on a_names."EstatePropertyId" = ep."Id"
  where ep."IsDeleted" = false
    and ep."Id" = p_property_id;
$$;


--
-- Name: get_reservation_by_code(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_reservation_by_code(reservation_code text, p_listing_type text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_code text;
  v_listing_type public."ListingType";
  v_booking record;
  v_status text;
  v_is_expired boolean := false;
  v_has_existing_review boolean := false;
  v_can_submit_guest_review boolean := false;
  v_can_edit_guest_review boolean := false;
  v_eligible_now boolean := false;
  v_review_base_eligible boolean := false;
  v_window jsonb;
  v_window_end timestamptz;
  v_existing_guest_review jsonb := null;
  v_profile jsonb;
  v_guest_name text;
  v_guest_email text;
  v_guest_phone text;
  v_host_contact jsonb := jsonb_build_object('name', null, 'email', null, 'phone', null);
  v_review record;
begin
  v_code := upper(trim(coalesce(reservation_code, '')));

  if v_code = '' or v_code !~ '^RSV-[A-Z0-9]{6}$' then
    return jsonb_build_object('success', false, 'error', 'Invalid reservation code format');
  end if;

  begin
    v_listing_type := public.validate_guest_site_listing_type(p_listing_type);
  exception
    when others then
      return jsonb_build_object('success', false, 'error', 'Invalid listing type');
  end;

  select
    b."Id" as booking_id,
    b."GuestId" as guest_id,
    b."ReservationCode" as reservation_code,
    b."EstatePropertyId" as property_id,
    b."ListingType" as booking_listing_type,
    l."Title" as property_title,
    b."CheckInDate"::timestamptz as check_in,
    b."CheckOutDate"::timestamptz as check_out,
    b."Status" as status_code,
    b."IsDeleted" as is_deleted,
    h.full_name as hold_full_name,
    h.email as hold_email,
    h.phone as hold_phone
  into v_booking
  from public."Bookings" b
  left join lateral (
    select l2."Title"
    from public."Listings" l2
    where l2."EstatePropertyId" = b."EstatePropertyId"
      and l2."IsDeleted" = false
      and l2."ListingType" = v_listing_type
    order by l2."IsActive" desc nulls last, l2."Created" desc nulls last
    limit 1
  ) l on true
  left join lateral (
    select
      bh.full_name,
      bh.email,
      bh.phone
    from public.booking_holds bh
    where bh.property_id = b."EstatePropertyId"
      and bh.check_in = b."CheckInDate"
      and bh.check_out = b."CheckOutDate"
      and bh.status = 'confirmed'
    order by bh.updated_at desc nulls last
    limit 1
  ) h on true
  where b."ReservationCode" = v_code
    and b."IsDeleted" = false
  order by b."Created" desc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if not public.booking_matches_guest_site_listing_type(
    v_booking.booking_listing_type,
    v_booking.property_id,
    v_booking.check_in,
    v_booking.check_out,
    v_listing_type
  ) then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  v_profile := public.resolve_guest_profile(v_booking.guest_id);

  if v_profile is not null then
    v_guest_name := nullif(
      trim(coalesce(v_profile->>'firstName', '') || ' ' || coalesce(v_profile->>'lastName', '')),
      ''
    );
    v_guest_email := v_profile->>'email';
    v_guest_phone := v_profile->>'phone';
  else
    v_guest_name := v_booking.hold_full_name;
    v_guest_email := v_booking.hold_email;
    v_guest_phone := v_booking.hold_phone;
  end if;

  v_status := case v_booking.status_code
    when 0 then 'pending'
    when 1 then 'confirmed'
    when 2 then 'cancelled'
    when 3 then 'completed'
    else 'unknown'
  end;

  if v_booking.status_code in (1, 3) then
    v_host_contact := public.resolve_host_contact_for_property(v_booking.property_id);
  end if;

  if v_booking.check_out < current_date then
    v_is_expired := true;
  end if;

  if v_is_expired and v_status not in ('cancelled', 'completed') then
    return jsonb_build_object('success', false, 'error', 'Reservation expired');
  end if;

  v_window := public.compute_guest_review_window(v_booking.check_out::timestamptz);
  v_window_end := (v_window->>'windowEnd')::timestamptz;
  v_eligible_now := public.guest_review_is_eligible_now(v_booking.check_out::timestamptz);

  select
    r."Id" as review_id,
    r."Rating" as rating,
    r."Comment" as comment,
    coalesce(r."LastModified", r."CreatedAt") as updated_at
  into v_review
  from public."Reviews" r
  where r."BookingId" = v_booking.booking_id
  limit 1;

  v_has_existing_review := found;

  if v_has_existing_review then
    v_existing_guest_review := jsonb_build_object(
      'reviewId', v_review.review_id,
      'rating', v_review.rating,
      'comment', v_review.comment,
      'updatedAt', v_review.updated_at
    );
  end if;

  v_review_base_eligible :=
    not coalesce(v_booking.is_deleted, false)
    and v_booking.status_code in (1, 3)
    and v_booking.guest_id is not null;

  v_can_submit_guest_review :=
    v_review_base_eligible
    and v_eligible_now
    and not v_has_existing_review;

  v_can_edit_guest_review :=
    v_review_base_eligible
    and v_eligible_now
    and v_has_existing_review;

  return jsonb_build_object(
    'success', true,
    'reservation', jsonb_build_object(
      'bookingId', v_booking.booking_id,
      'guestId', v_booking.guest_id,
      'reservationCode', v_booking.reservation_code,
      'propertyId', v_booking.property_id,
      'propertyTitle', coalesce(v_booking.property_title, 'Property'),
      'listingType', v_listing_type::text,
      'checkIn', v_booking.check_in,
      'checkOut', v_booking.check_out,
      'status', v_status,
      'guestName', v_guest_name,
      'guestEmail', v_guest_email,
      'guestPhone', v_guest_phone,
      'hostName', v_host_contact->>'name',
      'hostEmail', v_host_contact->>'email',
      'hostPhone', v_host_contact->>'phone',
      'canCancel', (v_booking.status_code in (0, 1) and v_booking.check_in >= current_date),
      'isExpired', v_is_expired,
      'isDeleted', coalesce(v_booking.is_deleted, false),
      'hasExistingReview', v_has_existing_review,
      'canSubmitGuestReview', v_can_submit_guest_review,
      'canEditGuestReview', v_can_edit_guest_review,
      'existingGuestReview', v_existing_guest_review,
      'guestReviewWindowEnd', v_window_end
    )
  );
end;
$_$;


--
-- Name: get_views_by_source(text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_views_by_source(p_period text DEFAULT 'last30days'::text, p_company_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid) RETURNS TABLE(source text, visits bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_member_id uuid;
  v_start timestamptz;
  v_source_col_exists boolean := false;
begin
  select m."Id"
  into v_member_id
  from public."Members" m
  where m."UserId" = coalesce(p_user_id, auth.uid())
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    return;
  end if;

  v_start := case
    when p_period = 'last7days' then timezone('utc', now()) - interval '7 days'
    when p_period = 'last90days' then timezone('utc', now()) - interval '90 days'
    when p_period = 'thisyear' then date_trunc('year', timezone('utc', now()))
    else timezone('utc', now()) - interval '30 days'
  end;

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'PropertyVisitLogs'
      and c.column_name = 'Source'
  )
  into v_source_col_exists;

  if v_source_col_exists then
    return query
    with accessible_properties as (
      select ep."Id"
      from public."EstateProperties" ep
      join public."Owners" o
        on o."Id" = ep."OwnerId"
       and o."IsDeleted" = false
      where ep."IsDeleted" = false
        and (
          (o."OwnerType" = 'member' and o."MemberId" = v_member_id)
          or (
            o."OwnerType" = 'company'
            and exists (
              select 1
              from public."CompanyMembers" cm
              where cm."CompanyId" = o."CompanyId"
                and cm."MemberId" = v_member_id
                and cm."IsDeleted" = false
                and (p_company_id is null or cm."CompanyId" = p_company_id)
            )
          )
        )
        and (
          p_company_id is null
          or (o."OwnerType" = 'company' and o."CompanyId" = p_company_id)
        )
    )
    select
      coalesce(nullif(lower(pvl."Source"), ''), 'website') as source,
      count(*)::bigint as visits
    from public."PropertyVisitLogs" pvl
    join accessible_properties ap
      on ap."Id" = pvl."PropertyId"
    where pvl."VisitedOnUtc" >= v_start
    group by 1
    order by 2 desc, 1 asc;
  else
    return query
    with accessible_properties as (
      select ep."Id"
      from public."EstateProperties" ep
      join public."Owners" o
        on o."Id" = ep."OwnerId"
       and o."IsDeleted" = false
      where ep."IsDeleted" = false
        and (
          (o."OwnerType" = 'member' and o."MemberId" = v_member_id)
          or (
            o."OwnerType" = 'company'
            and exists (
              select 1
              from public."CompanyMembers" cm
              where cm."CompanyId" = o."CompanyId"
                and cm."MemberId" = v_member_id
                and cm."IsDeleted" = false
                and (p_company_id is null or cm."CompanyId" = p_company_id)
            )
          )
        )
        and (
          p_company_id is null
          or (o."OwnerType" = 'company' and o."CompanyId" = p_company_id)
        )
    )
    select
      'website'::text as source,
      count(*)::bigint as visits
    from public."PropertyVisitLogs" pvl
    join accessible_properties ap
      on ap."Id" = pvl."PropertyId"
    where pvl."VisitedOnUtc" >= v_start
    group by 1;
  end if;
end;
$$;


--
-- Name: get_visits_by_property(text, integer, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_visits_by_property(p_period text, p_page integer DEFAULT 1, p_limit integer DEFAULT 10, p_company_id text DEFAULT NULL::text, p_user_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
    v_user_companies UUID[];
    v_offset INTEGER;
    v_total_count BIGINT;
    v_result_data JSONB[];
    v_item JSONB;
BEGIN
    SELECT start_date, end_date
    INTO v_start_date, v_end_date
    FROM parse_period(p_period);

    IF p_company_id IS NOT NULL THEN
        SELECT ARRAY[uc."CompanyId"]
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = (SELECT "Id" FROM "Members" WHERE "UserId" = p_user_id::UUID AND "IsDeleted" = false)
        AND uc."CompanyId" = p_company_id::UUID
        AND uc."IsDeleted" = false
        INTO v_user_companies;
    ELSE
        SELECT ARRAY_AGG(uc."CompanyId")
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = (SELECT "Id" FROM "Members" WHERE "UserId" = p_user_id::UUID AND "IsDeleted" = false)
        AND uc."IsDeleted" = false
        INTO v_user_companies;
    END IF;

    v_offset := (p_page - 1) * p_limit;

    SELECT COUNT(DISTINCT pvl."PropertyId")
    INTO v_total_count
    FROM "PropertyVisitLogs" pvl
    JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
    WHERE pvl."VisitedOnUtc" >= v_start_date
    AND pvl."VisitedOnUtc" <= v_end_date
    AND ep."OwnerId" = ANY(v_user_companies);

    SELECT ARRAY_AGG(
        jsonb_build_object(
            'propertyId', ep."Id"::TEXT,
            'propertyTitle', ep."Title",
            'address', COALESCE(ep."StreetName", '') || ' ' || COALESCE(ep."HouseNumber", ''),
            'visitCount', stats.visit_count,
            'price', COALESCE(l."RentPrice"::TEXT, l."SalePrice"::TEXT),
            'status', CASE l."Status"
                WHEN 0 THEN 'Sale'
                WHEN 1 THEN 'Rent'
                WHEN 2 THEN 'Reserved'
                WHEN 3 THEN 'Sold'
                WHEN 4 THEN 'Unavailable'
                ELSE 'Unknown'
            END,
            'messages', stats.message_count,
            'visitsTrend', 'flat',
            'messagesTrend', 'flat',
            'conversion', '0%',
            'conversionTrend', 'flat'
        )
    )
    INTO v_result_data
    FROM (
        SELECT
            pvl."PropertyId",
            COUNT(*) AS visit_count,
            COALESCE((
                SELECT COUNT(*)
                FROM "PropertyMessageLogs" pml
                WHERE pml."PropertyId" = pvl."PropertyId"
                AND pml."SentOnUtc" >= v_start_date
                AND pml."SentOnUtc" <= v_end_date
            ), 0) AS message_count
        FROM "PropertyVisitLogs" pvl
        JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
        WHERE pvl."VisitedOnUtc" >= v_start_date
        AND pvl."VisitedOnUtc" <= v_end_date
        AND ep."OwnerId" = ANY(v_user_companies)
        GROUP BY pvl."PropertyId"
        ORDER BY visit_count DESC
        LIMIT p_limit
        OFFSET v_offset
    ) stats
    JOIN "EstateProperties" ep ON stats."PropertyId" = ep."Id"
    LEFT JOIN LATERAL (
        SELECT "RentPrice", "SalePrice", "Status"
        FROM "Listings"
        WHERE "EstatePropertyId" = ep."Id" AND "IsDeleted" = false
        ORDER BY "IsFeatured" DESC, "Created" DESC
        LIMIT 1
    ) l ON true;

    RETURN jsonb_build_object(
        'data', COALESCE(v_result_data, ARRAY[]::jsonb[]),
        'total', v_total_count,
        'page', p_page,
        'limit', p_limit
    );
END;
$$;


--
-- Name: guest_has_overlapping_booking(uuid, timestamp with time zone, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guest_has_overlapping_booking(p_guest_id uuid, p_check_in timestamp with time zone, p_check_out timestamp with time zone, p_exclude_booking_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public."Bookings" b
    where b."GuestId" = p_guest_id
      and b."IsDeleted" = false
      and b."Status" <> 2
      and (p_exclude_booking_id is null or b."Id" <> p_exclude_booking_id)
      and b."CheckInDate" < p_check_out
      and b."CheckOutDate" > p_check_in
  );
$$;


--
-- Name: FUNCTION guest_has_overlapping_booking(p_guest_id uuid, p_check_in timestamp with time zone, p_check_out timestamp with time zone, p_exclude_booking_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.guest_has_overlapping_booking(p_guest_id uuid, p_check_in timestamp with time zone, p_check_out timestamp with time zone, p_exclude_booking_id uuid) IS 'True when the guest has a non-cancelled booking overlapping [check_in, check_out) (half-open; same-day checkout/check-in allowed).';


--
-- Name: guest_review_is_eligible_now(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guest_review_is_eligible_now(p_check_out timestamp with time zone, p_now timestamp with time zone DEFAULT now()) RETURNS boolean
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_window jsonb;
  v_window_start timestamptz;
  v_window_end timestamptz;
begin
  v_window := public.compute_guest_review_window(p_check_out);
  v_window_start := (v_window->>'windowStart')::timestamptz;
  v_window_end := (v_window->>'windowEnd')::timestamptz;

  return p_now >= v_window_start and p_now <= v_window_end;
end;
$$;


--
-- Name: handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public."Members" (
    "Id",
    "UserId",
    "FirstName",
    "LastName",
    "Email",
    "IsDeleted",
    "Role",
    "Created",
    "LastModified",
    "NeedsOnboarding"
  )
  values (
    gen_random_uuid(),
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), ''),
    new.email,
    false,
    'user',
    now(),
    now(),
    true
  );
  return new;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public."Members" (
    "Id",
    "UserId",
    "Email",
    "FirstName",
    "LastName",
    "Role",
    "IsDeleted",
    "Created",
    "LastModified"
  )
  values (
    gen_random_uuid(),
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'firstName', ''),
    nullif(new.raw_user_meta_data ->> 'lastName', ''),
    'user',
    false,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict ("UserId") do update
  set
    "Email" = excluded."Email",
    "FirstName" = coalesce(excluded."FirstName", public."Members"."FirstName"),
    "LastName" = coalesce(excluded."LastName", public."Members"."LastName"),
    "LastModified" = timezone('utc', now());

  return new;
end;
$$;


--
-- Name: insert_listing(uuid, text, text, text, timestamp with time zone, integer, integer, numeric, numeric, text, boolean, numeric, boolean, boolean, boolean, integer, boolean, boolean, boolean, boolean, numeric, numeric, numeric, boolean, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_listing(p_estate_property_id uuid, p_listing_type text, p_title text, p_description text DEFAULT NULL::text, p_available_from timestamp with time zone DEFAULT now(), p_capacity integer DEFAULT NULL::integer, p_currency integer DEFAULT 0, p_sale_price numeric DEFAULT NULL::numeric, p_rent_price numeric DEFAULT NULL::numeric, p_rent_price_period text DEFAULT NULL::text, p_has_common_expenses boolean DEFAULT NULL::boolean, p_common_expenses_value numeric DEFAULT NULL::numeric, p_is_electricity_included boolean DEFAULT NULL::boolean, p_is_water_included boolean DEFAULT NULL::boolean, p_is_price_visible boolean DEFAULT true, p_status integer DEFAULT NULL::integer, p_is_active boolean DEFAULT true, p_is_property_visible boolean DEFAULT true, p_is_featured boolean DEFAULT false, p_blocked_for_booking boolean DEFAULT false, p_base_price numeric DEFAULT NULL::numeric, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_long_stay_discount_enabled boolean DEFAULT false, p_long_stay_min_days integer DEFAULT NULL::integer, p_long_stay_discount_percentage numeric DEFAULT NULL::numeric) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid := gen_random_uuid();
  v_period public."RentPricePeriod" := null;
  v_rent numeric := p_rent_price;
  v_base numeric := p_base_price;
begin
  if p_rent_price_period is not null and p_rent_price_period not in ('PerNight', 'PerMonth') then
    raise exception 'Invalid rent price period: %', p_rent_price_period;
  end if;

  if p_rent_price_period is not null then
    v_period := p_rent_price_period::public."RentPricePeriod";
  end if;

  if v_base is not null and v_rent is null then
    v_rent := v_base;
  elsif v_rent is not null and v_base is null then
    v_base := v_rent;
  end if;

  insert into public."Listings" (
    "Id", "EstatePropertyId", "ListingType", "Title", "Description", "AvailableFrom",
    "Capacity", "Currency", "SalePrice", "RentPrice", "RentPricePeriod",
    "HasCommonExpenses", "CommonExpensesValue", "IsElectricityIncluded", "IsWaterIncluded",
    "IsPriceVisible", "Status", "IsActive", "IsPropertyVisible", "IsFeatured",
    "BlockedForBooking", "BasePrice", "MinPrice", "MaxPrice",
    "LongStayDiscountEnabled", "LongStayMinDays", "LongStayDiscountPercentage",
    "IsDeleted", "Created", "LastModified"
  ) values (
    v_id, p_estate_property_id, p_listing_type::public."ListingType", p_title, p_description,
    coalesce(p_available_from, now()), p_capacity, p_currency, p_sale_price, v_rent, v_period,
    p_has_common_expenses, p_common_expenses_value, p_is_electricity_included, p_is_water_included,
    p_is_price_visible, p_status, p_is_active, p_is_property_visible, p_is_featured,
    p_blocked_for_booking, v_base, p_min_price, p_max_price,
    coalesce(p_long_stay_discount_enabled, false), p_long_stay_min_days, p_long_stay_discount_percentage,
    false, now(), now()
  );

  return v_id;
end;
$$;


--
-- Name: insert_property_details_section(uuid, text, text, text, text, jsonb, integer, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_property_details_section(p_property_id uuid, p_name text, p_description text DEFAULT NULL::text, p_property_type text DEFAULT NULL::text, p_layout_type text DEFAULT 'split'::text, p_layout_config jsonb DEFAULT NULL::jsonb, p_display_order integer DEFAULT 0, p_localized_name jsonb DEFAULT NULL::jsonb, p_localized_description jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_section_id uuid := gen_random_uuid();
  v_layout_type text := lower(coalesce(nullif(trim(p_layout_type), ''), 'split'));
  v_name jsonb;
  v_description jsonb;
  v_property_type public."PropertyType";
begin
  if p_property_id is null then
    raise exception 'p_property_id is required';
  end if;

  v_name := public.sanitize_localized_text_json(coalesce(
    p_localized_name,
    case when nullif(btrim(coalesce(p_name, '')), '') is not null
      then jsonb_build_object('es', btrim(p_name))
      else '{}'::jsonb
    end
  ));

  if v_name = '{}'::jsonb then
    raise exception 'Section name (localized) is required';
  end if;

  v_description := public.sanitize_localized_text_json(coalesce(
    p_localized_description,
    case when nullif(btrim(coalesce(p_description, '')), '') is not null
      then jsonb_build_object('es', btrim(p_description))
      else '{}'::jsonb
    end
  ));

  if v_layout_type not in ('split', 'carousel', 'stacked') then
    raise exception 'Invalid layout type: %', p_layout_type;
  end if;

  v_property_type := nullif(btrim(coalesce(p_property_type, '')), '')::public."PropertyType";

  insert into public.propertydetailssection (
    id, propertyid, name, description, localizedname, localizeddescription,
    propertytype, layouttype, layoutconfig, displayorder, isdeleted, createdat, updatedat
  ) values (
    v_section_id,
    p_property_id,
    coalesce(v_name->>'es', v_name->>'en', v_name->>'pt', ''),
    coalesce(v_description->>'es', v_description->>'en', v_description->>'pt', ''),
    v_name,
    v_description,
    v_property_type,
    v_layout_type,
    p_layout_config,
    greatest(coalesce(p_display_order, 0), 0),
    false,
    now(),
    now()
  );

  return v_section_id;
end;
$$;


--
-- Name: FUNCTION insert_property_details_section(p_property_id uuid, p_name text, p_description text, p_property_type text, p_layout_type text, p_layout_config jsonb, p_display_order integer, p_localized_name jsonb, p_localized_description jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.insert_property_details_section(p_property_id uuid, p_name text, p_description text, p_property_type text, p_layout_type text, p_layout_config jsonb, p_display_order integer, p_localized_name jsonb, p_localized_description jsonb) IS 'Creates one marketing/details section for a property wizard submission (localized fields).';


--
-- Name: insert_property_document(uuid, text, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_property_document(p_estate_property_id uuid, p_name text, p_file_type text, p_url text, p_is_public boolean DEFAULT true) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_document_id uuid := gen_random_uuid();
BEGIN
    INSERT INTO "PropertyDocuments" (
        "Id",
        "Name",
        "FileType",
        "Url",
        "EstatePropertyId",
        "IsPublic",
        "IsDeleted",
        "Created",
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    ) VALUES (
        v_document_id,
        p_name,
        p_file_type,
        p_url,
        p_estate_property_id,
        p_is_public,
        false,
        now(),
        NULL,
        now(),
        NULL
    );

    RETURN v_document_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to insert property document for estate property %: %', p_estate_property_id, SQLERRM;
END;
$$;


--
-- Name: insert_property_extension(uuid, text, boolean, boolean, boolean, double precision, integer, boolean, text, boolean, integer, boolean, boolean, text, text, integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_property_extension(p_property_id uuid, p_extension_type text, p_allows_financing boolean DEFAULT NULL::boolean, p_is_new_construction boolean DEFAULT NULL::boolean, p_has_mortgage boolean DEFAULT NULL::boolean, p_hoa_fees double precision DEFAULT NULL::double precision, p_min_contract_months integer DEFAULT NULL::integer, p_requires_guarantee boolean DEFAULT NULL::boolean, p_guarantee_type text DEFAULT NULL::text, p_allows_pets boolean DEFAULT NULL::boolean, p_max_guests integer DEFAULT NULL::integer, p_has_catering boolean DEFAULT NULL::boolean, p_has_sound_system boolean DEFAULT NULL::boolean, p_closing_hour text DEFAULT NULL::text, p_allowed_events_description text DEFAULT NULL::text, p_min_stay_days integer DEFAULT NULL::integer, p_max_stay_days integer DEFAULT NULL::integer, p_lead_time_days integer DEFAULT NULL::integer, p_buffer_days integer DEFAULT NULL::integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public."PropertyExtensions" (
    "EstatePropertyId",
    "ExtensionType",
    "AllowsFinancing",
    "IsNewConstruction",
    "HasMortgage",
    "HoaFees",
    "MinContractMonths",
    "RequiresGuarantee",
    "GuaranteeType",
    "AllowsPets",
    "MaxGuests",
    "HasCatering",
    "HasSoundSystem",
    "ClosingHour",
    "AllowedEventsDescription",
    "MinStayDays",
    "MaxStayDays",
    "LeadTimeDays",
    "BufferDays",
    "IsDeleted",
    "Created",
    "LastModified"
  )
  values (
    p_property_id,
    p_extension_type,
    p_allows_financing,
    p_is_new_construction,
    p_has_mortgage,
    p_hoa_fees,
    p_min_contract_months,
    p_requires_guarantee,
    p_guarantee_type,
    p_allows_pets,
    p_max_guests,
    p_has_catering,
    p_has_sound_system,
    p_closing_hour,
    p_allowed_events_description,
    p_min_stay_days,
    p_max_stay_days,
    p_lead_time_days,
    p_buffer_days,
    false,
    now(),
    now()
  );
end;
$$;


--
-- Name: insert_property_image(uuid, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_property_image(p_estate_property_id uuid, p_url text, p_alt_text text DEFAULT NULL::text, p_is_main boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_image_id uuid := gen_random_uuid();
BEGIN
    INSERT INTO "PropertyImages" (
        "Id",
        "Url",
        "AltText",
        "IsMain",
        "EstatePropertyId",
        "IsDeleted",
        "Created",
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    ) VALUES (
        v_image_id,
        p_url,
        p_alt_text,
        p_is_main,
        p_estate_property_id,
        false,
        now(),
        NULL,
        now(),
        NULL
    );

    RETURN v_image_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to insert property image for estate property %: %', p_estate_property_id, SQLERRM;
END;
$$;


--
-- Name: insert_property_section_image(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_property_section_image(p_section_id uuid, p_property_image_id uuid, p_display_order integer DEFAULT 0) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_relation_id uuid := gen_random_uuid();
begin
  if p_section_id is null then
    raise exception 'p_section_id is required';
  end if;

  if p_property_image_id is null then
    raise exception 'p_property_image_id is required';
  end if;

  insert into public.propertysectionimages (
    id,
    sectionid,
    propertyimageid,
    displayorder,
    createdat,
    updatedat
  ) values (
    v_relation_id,
    p_section_id,
    p_property_image_id,
    greatest(coalesce(p_display_order, 0), 0),
    now(),
    now()
  );

  return v_relation_id;
end;
$$;


--
-- Name: FUNCTION insert_property_section_image(p_section_id uuid, p_property_image_id uuid, p_display_order integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.insert_property_section_image(p_section_id uuid, p_property_image_id uuid, p_display_order integer) IS 'Links a property image to a property details section with display order.';


--
-- Name: insert_property_video(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_property_video(p_estate_property_id uuid, p_url text, p_title text DEFAULT NULL::text, p_description text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_video_id uuid := gen_random_uuid();
BEGIN
    INSERT INTO "PropertyVideos" (
        "Id",
        "Url",
        "Title",
        "Description",
        "EstatePropertyId",
        "IsDeleted",
        "Created",
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    ) VALUES (
        v_video_id,
        p_url,
        p_title,
        p_description,
        p_estate_property_id,
        false,
        now(),
        NULL,
        now(),
        NULL
    );

    RETURN v_video_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to insert property video for estate property %: %', p_estate_property_id, SQLERRM;
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and lower(trim(m."Role"::text)) = 'admin'
  );
$$;


--
-- Name: is_company_manager(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_company_manager(_company_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public."CompanyMembers" cm
    join public."Members" m
      on m."Id" = cm."MemberId"
     and m."IsDeleted" = false
    where cm."CompanyId" = _company_id
      and cm."IsDeleted" = false
      and cm."Role" in ('Admin', 'Manager')
      and m."UserId" = auth.uid()
  );
$$;


--
-- Name: is_property_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_property_owner(p_user_id uuid, p_property_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public."EstateProperties" ep
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    where ep."Id" = p_property_id
      and ep."IsDeleted" = false
      and (
        (
          o."OwnerType" = 'member'
          and exists (
            select 1
            from public."Members" m
            where m."Id" = o."MemberId"
              and m."UserId" = p_user_id
              and m."IsDeleted" = false
          )
        )
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            join public."Members" m
              on m."Id" = cm."MemberId"
             and m."IsDeleted" = false
            where cm."CompanyId" = o."CompanyId"
              and cm."IsDeleted" = false
              and cm."Role" in ('Admin', 'Manager')
              and m."UserId" = p_user_id
          )
        )
      )
  );
$$;


--
-- Name: FUNCTION is_property_owner(p_user_id uuid, p_property_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_property_owner(p_user_id uuid, p_property_id uuid) IS 'True when p_user_id (auth.users id) owns or manages the estate property via Owners / CompanyMembers.';


--
-- Name: is_public_estate_property(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_public_estate_property(p_estate_property_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public."EstateProperties" ep
    where ep."Id" = p_estate_property_id
      and ep."IsDeleted" = false
  );
$$;


--
-- Name: is_valid_amenity_localized_descriptions(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_valid_amenity_localized_descriptions(p jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select jsonb_typeof(coalesce(p, '{}'::jsonb)) = 'object'
    and coalesce(p, '{}'::jsonb) - 'en' - 'es' - 'pt' = '{}'::jsonb;
$$;


--
-- Name: is_valid_localized_text_json(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_valid_localized_text_json(p jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select jsonb_typeof(coalesce(p, '{}'::jsonb)) = 'object'
    and coalesce(p, '{}'::jsonb) - 'en' - 'es' - 'pt' = '{}'::jsonb;
$$;


--
-- Name: issue_booking_manage_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.issue_booking_manage_token(p_booking_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_raw_token text;
  v_token_hash text;
begin
  v_raw_token := encode(gen_random_bytes(24), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

  insert into public.booking_manage_tokens (booking_id, token_hash, expires_at)
  values (p_booking_id, v_token_hash, now() + interval '30 days');

  return jsonb_build_object(
    'success', true,
    'token', v_raw_token,
    'expires_at', now() + interval '30 days'
  );
end;
$$;


--
-- Name: mark_thread_messages_as_read(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_thread_messages_as_read(p_user_id uuid, p_thread_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
    v_member_id uuid;
begin
    -- Resolve auth user to member
    select "Id" into v_member_id
    from "Members"
    where "UserId" = p_user_id
      and "IsDeleted" = false;

    if v_member_id is null then
        raise exception 'User not authenticated';
    end if;

    -- Mark all messages in the thread as read for this member
    update "MessageRecipients" mr
    set
      "IsRead" = true,
      "LastModified" = now(),
      "LastModifiedBy" = 'mark_thread_messages_as_read'
    from "Messages" m
    where mr."MessageId" = m."Id"
      and m."ThreadId" = p_thread_id
      and mr."RecipientId" = v_member_id
      and mr."IsDeleted" = false
      and mr."IsRead" = false;
end;
$$;


--
-- Name: member_rpc_caller_ok(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.member_rpc_caller_ok(p_member_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public."Members" m
    where m."Id" = p_member_id
      and m."IsDeleted" = false
      and m."UserId" = auth.uid()
  )
  or exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and lower(coalesce(m."Role"::text, '')) = 'admin'
  );
$$;


--
-- Name: parse_period(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.parse_period(p_period text) RETURNS TABLE(start_date timestamp with time zone, end_date timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := NOW();
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    CASE LOWER(p_period)
        WHEN 'last7days' THEN
            v_end_date := v_now;
            v_start_date := v_now - INTERVAL '7 days';
        WHEN 'last30days' THEN
            v_end_date := v_now;
            v_start_date := v_now - INTERVAL '30 days';
        WHEN 'last90days' THEN
            v_end_date := v_now;
            v_start_date := v_now - INTERVAL '90 days';
        WHEN 'thisyear' THEN
            v_start_date := DATE_TRUNC('year', v_now);
            v_end_date := v_now;
        ELSE
            -- Default to last 30 days
            v_end_date := v_now;
            v_start_date := v_now - INTERVAL '30 days';
    END CASE;

    RETURN QUERY SELECT v_start_date, v_end_date;
END;
$$;


--
-- Name: portal_search_properties(text, text, numeric, numeric, numeric, numeric, text, text, numeric, numeric, integer, integer, uuid[], date, date, numeric, numeric, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portal_search_properties(p_listing_type text, p_site_scope text DEFAULT NULL::text, p_sw_lat numeric DEFAULT NULL::numeric, p_ne_lat numeric DEFAULT NULL::numeric, p_sw_lng numeric DEFAULT NULL::numeric, p_ne_lng numeric DEFAULT NULL::numeric, p_city text DEFAULT NULL::text, p_search_text text DEFAULT NULL::text, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_bedrooms_min integer DEFAULT NULL::integer, p_capacity_min integer DEFAULT NULL::integer, p_amenity_ids uuid[] DEFAULT NULL::uuid[], p_check_in date DEFAULT NULL::date, p_check_out date DEFAULT NULL::date, p_center_lat numeric DEFAULT NULL::numeric, p_center_lng numeric DEFAULT NULL::numeric, p_availability_mode text DEFAULT 'stay'::text, p_limit integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_listing_type text;
  v_site_scope text;
  v_params jsonb;
  v_pool_size int;
  v_check_in date;
  v_check_out date;
  v_check_in_ts timestamptz;
  v_check_out_ts timestamptz;
  v_availability_mode text;
  v_has_dates boolean;
  v_window_days int;
  v_result jsonb;
begin
  v_listing_type := public.validate_guest_site_listing_type(p_listing_type)::text;
  v_site_scope := coalesce(nullif(trim(p_site_scope), ''), v_listing_type);
  v_params := public.get_app_parameters(v_site_scope);
  v_pool_size := coalesce(
    p_limit,
    public.search_param_num(v_params, 'SEARCH_CANDIDATE_POOL_SIZE', 500)::int
  );

  v_availability_mode := coalesce(nullif(lower(trim(p_availability_mode)), ''), 'stay');
  if v_availability_mode not in ('stay', 'any_day_in_range') then
    raise exception 'Invalid p_availability_mode: %', p_availability_mode
      using errcode = '22023';
  end if;

  v_check_in := p_check_in;
  v_check_out := coalesce(p_check_out, p_check_in);

  if v_check_in is not null and v_check_out is null then
    v_check_out := v_check_in;
  end if;

  if v_availability_mode = 'stay' then
    v_has_dates := v_check_in is not null
      and v_check_out is not null
      and v_check_in < v_check_out;
  else
    v_has_dates := v_check_in is not null
      and v_check_out is not null
      and v_check_out >= v_check_in;
  end if;

  if v_has_dates then
    v_check_in_ts := v_check_in::timestamptz;
    v_check_out_ts := v_check_out::timestamptz;
    v_window_days := (v_check_out - v_check_in) + 1;
  end if;

  with featured_listing as (
    select distinct on (l."EstatePropertyId")
      l."Id" as listing_id,
      l."EstatePropertyId",
      l."ListingType"::text as listing_type,
      l."Title",
      l."Description",
      l."RentPrice",
      l."BasePrice",
      l."Currency",
      l."Capacity" as listing_capacity,
      l."BlockedForBooking"
    from public."Listings" l
    where l."IsDeleted" = false
      and l."IsActive" = true
      and l."IsPropertyVisible" = true
      and l."ListingType"::text = v_listing_type
    order by l."EstatePropertyId", l."IsFeatured" desc nulls last, l."Created" desc
  ),
  base as (
    select
      ep."Id" as estate_property_id,
      fl.listing_id,
      fl.listing_type,
      fl."Title" as title,
      fl."Description" as description,
      coalesce(fl."BasePrice", fl."RentPrice") as display_price,
      fl."Currency" as currency,
      ep."City" as city,
      ep."State" as state,
      ep."Country" as country,
      ep."Neighborhood" as neighborhood,
      ep."Bedrooms" as bedrooms,
      ep."Bathrooms" as bathrooms,
      ep."Capacity" as capacity,
      ep."OwnerId" as owner_id,
      ep."LocationLatitude" as lat,
      ep."LocationLongitude" as lng,
      ep."AreaValue" as area_value,
      ep."AreaUnit" as area_unit,
      fl."BlockedForBooking" as blocked_for_booking,
      coalesce(pss."Scores", '{}'::jsonb) as scores,
      coalesce((pss."Scores" ->> 'offline_base_score')::numeric, 0) as offline_base_score
    from public."EstateProperties" ep
    join featured_listing fl on fl."EstatePropertyId" = ep."Id"
    left join public."PropertySearchScores" pss
      on pss."EstatePropertyId" = ep."Id"
     and pss."ListingType" = v_listing_type
    where ep."IsDeleted" = false
      and (p_sw_lat is null or ep."LocationLatitude" between least(p_sw_lat, p_ne_lat) and greatest(p_sw_lat, p_ne_lat))
      and (p_sw_lng is null or ep."LocationLongitude" between least(p_sw_lng, p_ne_lng) and greatest(p_sw_lng, p_ne_lng))
      and (p_city is null or ep."City" ilike '%' || trim(p_city) || '%')
      and (
        p_search_text is null
        or fl."Title" ilike '%' || trim(p_search_text) || '%'
        or ep."City" ilike '%' || trim(p_search_text) || '%'
        or coalesce(ep."Neighborhood", '') ilike '%' || trim(p_search_text) || '%'
      )
      and (p_bedrooms_min is null or ep."Bedrooms" >= p_bedrooms_min)
      and (p_capacity_min is null or greatest(coalesce(ep."Capacity", 0), coalesce(fl.listing_capacity, 0)) >= p_capacity_min)
      and (
        p_min_price is null
        or coalesce(fl."BasePrice", fl."RentPrice", 0) >= p_min_price
      )
      and (
        p_max_price is null
        or coalesce(fl."BasePrice", fl."RentPrice", 0) <= p_max_price
      )
      and (
        p_amenity_ids is null
        or cardinality(p_amenity_ids) = 0
        or not exists (
          select 1
          from unnest(p_amenity_ids) aid
          where not exists (
            select 1
            from public."EstatePropertyAmenity" epa
            where epa."EstatePropertyId" = ep."Id"
              and epa."AmenityId" = aid
          )
        )
      )
      and (
        not v_has_dates
        or v_availability_mode <> 'stay'
        or not exists (
          select 1
          from public."Bookings" b
          where b."EstatePropertyId" = ep."Id"
            and b."IsDeleted" = false
            and b."Status" <> 2
            and b."CheckInDate" < v_check_out_ts
            and b."CheckOutDate" > v_check_in_ts
            and (b."ListingType" is null or b."ListingType"::text = v_listing_type)
        )
      )
      and (
        not v_has_dates
        or v_availability_mode <> 'stay'
        or to_regclass('public.booking_holds') is null
        or not exists (
          select 1
          from public.booking_holds h
          where h.property_id = ep."Id"
            and h.status = 'pending'
            and h.expires_at > now()
            and h.check_in < v_check_out
            and h.check_out > v_check_in
            and (h.listing_type is null or h.listing_type = v_listing_type)
        )
      )
      and (
        not v_has_dates
        or v_availability_mode <> 'stay'
        or to_regclass('public."AvailabilityBlocks"') is null
        or not exists (
          select 1
          from public."AvailabilityBlocks" ab
          where ab."EstatePropertyId" = ep."Id"
            and ab."IsAvailable" = false
            and ab."StartDate" < v_check_out_ts
            and ab."EndDate" > v_check_in_ts
        )
      )
      and (
        not v_has_dates
        or v_availability_mode <> 'any_day_in_range'
        or exists (
          select 1
          from generate_series(v_check_in, v_check_out, interval '1 day') as gs(day_d)
          where not exists (
            select 1
            from public."Bookings" b
            where b."EstatePropertyId" = ep."Id"
              and b."IsDeleted" = false
              and b."Status" <> 2
              and b."CheckInDate" < (gs.day_d + interval '1 day')
              and b."CheckOutDate" > gs.day_d::timestamptz
              and (b."ListingType" is null or b."ListingType"::text = v_listing_type)
          )
          and (
            to_regclass('public.booking_holds') is null
            or not exists (
              select 1
              from public.booking_holds h
              where h.property_id = ep."Id"
                and h.status = 'pending'
                and h.expires_at > now()
                and h.check_in < (gs.day_d + interval '1 day')::date
                and h.check_out > gs.day_d::date
                and (h.listing_type is null or h.listing_type = v_listing_type)
            )
          )
          and (
            to_regclass('public."AvailabilityBlocks"') is null
            or not exists (
              select 1
              from public."AvailabilityBlocks" ab
              where ab."EstatePropertyId" = ep."Id"
                and ab."IsAvailable" = false
                and ab."StartDate" < (gs.day_d + interval '1 day')
                and ab."EndDate" > gs.day_d::timestamptz
            )
          )
        )
      )
  ),
  scored as (
    select
      b.*,
      case
        when not v_has_dates then 100
        when b.blocked_for_booking then 0
        when v_availability_mode = 'stay' then 100
        else coalesce((
          select round(
            (count(*) filter (where day_free)::numeric / greatest(v_window_days, 1)::numeric) * 100,
            2
          )
          from (
            select not exists (
              select 1
              from public."Bookings" bk
              where bk."EstatePropertyId" = b.estate_property_id
                and bk."IsDeleted" = false
                and bk."Status" <> 2
                and bk."CheckInDate" < (gs.day_d + interval '1 day')
                and bk."CheckOutDate" > gs.day_d::timestamptz
                and (bk."ListingType" is null or bk."ListingType"::text = v_listing_type)
            )
            and (
              to_regclass('public.booking_holds') is null
              or not exists (
                select 1
                from public.booking_holds hh
                where hh.property_id = b.estate_property_id
                  and hh.status = 'pending'
                  and hh.expires_at > now()
                  and hh.check_in < (gs.day_d + interval '1 day')::date
                  and hh.check_out > gs.day_d::date
                  and (hh.listing_type is null or hh.listing_type = v_listing_type)
              )
            )
            and (
              to_regclass('public."AvailabilityBlocks"') is null
              or not exists (
                select 1
                from public."AvailabilityBlocks" abl
                where abl."EstatePropertyId" = b.estate_property_id
                  and abl."IsAvailable" = false
                  and abl."StartDate" < (gs.day_d + interval '1 day')
                  and abl."EndDate" > gs.day_d::timestamptz
              )
            ) as day_free
            from generate_series(v_check_in, v_check_out, interval '1 day') as gs(day_d)
          ) day_scores
        ), 0)
      end as availability_score,
      case
        when p_center_lat is null or p_center_lng is null then 50
        else greatest(
          0,
          100 - least(
            100,
            (
              6371 * acos(
                least(1, greatest(-1,
                  cos(radians(p_center_lat)) * cos(radians(b.lat))
                  * cos(radians(b.lng) - radians(p_center_lng))
                  + sin(radians(p_center_lat)) * sin(radians(b.lat))
                ))
              ) / 50.0
            ) * 100
          )
        )
      end as distance_score
    from base b
  )
  select jsonb_build_object(
    'items',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'estatePropertyId', s.estate_property_id,
          'listingId', s.listing_id,
          'listingType', s.listing_type,
          'title', s.title,
          'description', s.description,
          'displayPrice', s.display_price,
          'currency', s.currency,
          'city', s.city,
          'state', s.state,
          'country', s.country,
          'neighborhood', s.neighborhood,
          'bedrooms', s.bedrooms,
          'bathrooms', s.bathrooms,
          'capacity', s.capacity,
          'ownerId', s.owner_id,
          'lat', s.lat,
          'lng', s.lng,
          'areaValue', s.area_value,
          'areaUnit', s.area_unit,
          'blockedForBooking', s.blocked_for_booking,
          'scores', s.scores,
          'offlineBaseScore', s.offline_base_score,
          'onlineBoosts', jsonb_build_object(
            'availability_score', round(s.availability_score::numeric, 2),
            'distance_score', round(s.distance_score::numeric, 2)
          )
        )
        order by s.offline_base_score desc, s.estate_property_id
      ),
      '[]'::jsonb
    ),
    'total', (select count(*) from scored)
  )
  into v_result
  from (
    select * from scored
    order by offline_base_score desc, estate_property_id
    limit v_pool_size
  ) s;

  return coalesce(v_result, jsonb_build_object('items', '[]'::jsonb, 'total', 0));
end;
$$;


--
-- Name: FUNCTION portal_search_properties(p_listing_type text, p_site_scope text, p_sw_lat numeric, p_ne_lat numeric, p_sw_lng numeric, p_ne_lng numeric, p_city text, p_search_text text, p_min_price numeric, p_max_price numeric, p_bedrooms_min integer, p_capacity_min integer, p_amenity_ids uuid[], p_check_in date, p_check_out date, p_center_lat numeric, p_center_lng numeric, p_availability_mode text, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.portal_search_properties(p_listing_type text, p_site_scope text, p_sw_lat numeric, p_ne_lat numeric, p_sw_lng numeric, p_ne_lng numeric, p_city text, p_search_text text, p_min_price numeric, p_max_price numeric, p_bedrooms_min integer, p_capacity_min integer, p_amenity_ids uuid[], p_check_in date, p_check_out date, p_center_lat numeric, p_center_lng numeric, p_availability_mode text, p_limit integer) IS 'Portal property search with hard filters, precomputed scores, and online boosts. p_availability_mode: stay (entire window free) or any_day_in_range (single-day event free on at least one day in inclusive window).';


--
-- Name: pricing_clamp(numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pricing_clamp(p_amount numeric, p_min numeric, p_max numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when p_min is not null and p_amount < p_min then p_min
    when p_max is not null and p_amount > p_max then p_max
    else p_amount
  end;
$$;


--
-- Name: pricing_commercial_round(numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pricing_commercial_round(p_amount numeric, p_mode text) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  v_mode text := lower(coalesce(p_mode, 'none'));
begin
  if v_mode = 'tens' then
    return round(p_amount / 10.0) * 10.0;
  elsif v_mode = 'ending_99' then
    if p_amount <= 0 then
      return 0;
    end if;
    return floor(p_amount / 100.0) * 100.0 + 99.0;
  end if;
  return round(p_amount::numeric, 2);
end;
$$;


--
-- Name: pricing_compute_nightly(uuid, numeric, numeric, numeric, date, jsonb, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pricing_compute_nightly(p_listing_id uuid, p_base_price numeric, p_min_price numeric, p_max_price numeric, p_date date, p_params jsonb, p_search_date date DEFAULT CURRENT_DATE) RETURNS numeric
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_raw numeric;
  v_season numeric;
  v_special numeric;
  v_demand numeric;
  v_anticipation numeric := 1.0;
  v_days_until integer;
  v_round_mode text;
begin
  if p_base_price is null or p_base_price <= 0 then
    return null;
  end if;

  v_season := public.pricing_resolve_season_factor(p_params, p_date);
  v_special := public.pricing_resolve_special_factor(p_params, p_date);
  v_demand := public.pricing_resolve_demand_factor(p_listing_id, p_date);

  v_days_until := p_date - coalesce(p_search_date, current_date);
  if v_days_until >= public.pricing_param_number(p_params, 'ANTICIPATION_MIN_DAYS', 30)::integer then
    v_anticipation := public.pricing_param_number(p_params, 'ANTICIPATION_MULTIPLIER', 0.95);
  end if;

  v_raw := p_base_price * v_season * v_special * v_demand * v_anticipation;
  v_raw := public.pricing_clamp(v_raw, p_min_price, p_max_price);
  v_round_mode := coalesce(p_params ->> 'PRICE_ROUNDING_MODE', 'tens');
  return public.pricing_commercial_round(v_raw, v_round_mode);
end;
$$;


--
-- Name: pricing_compute_stay_total(uuid, uuid, text, date, date, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pricing_compute_stay_total(p_listing_id uuid, p_estate_property_id uuid, p_listing_type text, p_check_in date, p_check_out date, p_site_scope text DEFAULT 'SummerRent'::text, p_search_date date DEFAULT CURRENT_DATE) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_listing record;
  v_params jsonb;
  v_nights integer;
  v_d date;
  v_sum numeric := 0;
  v_nightly numeric;
  v_stay_factor numeric := 1.0;
  v_total numeric;
  v_avg numeric;
begin
  select l.*
  into v_listing
  from public."Listings" l
  where l."EstatePropertyId" = p_estate_property_id
    and l."ListingType" = p_listing_type::public."ListingType"
    and l."IsDeleted" = false
    and l."IsFeatured" = true
  order by l."LastModified" desc
  limit 1;

  if v_listing."Id" is null then
    return jsonb_build_object(
      'is_valid', false,
      'errors', jsonb_build_array('Listing not found'),
      'pricing', null
    );
  end if;

  if v_listing."BasePrice" is null then
    -- Legacy: use RentPrice as base
    if v_listing."RentPrice" is null then
      return jsonb_build_object(
        'is_valid', false,
        'errors', jsonb_build_array('Listing has no base price'),
        'pricing', null
      );
    end if;
    v_listing."BasePrice" := v_listing."RentPrice";
  end if;

  v_params := public.get_app_parameters(coalesce(nullif(trim(p_site_scope), ''), 'global'));
  v_nights := (p_check_out - p_check_in);

  if v_nights <= 0 then
    return jsonb_build_object(
      'is_valid', false,
      'errors', jsonb_build_array('Invalid date range'),
      'pricing', null
    );
  end if;

  v_d := p_check_in;
  while v_d < p_check_out loop
    v_nightly := public.pricing_compute_nightly(
      v_listing."Id",
      v_listing."BasePrice",
      v_listing."MinPrice",
      v_listing."MaxPrice",
      v_d,
      v_params,
      p_search_date
    );
    v_sum := v_sum + coalesce(v_nightly, 0);
    v_d := v_d + 1;
  end loop;

  if v_listing."LongStayDiscountEnabled"
     and v_listing."LongStayMinDays" is not null
     and v_nights >= v_listing."LongStayMinDays"
     and v_listing."LongStayDiscountPercentage" is not null then
    v_stay_factor := greatest(
      0,
      1.0 - (v_listing."LongStayDiscountPercentage" / 100.0)
    );
    v_sum := v_sum * v_stay_factor;
  end if;

  v_total := round(v_sum::numeric, 2);
  v_avg := case when v_nights > 0 then round((v_total / v_nights)::numeric, 2) else v_total end;

  return jsonb_build_object(
    'is_valid', true,
    'errors', '[]'::jsonb,
    'pricing', jsonb_build_object(
      'nightly_price', v_avg,
      'nights', v_nights,
      'total_price', v_total,
      'listing_id', v_listing."Id"
    )
  );
end;
$$;


--
-- Name: pricing_date_in_mmdd_range(date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pricing_date_in_mmdd_range(p_date date, p_from text, p_to text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  v_d text := to_char(p_date, 'MM-DD');
  v_from text := p_from;
  v_to text := p_to;
begin
  if v_from <= v_to then
    return v_d >= v_from and v_d <= v_to;
  end if;
  return v_d >= v_from or v_d <= v_to;
end;
$$;


--
-- Name: pricing_param_number(jsonb, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pricing_param_number(p_params jsonb, p_key text, p_default numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce((p_params ->> p_key)::numeric, p_default);
$$;


--
-- Name: pricing_resolve_demand_factor(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pricing_resolve_demand_factor(p_listing_id uuid, p_date date) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (
      select ldf."DemandFactor"
      from public."ListingDailyFactors" ldf
      where ldf."ListingId" = p_listing_id
        and ldf."Date" = p_date
      limit 1
    ),
    1.0
  );
$$;


--
-- Name: pricing_resolve_season_factor(jsonb, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pricing_resolve_season_factor(p_params jsonb, p_date date) RETURNS numeric
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_tier text := 'mid';
  v_entry jsonb;
  v_from text;
  v_to text;
begin
  for v_entry in
    select * from jsonb_array_elements(coalesce(p_params -> 'SEASON_CALENDAR', '[]'::jsonb))
  loop
    v_from := v_entry ->> 'from';
    v_to := v_entry ->> 'to';
    if v_from is not null and v_to is not null
       and public.pricing_date_in_mmdd_range(p_date, v_from, v_to) then
      v_tier := lower(coalesce(v_entry ->> 'tier', 'mid'));
      exit;
    end if;
  end loop;

  return case v_tier
    when 'low' then public.pricing_param_number(p_params, 'SEASON_FACTOR_LOW', 0.9)
    when 'high' then public.pricing_param_number(p_params, 'SEASON_FACTOR_HIGH', 1.2)
    else public.pricing_param_number(p_params, 'SEASON_FACTOR_MID', 1.0)
  end;
end;
$$;


--
-- Name: pricing_resolve_special_factor(jsonb, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pricing_resolve_special_factor(p_params jsonb, p_date date) RETURNS numeric
    LANGUAGE plpgsql STABLE
    AS $$
declare
  v_entry jsonb;
  v_start date;
  v_end date;
  v_mult numeric;
begin
  for v_entry in
    select * from jsonb_array_elements(coalesce(p_params -> 'SPECIAL_DATES', '[]'::jsonb))
  loop
    v_start := (v_entry ->> 'start')::date;
    v_end := coalesce((v_entry ->> 'end')::date, v_start);
    if v_start is not null and p_date >= v_start and p_date <= v_end then
      v_mult := coalesce((v_entry ->> 'multiplier')::numeric, 1.0);
      return v_mult;
    end if;
  end loop;
  return 1.0;
end;
$$;


--
-- Name: reactivate_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reactivate_user(p_member_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_internal.require_admin();
  update public."Members" set "LastModified" = timezone('utc', now()) where "Id" = p_member_id;
  return jsonb_build_object('success', true, 'message', 'User reactivated');
end;
$$;


--
-- Name: reactivate_user(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reactivate_user(p_member_id uuid, p_admin_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Get admin ID from current user if not provided
    IF p_admin_id IS NULL THEN
        SELECT "Id" INTO v_admin_id
        FROM "Members"
        WHERE "UserId" = auth.uid() AND "IsDeleted" = false;
    ELSE
        v_admin_id := p_admin_id;
    END IF;

    -- Insert status change
    INSERT INTO "MemberStatus" ("MemberId", "Status", "ChangedBy", "ChangedAt")
    VALUES (p_member_id, 'active', v_admin_id, now());

    -- Insert audit history
    INSERT INTO "MemberActionHistory" ("MemberId", "ActionType", "PerformedBy")
    VALUES (p_member_id, 'reactivate', v_admin_id);

    RETURN json_build_object('success', true, 'message', 'User reactivated successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;


--
-- Name: reconfirm_booking_hold(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reconfirm_booking_hold(p_hold_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_hold public.booking_holds%rowtype;
begin
  select * into v_hold from public.booking_holds where id = p_hold_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Hold not found');
  end if;

  if v_hold.status <> 'pending' or v_hold.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'Hold expired');
  end if;

  return jsonb_build_object(
    'success', true,
    'hold', jsonb_build_object(
      'id', v_hold.id,
      'property_id', v_hold.property_id,
      'check_in', v_hold.check_in,
      'check_out', v_hold.check_out,
      'guests', v_hold.guests,
      'expires_at', v_hold.expires_at
    )
  );
end;
$$;


--
-- Name: record_booking_usage_record(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_booking_usage_record(p_booking_id uuid, p_estate_property_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_subject_type text;
  v_subject_id uuid;
  v_pricing_model text;
  v_inserted boolean := false;
begin
  select r.subject_type, r.member_or_company_id
  into v_subject_type, v_subject_id
  from public.resolve_property_billing_subject(p_estate_property_id) r
  limit 1;

  if v_subject_id is null then
    raise exception 'Unable to resolve billing subject for booking usage record';
  end if;

  select apa.pricing_model
  into v_pricing_model
  from public.get_active_plan_assignment(v_subject_type, v_subject_id, now()) apa;

  if v_pricing_model is null or v_pricing_model not in ('per_booking', 'hybrid') then
    return jsonb_build_object('skipped', true, 'reason', 'plan does not bill per booking');
  end if;

  insert into public."UsageRecords" (
    "SubjectType",
    "MemberOrCompanyId",
    "Type",
    "ReferenceId",
    "Amount"
  )
  values (
    v_subject_type,
    v_subject_id,
    'booking',
    p_booking_id::text,
    null
  )
  on conflict ("SubjectType", "MemberOrCompanyId", "Type", "ReferenceId") do nothing;

  v_inserted := found;

  return jsonb_build_object(
    'recorded', true,
    'inserted', v_inserted,
    'subject_type', v_subject_type,
    'member_or_company_id', v_subject_id
  );
end;
$$;


--
-- Name: FUNCTION record_booking_usage_record(p_booking_id uuid, p_estate_property_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.record_booking_usage_record(p_booking_id uuid, p_estate_property_id uuid) IS 'Inserts booking UsageRecords row when subject plan is per_booking/hybrid. Idempotent on conflict.';


--
-- Name: regenerate_property_ical_export_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.regenerate_property_ical_export_token(property_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid;
  v_member_id uuid;
  v_is_admin boolean;
  v_new_token uuid := gen_random_uuid();
begin
  if auth.role() = 'service_role' then
    raise exception 'Not allowed'
      using errcode = 'P0001';
  end if;

  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'P0001';
  end if;

  select m."Id", lower(coalesce(m."Role", '')) = 'admin'
  into v_member_id, v_is_admin
  from public."Members" m
  where m."UserId" = v_uid
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    raise exception 'Member not found'
      using errcode = 'P0001';
  end if;

  if not (
    v_is_admin
    or exists (
      select 1
      from public."EstateProperties" ep
      join public."Owners" o on o."Id" = ep."OwnerId" and o."IsDeleted" = false
      where ep."Id" = property_id
        and ep."IsDeleted" = false
        and (
          (o."OwnerType" = 'member' and o."MemberId" = v_member_id)
          or (
            o."OwnerType" = 'company'
            and exists (
              select 1
              from public."CompanyMembers" cm
              where cm."CompanyId" = o."CompanyId"
                and cm."MemberId" = v_member_id
                and cm."IsDeleted" = false
            )
          )
        )
    )
  ) then
    raise exception 'Access denied'
      using errcode = 'P0001';
  end if;

  update public."SummerRentExtension" s
  set "ICalExportToken" = v_new_token,
      "LastModified" = now()
  where s."EstatePropertyId" = property_id;

  if not found then
    raise exception 'Summer rent extension not found for property'
      using errcode = 'P0001';
  end if;

  return v_new_token::text;
end;
$$;


--
-- Name: replace_estate_property_content_sections(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_estate_property_content_sections(p_property_id uuid, p_sections jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_section jsonb;
  v_section_id uuid;
  v_property_type public."PropertyType";
  v_layout_type text;
  v_layout_config jsonb;
  v_name jsonb;
  v_description jsonb;
  v_order integer := 0;
  v_image_id uuid;
  v_image_elem jsonb;
  v_image_order integer;
begin
  if p_property_id is null then
    raise exception 'p_property_id is required';
  end if;

  update public.propertydetailssection
  set isdeleted = true, updatedat = now()
  where propertyid = p_property_id
    and isdeleted = false;

  if p_sections is null
     or jsonb_typeof(p_sections) <> 'array'
     or jsonb_array_length(p_sections) = 0 then
    return;
  end if;

  for v_section in select * from jsonb_array_elements(p_sections)
  loop
    v_name := public.sanitize_localized_text_json(coalesce(v_section->'localizedName', v_section->'localized_name', '{}'::jsonb));
    if v_name = '{}'::jsonb then
      continue;
    end if;

    v_description := public.sanitize_localized_text_json(coalesce(v_section->'localizedDescription', v_section->'localized_description', '{}'::jsonb));
    v_property_type := nullif(trim(both from coalesce(v_section->>'propertyType', v_section->>'property_type', '')), '')::public."PropertyType";
    v_layout_type := lower(coalesce(nullif(trim(v_section->>'layoutType'), ''), nullif(trim(v_section->>'layout_type'), ''), 'split'));
    if v_layout_type not in ('split', 'carousel', 'stacked') then
      v_layout_type := 'split';
    end if;

    v_layout_config := coalesce(v_section->'layoutConfig', v_section->'layout_config', '{}'::jsonb);
    if v_section->>'displayVariant' is not null or v_section->>'display_variant' is not null then
      v_layout_config := v_layout_config || jsonb_build_object(
        'displayVariant',
        coalesce(v_section->>'displayVariant', v_section->>'display_variant', 'default')
      );
    end if;

    v_section_id := gen_random_uuid();
    v_order := coalesce((v_section->>'displayOrder')::integer, v_order);

    insert into public.propertydetailssection (
      id,
      propertyid,
      name,
      description,
      localizedname,
      localizeddescription,
      propertytype,
      layouttype,
      layoutconfig,
      displayorder,
      isdeleted,
      createdat,
      updatedat
    ) values (
      v_section_id,
      p_property_id,
      coalesce(v_name->>'es', v_name->>'en', v_name->>'pt', ''),
      coalesce(v_description->>'es', v_description->>'en', v_description->>'pt', ''),
      v_name,
      v_description,
      v_property_type,
      v_layout_type,
      v_layout_config,
      v_order,
      false,
      now(),
      now()
    );

    v_image_order := 0;
    if jsonb_typeof(v_section->'propertyImageIds') = 'array' then
      for v_image_id in
        select nullif(trim(both from value), '')::uuid
        from jsonb_array_elements_text(v_section->'propertyImageIds') as t(value)
        where nullif(trim(both from value), '') is not null
      loop
        insert into public.propertysectionimages (
          id, sectionid, propertyimageid, displayorder, createdat, updatedat
        ) values (
          gen_random_uuid(), v_section_id, v_image_id, v_image_order, now(), now()
        );
        v_image_order := v_image_order + 1;
      end loop;
    elsif jsonb_typeof(v_section->'images') = 'array' then
      for v_image_elem in select * from jsonb_array_elements(v_section->'images')
      loop
        v_image_id := nullif(trim(both from coalesce(v_image_elem->>'propertyImageId', v_image_elem->>'property_image_id', '')), '')::uuid;
        if v_image_id is not null then
          insert into public.propertysectionimages (
            id, sectionid, propertyimageid, displayorder, createdat, updatedat
          ) values (
            gen_random_uuid(),
            v_section_id,
            v_image_id,
            coalesce((v_image_elem->>'displayOrder')::integer, v_image_order),
            now(),
            now()
          );
          v_image_order := v_image_order + 1;
        end if;
      end loop;
    end if;

    v_order := v_order + 1;
  end loop;
end;
$$;


--
-- Name: replace_estate_property_policies(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_estate_property_policies(p_property_id uuid, p_policies jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_policy jsonb;
  v_listing_type public."ListingType";
  v_title jsonb;
  v_description jsonb;
  v_order integer := 0;
begin
  if p_property_id is null then
    raise exception 'p_property_id is required';
  end if;

  update public."EstatePropertyPolicy"
  set "IsDeleted" = true, "LastModified" = now()
  where "EstatePropertyId" = p_property_id
    and "IsDeleted" = false;

  if p_policies is null
     or jsonb_typeof(p_policies) <> 'array'
     or jsonb_array_length(p_policies) = 0 then
    return;
  end if;

  for v_policy in select * from jsonb_array_elements(p_policies)
  loop
    v_listing_type := nullif(trim(both from coalesce(v_policy->>'listingType', v_policy->>'listing_type', '')), '')::public."ListingType";
    if v_listing_type is null then
      continue;
    end if;

    v_title := public.sanitize_localized_text_json(coalesce(v_policy->'title', v_policy->'localizedTitle', '{}'::jsonb));
    v_description := public.sanitize_localized_text_json(coalesce(v_policy->'description', v_policy->'localizedDescription', '{}'::jsonb));

    if v_title = '{}'::jsonb and v_description = '{}'::jsonb then
      continue;
    end if;

    insert into public."EstatePropertyPolicy" (
      "EstatePropertyId",
      "ListingType",
      "LocalizedTitle",
      "LocalizedDescription",
      "DisplayOrder",
      "IsDeleted",
      "Created",
      "LastModified"
    ) values (
      p_property_id,
      v_listing_type,
      v_title,
      v_description,
      coalesce((v_policy->>'displayOrder')::integer, v_order),
      false,
      now(),
      now()
    );

    v_order := v_order + 1;
  end loop;
end;
$$;


--
-- Name: reply_to_property_message(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reply_to_property_message(p_message_id uuid, p_user_id uuid, p_body text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_member_id UUID;
    v_thread_id UUID;
    v_property_id UUID;
    v_original_sender_id UUID;
    v_property_owner_id UUID;
    v_reply_message_id UUID;
    v_snippet TEXT;
BEGIN
    -- Get member ID from user ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Get thread and property info from original message
    SELECT
        m."ThreadId",
        mt."PropertyId",
        m."SenderId"
    INTO v_thread_id, v_property_id, v_original_sender_id
    FROM "Messages" m
    JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
    WHERE m."Id" = p_message_id
    AND m."IsDeleted" = false
    AND mt."IsDeleted" = false;

    IF v_thread_id IS NULL THEN
        RAISE EXCEPTION 'Message not found';
    END IF;

    -- Get property owner
    SELECT "OwnerId" INTO v_property_owner_id
    FROM "EstateProperties"
    WHERE "Id" = v_property_id AND "IsDeleted" = false;

    IF v_property_owner_id IS NULL THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    -- Check if user is authorized to reply (must be property owner or original sender)
    IF v_member_id != v_property_owner_id AND v_member_id != v_original_sender_id THEN
        RAISE EXCEPTION 'Not authorized to reply to this message';
    END IF;

    -- Generate snippet
    SELECT generate_message_snippet(p_body, 200) INTO v_snippet;

    -- Create reply message
    INSERT INTO "Messages" (
        "Id",
        "ThreadId",
        "SenderId",
        "Body",
        "Snippet",
        "CreatedAtUtc",
        "InReplyToMessageId",
        "IsDeleted",
        "Created",
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    ) VALUES (
        gen_random_uuid(),
        v_thread_id,
        v_member_id,
        p_body,
        v_snippet,
        NOW(),
        p_message_id,
        false,
        NOW(),
        v_member_id::text,
        NOW(),
        v_member_id::text
    ) RETURNING "Id" INTO v_reply_message_id;

    -- Create message recipient for the other party
    INSERT INTO "MessageRecipients" (
        "Id",
        "MessageId",
        "RecipientId",
        "ReceivedAtUtc",
        "IsRead",
        "HasBeenRepliedToByRecipient",
        "IsStarred",
        "IsArchived",
        "IsDeleted",
        "Created",
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    ) VALUES (
        gen_random_uuid(),
        v_reply_message_id,
        CASE WHEN v_member_id = v_property_owner_id THEN v_original_sender_id ELSE v_property_owner_id END,
        NOW(),
        false,
        false,
        false,
        false,
        false,
        NOW(),
        v_member_id::text,
        NOW(),
        v_member_id::text
    );

    -- Update thread's last message timestamp
    UPDATE "MessageThreads"
    SET "LastMessageAtUtc" = NOW(),
        "LastModified" = NOW(),
        "LastModifiedBy" = v_member_id::text
    WHERE "Id" = v_thread_id;

    -- Mark original message as replied to
    UPDATE "MessageRecipients"
    SET "HasBeenRepliedToByRecipient" = true,
        "LastModified" = NOW(),
        "LastModifiedBy" = v_member_id::text
    WHERE "MessageId" = p_message_id
    AND "RecipientId" = v_member_id;

    RETURN v_reply_message_id;
END;
$$;


--
-- Name: reset_user_onboarding(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_user_onboarding(p_member_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_internal.require_admin();
  update public."Members"
  set
    "OnboardingStep" = 0,
    "OnboardingComplete" = false,
    "LastModified" = timezone('utc', now())
  where "Id" = p_member_id;
  return jsonb_build_object('success', true, 'message', 'Onboarding reset');
end;
$$;


--
-- Name: reset_user_onboarding(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_user_onboarding(p_member_id uuid, p_admin_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Get admin ID from current user if not provided
    IF p_admin_id IS NULL THEN
        SELECT "Id" INTO v_admin_id
        FROM "Members"
        WHERE "UserId" = auth.uid() AND "IsDeleted" = false;
    ELSE
        v_admin_id := p_admin_id;
    END IF;

    -- Update or insert onboarding record
    INSERT INTO "MemberOnboarding" ("MemberId", "OnboardingStep", "IsComplete", "CompletedAt", "LastResetBy", "LastResetAt", "LastModifiedBy")
    VALUES (p_member_id, 0, false, NULL, v_admin_id, now(), v_admin_id::text)
    ON CONFLICT ("MemberId")
    DO UPDATE SET
        "OnboardingStep" = 0,
        "IsComplete" = false,
        "CompletedAt" = NULL,
        "LastResetBy" = v_admin_id,
        "LastResetAt" = now(),
        "LastModified" = now(),
        "LastModifiedBy" = v_admin_id::text;

    -- Insert audit history
    INSERT INTO "MemberActionHistory" ("MemberId", "ActionType", "PerformedBy")
    VALUES (p_member_id, 'reset_onboarding', v_admin_id);

    RETURN json_build_object('success', true, 'message', 'User onboarding reset successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;


--
-- Name: resolve_guest_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_guest_profile(p_guest_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_member record;
  v_guest record;
begin
  if p_guest_id is null then
    return null;
  end if;

  select
    m."FirstName" as first_name,
    m."LastName" as last_name,
    m."Email" as email,
    m."Phone" as phone
  into v_member
  from public."Members" m
  where m."Id" = p_guest_id
    and m."IsDeleted" = false
  limit 1;

  if found then
    return jsonb_build_object(
      'kind', 'member',
      'firstName', v_member.first_name,
      'lastName', v_member.last_name,
      'email', v_member.email,
      'phone', v_member.phone
    );
  end if;

  select
    g."FirstName" as first_name,
    g."LastName" as last_name,
    g."Email" as email,
    g."PhoneNumber" as phone
  into v_guest
  from public."Guests" g
  where g."Id" = p_guest_id
  limit 1;

  if found then
    return jsonb_build_object(
      'kind', 'guest',
      'firstName', v_guest.first_name,
      'lastName', v_guest.last_name,
      'email', v_guest.email,
      'phone', v_guest.phone
    );
  end if;

  return null;
end;
$$;


--
-- Name: resolve_host_contact_for_property(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_host_contact_for_property(p_estate_property_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_owner record;
begin
  if p_estate_property_id is null then
    return jsonb_build_object('name', null, 'email', null, 'phone', null);
  end if;

  select
    case
      when o."OwnerType" = 'member' then concat_ws(' ', m."FirstName", m."LastName")
      when o."OwnerType" = 'company' then c."Name"
      else null
    end as host_name,
    case
      when o."OwnerType" = 'member' then m."Email"
      when o."OwnerType" = 'company' then c."BillingEmail"
      else null
    end as host_email,
    case
      when o."OwnerType" = 'member' then m."Phone"
      when o."OwnerType" = 'company' then c."Phone"
      else null
    end as host_phone
  into v_owner
  from public."EstateProperties" ep
  join public."Owners" o
    on o."Id" = ep."OwnerId"
   and o."IsDeleted" = false
  left join public."Members" m
    on o."OwnerType" = 'member'
   and o."MemberId" = m."Id"
   and m."IsDeleted" = false
  left join public."Companies" c
    on o."OwnerType" = 'company'
   and o."CompanyId" = c."Id"
   and c."IsDeleted" = false
  where ep."Id" = p_estate_property_id
    and ep."IsDeleted" = false
  limit 1;

  if not found then
    return jsonb_build_object('name', null, 'email', null, 'phone', null);
  end if;

  return jsonb_build_object(
    'name', nullif(trim(coalesce(v_owner.host_name, '')), ''),
    'email', nullif(trim(coalesce(v_owner.host_email, '')), ''),
    'phone', nullif(trim(coalesce(v_owner.host_phone, '')), '')
  );
end;
$$;


--
-- Name: FUNCTION resolve_host_contact_for_property(p_estate_property_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.resolve_host_contact_for_property(p_estate_property_id uuid) IS 'Resolve host display name, email, and phone for an estate property owner (member or company).';


--
-- Name: resolve_property_billing_subject(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_property_billing_subject(p_property_id uuid) RETURNS TABLE(subject_type text, member_or_company_id uuid)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: sanitize_amenity_localized_descriptions(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sanitize_amenity_localized_descriptions(p_descriptions jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    AS $$
  select public.sanitize_localized_text_json(p_descriptions);
$$;


--
-- Name: sanitize_localized_text_json(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sanitize_localized_text_json(p_text jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(
    (
      select jsonb_object_agg(k, v)
      from (
        select key as k, trim(both from value #>> '{}') as v
        from jsonb_each(coalesce(p_text, '{}'::jsonb))
        where key in ('en', 'es', 'pt')
          and jsonb_typeof(value) = 'string'
          and nullif(trim(both from value #>> '{}'), '') is not null
      ) s
      where v is not null
    ),
    '{}'::jsonb
  );
$$;


--
-- Name: FUNCTION sanitize_localized_text_json(p_text jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sanitize_localized_text_json(p_text jsonb) IS 'Strips empty/invalid keys from en/es/pt localized text objects.';


--
-- Name: search_normalize_log(bigint, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_normalize_log(p_count bigint, p_cap numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when coalesce(p_cap, 0) <= 0 then 0
    when coalesce(p_count, 0) <= 0 then 0
    else least(
      100,
      greatest(
        0,
        (ln(1 + p_count::numeric) / ln(1 + p_cap)) * 100
      )
    )
  end;
$$;


--
-- Name: search_param_json(jsonb, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_param_json(p_params jsonb, p_key text, p_default jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(
    case
      when jsonb_typeof(p_params -> p_key) = 'object' then p_params -> p_key
      else null
    end,
    p_default
  );
$$;


--
-- Name: search_param_num(jsonb, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_param_num(p_params jsonb, p_key text, p_default numeric DEFAULT 0) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(
    case jsonb_typeof(p_params -> p_key)
      when 'number' then (p_params ->> p_key)::numeric
      when 'string' then nullif(trim(p_params ->> p_key), '')::numeric
      else null
    end,
    p_default
  );
$$;


--
-- Name: send_message(uuid, text, text, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_message(p_user_id uuid, p_subject text, p_body text, p_recipient_id uuid DEFAULT NULL::uuid, p_property_id uuid DEFAULT NULL::uuid, p_in_reply_to_message_id uuid DEFAULT NULL::uuid, p_thread_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_sender_member_id UUID;
    v_recipient_id UUID := p_recipient_id;
    v_thread_id UUID := p_thread_id;
    v_message_id UUID;
    v_recipient_entry_id UUID;
    v_created_message JSONB;
BEGIN
    -- Get sender member ID
    SELECT "Id" INTO v_sender_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_sender_member_id IS NULL THEN
        RAISE EXCEPTION 'Sender member not found for user %', p_user_id;
    END IF;

    -- If recipient not provided, find it from property owner
    IF v_recipient_id IS NULL AND p_property_id IS NOT NULL THEN
        SELECT "OwnerId" INTO v_recipient_id
        FROM "EstateProperties"
        WHERE "Id" = p_property_id AND "IsDeleted" = false;

        IF v_recipient_id IS NULL THEN
            RAISE EXCEPTION 'Property owner not found for property %', p_property_id;
        END IF;
    END IF;

    IF v_recipient_id IS NULL THEN
        RAISE EXCEPTION 'Recipient ID must be provided or property ID must resolve to an owner';
    END IF;

    -- Validate property exists if provided
    IF p_property_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM "EstateProperties" WHERE "Id" = p_property_id AND "IsDeleted" = false) THEN
            RAISE EXCEPTION 'Property not found: %', p_property_id;
        END IF;
    END IF;

    -- Determine thread
    IF v_thread_id IS NOT NULL THEN
        -- Use provided thread
        IF NOT EXISTS (SELECT 1 FROM "MessageThreads" WHERE "Id" = v_thread_id) THEN
            RAISE EXCEPTION 'Thread not found: %', v_thread_id;
        END IF;
    ELSIF p_in_reply_to_message_id IS NOT NULL THEN
        -- Reply to existing message
        SELECT "ThreadId" INTO v_thread_id
        FROM "Messages"
        WHERE "Id" = p_in_reply_to_message_id AND "IsDeleted" = false;

        IF v_thread_id IS NULL THEN
            RAISE EXCEPTION 'Message to reply to not found: %', p_in_reply_to_message_id;
        END IF;

        -- Mark the replied-to message as replied by recipient
        UPDATE "MessageRecipients"
        SET "HasBeenRepliedToByRecipient" = true
        WHERE "MessageId" = p_in_reply_to_message_id AND "RecipientId" = v_sender_member_id;

    ELSE
        -- Create new thread
        INSERT INTO "MessageThreads" ("Id", "Subject", "PropertyId", "CreatedAtUtc", "LastMessageAtUtc", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy")
        VALUES (gen_random_uuid(), p_subject, p_property_id, NOW(), NOW(), false, NOW(), NULL, NOW(), NULL)
        RETURNING "Id" INTO v_thread_id;
    END IF;

    -- Create message
    INSERT INTO "Messages" ("Id", "ThreadId", "SenderId", "Body", "Snippet", "CreatedAtUtc", "InReplyToMessageId", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy")
    VALUES (gen_random_uuid(), v_thread_id, v_sender_member_id, p_body, generate_message_snippet(p_body), NOW(), p_in_reply_to_message_id, false, NOW(), NULL, NOW(), NULL)
    RETURNING "Id" INTO v_message_id;

    -- Create message recipient entry
    INSERT INTO "MessageRecipients" ("Id", "MessageId", "RecipientId", "ReceivedAtUtc", "IsRead", "HasBeenRepliedToByRecipient", "IsStarred", "IsArchived", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy")
    VALUES (gen_random_uuid(), v_message_id, v_recipient_id, NOW(), false, false, false, false, false, NOW(), NULL, NOW(), NULL)
    RETURNING "Id" INTO v_recipient_entry_id;

    -- Update thread last message time
    UPDATE "MessageThreads"
    SET "LastMessageAtUtc" = NOW()
    WHERE "Id" = v_thread_id;

    -- Return created message details
    SELECT jsonb_build_object(
        'id', m."Id",
        'threadId', m."ThreadId",
        'senderId', m."SenderId",
        'recipientId', v_recipient_id,
        'propertyId', mt."PropertyId",
        'propertyTitle', ep."Title",
        'subject', mt."Subject",
        'snippet', m."Snippet",
        'createdAt', m."CreatedAtUtc",
        'isRead', false,
        'isReplied', false,
        'isStarred', false,
        'isArchived', false
    ) INTO v_created_message
    FROM "Messages" m
    JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
    LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
    WHERE m."Id" = v_message_id;

    RETURN v_created_message;
END;
$$;


--
-- Name: send_property_question(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_property_question(p_thread_id uuid, p_user_id uuid, p_body text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_member_id UUID;
    v_property_id UUID;
    v_owner_id UUID;
    v_message_id UUID;
    v_snippet TEXT;
BEGIN
    -- Get member ID from user ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Validate thread exists and belongs to property
    SELECT "PropertyId" INTO v_property_id
    FROM "MessageThreads"
    WHERE "Id" = p_thread_id AND "IsDeleted" = false;

    IF v_property_id IS NULL THEN
        RAISE EXCEPTION 'Message thread not found';
    END IF;

    -- Get property owner
    SELECT "OwnerId" INTO v_owner_id
    FROM "EstateProperties"
    WHERE "Id" = v_property_id AND "IsDeleted" = false;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    -- Check if user is not the property owner
    IF v_owner_id = v_member_id THEN
        RAISE EXCEPTION 'Cannot send question to your own property';
    END IF;

    -- Generate snippet
    SELECT generate_message_snippet(p_body, 200) INTO v_snippet;

    -- Create message
    INSERT INTO "Messages" (
        "Id",
        "ThreadId",
        "SenderId",
        "Body",
        "Snippet",
        "CreatedAtUtc",
        "InReplyToMessageId",
        "IsDeleted",
        "Created",
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    ) VALUES (
        gen_random_uuid(),
        p_thread_id,
        v_member_id,
        p_body,
        v_snippet,
        NOW(),
        NULL,
        false,
        NOW(),
        v_member_id::text,
        NOW(),
        v_member_id::text
    ) RETURNING "Id" INTO v_message_id;

    -- Create message recipient for property owner
    INSERT INTO "MessageRecipients" (
        "Id",
        "MessageId",
        "RecipientId",
        "ReceivedAtUtc",
        "IsRead",
        "HasBeenRepliedToByRecipient",
        "IsStarred",
        "IsArchived",
        "IsDeleted",
        "Created",
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    ) VALUES (
        gen_random_uuid(),
        v_message_id,
        v_owner_id,
        NOW(),
        false,
        false,
        false,
        false,
        false,
        NOW(),
        v_member_id::text,
        NOW(),
        v_member_id::text
    );

    -- Update thread's last message timestamp
    UPDATE "MessageThreads"
    SET "LastMessageAtUtc" = NOW(),
        "LastModified" = NOW(),
        "LastModifiedBy" = v_member_id::text
    WHERE "Id" = p_thread_id;

    RETURN v_message_id;
END;
$$;


--
-- Name: set_member_verification(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_member_verification(p_member_id uuid, p_type text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.member_rpc_caller_ok(p_member_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if p_type = 'email' then
    update public."Members" m
    set
      "EmailVerifiedAt" = coalesce(m."EmailVerifiedAt", timezone('utc', now())),
      "LastModified" = timezone('utc', now())
    where m."Id" = p_member_id
      and m."IsDeleted" = false;
  elsif p_type = 'phone' then
    update public."Members" m
    set
      "PhoneVerifiedAt" = coalesce(m."PhoneVerifiedAt", timezone('utc', now())),
      "LastModified" = timezone('utc', now())
    where m."Id" = p_member_id
      and m."IsDeleted" = false;
  else
    return jsonb_build_object('success', false, 'error', 'invalid_type');
  end if;

  return jsonb_build_object('success', true);
end;
$$;


--
-- Name: set_owner_onboarding_complete(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_owner_onboarding_complete(p_member_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.member_rpc_caller_ok(p_member_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  update public."Members" m
  set
    "NeedsOnboarding" = false,
    "LastModified" = timezone('utc', now())
  where m."Id" = p_member_id
    and m."IsDeleted" = false;

  return jsonb_build_object('success', true);
end;
$$;


--
-- Name: soft_delete_user(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soft_delete_user(p_member_id uuid, p_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_internal.require_admin();
  update public."Members"
  set
    "IsDeleted" = true,
    "LastModified" = timezone('utc', now())
  where "Id" = p_member_id;
  return jsonb_build_object('success', true, 'message', 'User soft-deleted');
end;
$$;


--
-- Name: soft_delete_user(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soft_delete_user(p_member_id uuid, p_reason text DEFAULT NULL::text, p_admin_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Get admin ID from current user if not provided
    IF p_admin_id IS NULL THEN
        SELECT "Id" INTO v_admin_id
        FROM "Members"
        WHERE "UserId" = auth.uid() AND "IsDeleted" = false;
    ELSE
        v_admin_id := p_admin_id;
    END IF;

    -- Soft delete member
    UPDATE "Members"
    SET "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = v_admin_id::text
    WHERE "Id" = p_member_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Insert status change
    INSERT INTO "MemberStatus" ("MemberId", "Status", "Reason", "ChangedBy", "ChangedAt")
    VALUES (p_member_id, 'deleted', p_reason, v_admin_id, now());

    -- Insert audit history
    INSERT INTO "MemberActionHistory" ("MemberId", "ActionType", "ActionDetails", "PerformedBy")
    VALUES (p_member_id, 'delete', json_build_object('reason', p_reason), v_admin_id);

    RETURN json_build_object('success', true, 'message', 'User deleted successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;


--
-- Name: suspend_user(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suspend_user(p_member_id uuid, p_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_internal.require_admin();
  update public."Members" set "LastModified" = timezone('utc', now()) where "Id" = p_member_id;
  return jsonb_build_object('success', true, 'message', 'User suspended');
end;
$$;


--
-- Name: suspend_user(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suspend_user(p_member_id uuid, p_reason text DEFAULT NULL::text, p_admin_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Get admin ID from current user if not provided
    IF p_admin_id IS NULL THEN
        SELECT "Id" INTO v_admin_id
        FROM "Members"
        WHERE "UserId" = auth.uid() AND "IsDeleted" = false;
    ELSE
        v_admin_id := p_admin_id;
    END IF;

    -- Insert status change
    INSERT INTO "MemberStatus" ("MemberId", "Status", "Reason", "ChangedBy", "ChangedAt")
    VALUES (p_member_id, 'suspended', p_reason, v_admin_id, now());

    -- Insert audit history
    INSERT INTO "MemberActionHistory" ("MemberId", "ActionType", "ActionDetails", "PerformedBy")
    VALUES (p_member_id, 'suspend', json_build_object('reason', p_reason), v_admin_id);

    RETURN json_build_object('success', true, 'message', 'User suspended successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;


--
-- Name: sync_mfa_status_for_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_mfa_status_for_user(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  has_factor boolean;
begin
  select exists (
    select 1
    from auth.mfa_factors f
    where f.user_id = p_user_id
      and f.status = 'verified'
  ) into has_factor;

  update public."Members"
  set "TwoFactorEnabled" = coalesce(has_factor, false),
      "LastModified" = now(),
      "LastModifiedBy" = 'sync_mfa_status_for_user'
  where "UserId" = p_user_id
    and "IsDeleted" = false;
end;
$$;


--
-- Name: trg_bookings_validate_guest_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_bookings_validate_guest_id() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  perform public.validate_polymorphic_guest_id(new."GuestId", true);
  return new;
end;
$$;


--
-- Name: trg_reviews_validate_guest_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_reviews_validate_guest_id() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  perform public.validate_polymorphic_guest_id(new."GuestId", false);
  return new;
end;
$$;


--
-- Name: trg_validate_invoice_billing_subject(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_validate_invoice_billing_subject() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: trg_validate_invoice_member_cycle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_validate_invoice_member_cycle() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: trigger_periodic_calendar_sync(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_periodic_calendar_sync() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    sync_count integer := 0;
    integration_record record;
BEGIN
    -- Loop through active calendar integrations and trigger sync
    FOR integration_record IN
        SELECT ci."Id", ci."EstatePropertyId", ci."PlatformType"
        FROM "CalendarIntegrations" ci
        WHERE ci."IsActive" = true
        AND ci."IsDeleted" = false
        AND ci."LastSyncAt" < (now() - interval '15 minutes') -- Only sync if not synced in last 15 minutes
        ORDER BY ci."LastSyncAt" ASC NULLS FIRST
        LIMIT 10 -- Process in batches
    LOOP
        -- Insert sync job record (will be processed by Edge Function)
        INSERT INTO "SyncJobs" (
            "CalendarIntegrationId",
            "JobType",
            "Status",
            "CreatedBy"
        ) VALUES (
            integration_record."Id",
            1, -- scheduled
            0, -- pending
            'system'
        );

        sync_count := sync_count + 1;
    END LOOP;

    RETURN sync_count;
END;
$$;


--
-- Name: update_estate_property(text, text, text, text, text, text, text, text, text, double precision, double precision, text, integer, double precision, integer, integer, integer, boolean, integer, text, timestamp with time zone, integer, double precision, double precision, boolean, double precision, boolean, boolean, boolean, integer, boolean, boolean, jsonb, jsonb, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_estate_property(p_property_id text, p_user_id text, p_street_name text DEFAULT NULL::text, p_house_number text DEFAULT NULL::text, p_neighborhood text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_zip_code text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_location_lat double precision DEFAULT NULL::double precision, p_location_lng double precision DEFAULT NULL::double precision, p_title text DEFAULT NULL::text, p_property_type integer DEFAULT NULL::integer, p_area_value double precision DEFAULT NULL::double precision, p_area_unit integer DEFAULT NULL::integer, p_bedrooms integer DEFAULT NULL::integer, p_bathrooms integer DEFAULT NULL::integer, p_has_garage boolean DEFAULT NULL::boolean, p_garage_spaces integer DEFAULT NULL::integer, p_description text DEFAULT NULL::text, p_available_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_currency integer DEFAULT NULL::integer, p_sale_price double precision DEFAULT NULL::double precision, p_rent_price double precision DEFAULT NULL::double precision, p_has_common_expenses boolean DEFAULT NULL::boolean, p_common_expenses_value double precision DEFAULT NULL::double precision, p_is_electricity_included boolean DEFAULT NULL::boolean, p_is_water_included boolean DEFAULT NULL::boolean, p_is_price_visible boolean DEFAULT NULL::boolean, p_status integer DEFAULT NULL::integer, p_is_active boolean DEFAULT NULL::boolean, p_is_property_visible boolean DEFAULT NULL::boolean, p_property_images jsonb DEFAULT NULL::jsonb, p_property_documents jsonb DEFAULT NULL::jsonb, p_property_videos jsonb DEFAULT NULL::jsonb, p_amenity_ids jsonb DEFAULT NULL::jsonb, p_amenity_links jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_property_id uuid := p_property_id::uuid;
  v_listing_id uuid;
  v_link jsonb;
  v_amenity_id uuid;
  v_descriptions jsonb;
  v_image_record jsonb;
  v_document_record jsonb;
  v_video_record jsonb;
  v_result jsonb;
begin
  if not exists (
    select 1 from public."EstateProperties" ep
    where ep."Id" = v_property_id and ep."IsDeleted" = false
  ) then
    raise exception 'Property not found or already deleted';
  end if;

  if not public.is_property_owner(p_user_id::uuid, v_property_id) then
    raise exception 'User does not own this property';
  end if;

  update public."EstateProperties"
  set
    "StreetName" = coalesce(p_street_name, "StreetName"),
    "HouseNumber" = coalesce(p_house_number, "HouseNumber"),
    "Neighborhood" = coalesce(p_neighborhood, "Neighborhood"),
    "City" = coalesce(p_city, "City"),
    "State" = coalesce(p_state, "State"),
    "ZipCode" = coalesce(p_zip_code, "ZipCode"),
    "Country" = coalesce(p_country, "Country"),
    "LocationLatitude" = coalesce(p_location_lat, "LocationLatitude"),
    "LocationLongitude" = coalesce(p_location_lng, "LocationLongitude"),
    "AreaValue" = coalesce(p_area_value, "AreaValue"),
    "AreaUnit" = coalesce(p_area_unit, "AreaUnit"),
    "Bedrooms" = coalesce(p_bedrooms, "Bedrooms"),
    "Bathrooms" = coalesce(p_bathrooms, "Bathrooms"),
    "HasGarage" = coalesce(p_has_garage, "HasGarage"),
    "GarageSpaces" = coalesce(p_garage_spaces, "GarageSpaces")
  where "Id" = v_property_id;

  select l."Id"
  into v_listing_id
  from public."Listings" l
  where l."EstatePropertyId" = v_property_id
    and l."IsDeleted" = false
  order by l."IsFeatured" desc nulls last, l."Created" desc
  limit 1;

  if v_listing_id is not null then
    update public."Listings"
    set
      "Title" = coalesce(p_title, "Title"),
      "Description" = coalesce(p_description, "Description"),
      "AvailableFrom" = coalesce(p_available_from, "AvailableFrom"),
      "Currency" = coalesce(p_currency, "Currency"),
      "SalePrice" = coalesce(p_sale_price, "SalePrice"),
      "RentPrice" = coalesce(p_rent_price, "RentPrice"),
      "HasCommonExpenses" = coalesce(p_has_common_expenses, "HasCommonExpenses"),
      "CommonExpensesValue" = coalesce(p_common_expenses_value, "CommonExpensesValue"),
      "IsElectricityIncluded" = coalesce(p_is_electricity_included, "IsElectricityIncluded"),
      "IsWaterIncluded" = coalesce(p_is_water_included, "IsWaterIncluded"),
      "IsPriceVisible" = coalesce(p_is_price_visible, "IsPriceVisible"),
      "Status" = coalesce(p_status, "Status"),
      "IsActive" = coalesce(p_is_active, "IsActive"),
      "IsPropertyVisible" = coalesce(p_is_property_visible, "IsPropertyVisible"),
      "LastModified" = now(),
      "LastModifiedBy" = p_user_id
    where "Id" = v_listing_id;
  end if;

  if p_property_images is not null then
    update public."PropertyImages"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_images) = 'array' and jsonb_array_length(p_property_images) > 0 then
      for v_image_record in select * from jsonb_array_elements(p_property_images)
      loop
        insert into public."PropertyImages" (
          "Id", "EstatePropertyId", "Url", "AltText", "IsMain", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy", "DisplayOrder"
        ) values (
          coalesce(nullif(v_image_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_image_record->>'url',
          coalesce(v_image_record->>'altText', ''),
          coalesce((v_image_record->>'isMain')::boolean, false),
          false,
          now(), p_user_id, now(), p_user_id,
          coalesce((v_image_record->>'displayOrder')::integer, 0)
        );
      end loop;
    end if;
  end if;

  if p_property_documents is not null then
    update public."PropertyDocuments"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_documents) = 'array' and jsonb_array_length(p_property_documents) > 0 then
      for v_document_record in select * from jsonb_array_elements(p_property_documents)
      loop
        insert into public."PropertyDocuments" (
          "Id", "EstatePropertyId", "Url", "Name", "FileType", "IsPublic", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy"
        ) values (
          coalesce(nullif(v_document_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_document_record->>'url',
          coalesce(v_document_record->>'name', ''),
          coalesce(v_document_record->>'fileType', 'pdf'),
          coalesce((v_document_record->>'isPublic')::boolean, true),
          false,
          now(), p_user_id, now(), p_user_id
        );
      end loop;
    end if;
  end if;

  if p_property_videos is not null then
    update public."PropertyVideos"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_videos) = 'array' and jsonb_array_length(p_property_videos) > 0 then
      for v_video_record in select * from jsonb_array_elements(p_property_videos)
      loop
        insert into public."PropertyVideos" (
          "Id", "EstatePropertyId", "Url", "Title", "Description", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy"
        ) values (
          coalesce(nullif(v_video_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_video_record->>'url',
          coalesce(v_video_record->>'title', ''),
          coalesce(v_video_record->>'description', ''),
          false,
          now(), p_user_id, now(), p_user_id
        );
      end loop;
    end if;
  end if;

  if p_amenity_links is not null or p_amenity_ids is not null then
    delete from public."EstatePropertyAmenity"
    where "EstatePropertyId" = v_property_id;

    if p_amenity_links is not null
       and jsonb_typeof(p_amenity_links) = 'array'
       and jsonb_array_length(p_amenity_links) > 0 then
      for v_link in select * from jsonb_array_elements(p_amenity_links)
      loop
        v_amenity_id := nullif(trim(both from coalesce(v_link->>'amenityId', v_link->>'amenity_id', '')), '')::uuid;
        if v_amenity_id is null then
          continue;
        end if;
        v_descriptions := public.sanitize_amenity_localized_descriptions(v_link->'descriptions');
        insert into public."EstatePropertyAmenity" (
          "EstatePropertyId", "AmenityId", "LocalizedDescriptions", "CreatedAtUtc", "DeletedAtUtc"
        ) values (
          v_property_id, v_amenity_id, v_descriptions, now(), null
        );
      end loop;
    elsif p_amenity_ids is not null
          and jsonb_typeof(p_amenity_ids) = 'array'
          and jsonb_array_length(p_amenity_ids) > 0 then
      for v_amenity_id in
        select nullif(trim(both from value), '')::uuid
        from jsonb_array_elements_text(p_amenity_ids) as t(value)
        where nullif(trim(both from value), '') is not null
      loop
        insert into public."EstatePropertyAmenity" (
          "EstatePropertyId", "AmenityId", "LocalizedDescriptions", "CreatedAtUtc", "DeletedAtUtc"
        ) values (
          v_property_id, v_amenity_id, '{}'::jsonb, now(), null
        );
      end loop;
    end if;
  end if;

  select jsonb_build_object(
    'id', ep."Id",
    'streetName', ep."StreetName",
    'houseNumber', ep."HouseNumber",
    'neighborhood', ep."Neighborhood",
    'city', ep."City",
    'state', ep."State",
    'zipCode', ep."ZipCode",
    'country', ep."Country",
    'location', jsonb_build_object('lat', ep."LocationLatitude", 'lng', ep."LocationLongitude"),
    'title', l."Title",
    'areaValue', ep."AreaValue",
    'areaUnit', ep."AreaUnit",
    'bedrooms', ep."Bedrooms",
    'bathrooms', ep."Bathrooms",
    'hasGarage', ep."HasGarage",
    'garageSpaces', ep."GarageSpaces",
    'description', l."Description",
    'availableFrom', l."AvailableFrom",
    'ownerId', ep."OwnerId",
    'currency', l."Currency",
    'salePrice', l."SalePrice",
    'rentPrice', l."RentPrice",
    'hasCommonExpenses', l."HasCommonExpenses",
    'commonExpensesValue', l."CommonExpensesValue",
    'isElectricityIncluded', l."IsElectricityIncluded",
    'isWaterIncluded', l."IsWaterIncluded",
    'isPriceVisible', l."IsPriceVisible",
    'status', l."Status",
    'isActive', l."IsActive",
    'isPropertyVisible', l."IsPropertyVisible",
    'created', ep."Created"
  )
  into v_result
  from public."EstateProperties" ep
  left join public."Listings" l on l."Id" = v_listing_id
  where ep."Id" = v_property_id;

  return v_result;
exception
  when others then
    raise exception 'Failed to update estate property: %', sqlerrm;
end;
$$;


--
-- Name: update_estate_property(text, text, text, text, text, text, text, text, text, double precision, double precision, text, integer, double precision, integer, integer, integer, boolean, integer, text, timestamp with time zone, integer, double precision, double precision, boolean, double precision, boolean, boolean, boolean, integer, boolean, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_estate_property(p_property_id text, p_user_id text, p_street_name text DEFAULT NULL::text, p_house_number text DEFAULT NULL::text, p_neighborhood text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_zip_code text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_location_lat double precision DEFAULT NULL::double precision, p_location_lng double precision DEFAULT NULL::double precision, p_title text DEFAULT NULL::text, p_property_type integer DEFAULT NULL::integer, p_area_value double precision DEFAULT NULL::double precision, p_area_unit integer DEFAULT NULL::integer, p_bedrooms integer DEFAULT NULL::integer, p_bathrooms integer DEFAULT NULL::integer, p_has_garage boolean DEFAULT NULL::boolean, p_garage_spaces integer DEFAULT NULL::integer, p_description text DEFAULT NULL::text, p_available_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_currency integer DEFAULT NULL::integer, p_sale_price double precision DEFAULT NULL::double precision, p_rent_price double precision DEFAULT NULL::double precision, p_has_common_expenses boolean DEFAULT NULL::boolean, p_common_expenses_value double precision DEFAULT NULL::double precision, p_is_electricity_included boolean DEFAULT NULL::boolean, p_is_water_included boolean DEFAULT NULL::boolean, p_is_price_visible boolean DEFAULT NULL::boolean, p_status integer DEFAULT NULL::integer, p_is_active boolean DEFAULT NULL::boolean, p_is_property_visible boolean DEFAULT NULL::boolean, p_property_images jsonb DEFAULT NULL::jsonb, p_property_documents jsonb DEFAULT NULL::jsonb, p_property_videos jsonb DEFAULT NULL::jsonb, p_amenity_ids jsonb DEFAULT NULL::jsonb, p_amenity_links jsonb DEFAULT NULL::jsonb, p_policies jsonb DEFAULT NULL::jsonb, p_content_sections jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_property_id uuid := p_property_id::uuid;
  v_listing_id uuid;
  v_link jsonb;
  v_amenity_id uuid;
  v_descriptions jsonb;
  v_image_record jsonb;
  v_document_record jsonb;
  v_video_record jsonb;
  v_result jsonb;
begin
  if not exists (
    select 1 from public."EstateProperties" ep
    where ep."Id" = v_property_id and ep."IsDeleted" = false
  ) then
    raise exception 'Property not found or already deleted';
  end if;

  if not public.is_property_owner(p_user_id::uuid, v_property_id) then
    raise exception 'User does not own this property';
  end if;

  update public."EstateProperties"
  set
    "StreetName" = coalesce(p_street_name, "StreetName"),
    "HouseNumber" = coalesce(p_house_number, "HouseNumber"),
    "Neighborhood" = coalesce(p_neighborhood, "Neighborhood"),
    "City" = coalesce(p_city, "City"),
    "State" = coalesce(p_state, "State"),
    "ZipCode" = coalesce(p_zip_code, "ZipCode"),
    "Country" = coalesce(p_country, "Country"),
    "LocationLatitude" = coalesce(p_location_lat, "LocationLatitude"),
    "LocationLongitude" = coalesce(p_location_lng, "LocationLongitude"),
    "AreaValue" = coalesce(p_area_value, "AreaValue"),
    "AreaUnit" = coalesce(p_area_unit, "AreaUnit"),
    "Bedrooms" = coalesce(p_bedrooms, "Bedrooms"),
    "Bathrooms" = coalesce(p_bathrooms, "Bathrooms"),
    "HasGarage" = coalesce(p_has_garage, "HasGarage"),
    "GarageSpaces" = coalesce(p_garage_spaces, "GarageSpaces")
  where "Id" = v_property_id;

  select l."Id"
  into v_listing_id
  from public."Listings" l
  where l."EstatePropertyId" = v_property_id
    and l."IsDeleted" = false
  order by l."IsFeatured" desc nulls last, l."Created" desc
  limit 1;

  if v_listing_id is not null then
    update public."Listings"
    set
      "Title" = coalesce(p_title, "Title"),
      "Description" = coalesce(p_description, "Description"),
      "AvailableFrom" = coalesce(p_available_from, "AvailableFrom"),
      "Currency" = coalesce(p_currency, "Currency"),
      "SalePrice" = coalesce(p_sale_price, "SalePrice"),
      "RentPrice" = coalesce(p_rent_price, "RentPrice"),
      "HasCommonExpenses" = coalesce(p_has_common_expenses, "HasCommonExpenses"),
      "CommonExpensesValue" = coalesce(p_common_expenses_value, "CommonExpensesValue"),
      "IsElectricityIncluded" = coalesce(p_is_electricity_included, "IsElectricityIncluded"),
      "IsWaterIncluded" = coalesce(p_is_water_included, "IsWaterIncluded"),
      "IsPriceVisible" = coalesce(p_is_price_visible, "IsPriceVisible"),
      "Status" = coalesce(p_status, "Status"),
      "IsActive" = coalesce(p_is_active, "IsActive"),
      "IsPropertyVisible" = coalesce(p_is_property_visible, "IsPropertyVisible"),
      "LastModified" = now(),
      "LastModifiedBy" = p_user_id
    where "Id" = v_listing_id;
  end if;

  if p_property_images is not null then
    update public."PropertyImages"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_images) = 'array' and jsonb_array_length(p_property_images) > 0 then
      for v_image_record in select * from jsonb_array_elements(p_property_images)
      loop
        insert into public."PropertyImages" (
          "Id", "EstatePropertyId", "Url", "AltText", "IsMain", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy", "DisplayOrder"
        ) values (
          coalesce(nullif(v_image_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_image_record->>'url',
          coalesce(v_image_record->>'altText', ''),
          coalesce((v_image_record->>'isMain')::boolean, false),
          false,
          now(), p_user_id, now(), p_user_id,
          coalesce((v_image_record->>'displayOrder')::integer, 0)
        );
      end loop;
    end if;
  end if;

  if p_property_documents is not null then
    update public."PropertyDocuments"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_documents) = 'array' and jsonb_array_length(p_property_documents) > 0 then
      for v_document_record in select * from jsonb_array_elements(p_property_documents)
      loop
        insert into public."PropertyDocuments" (
          "Id", "EstatePropertyId", "Url", "Name", "FileType", "IsPublic", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy"
        ) values (
          coalesce(nullif(v_document_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_document_record->>'url',
          coalesce(v_document_record->>'name', ''),
          coalesce(v_document_record->>'fileType', 'pdf'),
          coalesce((v_document_record->>'isPublic')::boolean, true),
          false,
          now(), p_user_id, now(), p_user_id
        );
      end loop;
    end if;
  end if;

  if p_property_videos is not null then
    update public."PropertyVideos"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_videos) = 'array' and jsonb_array_length(p_property_videos) > 0 then
      for v_video_record in select * from jsonb_array_elements(p_property_videos)
      loop
        insert into public."PropertyVideos" (
          "Id", "EstatePropertyId", "Url", "Title", "Description", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy"
        ) values (
          coalesce(nullif(v_video_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_video_record->>'url',
          coalesce(v_video_record->>'title', ''),
          coalesce(v_video_record->>'description', ''),
          false,
          now(), p_user_id, now(), p_user_id
        );
      end loop;
    end if;
  end if;

  if p_amenity_links is not null or p_amenity_ids is not null then
    delete from public."EstatePropertyAmenity"
    where "EstatePropertyId" = v_property_id;

    if p_amenity_links is not null
       and jsonb_typeof(p_amenity_links) = 'array'
       and jsonb_array_length(p_amenity_links) > 0 then
      for v_link in select * from jsonb_array_elements(p_amenity_links)
      loop
        v_amenity_id := nullif(trim(both from coalesce(v_link->>'amenityId', v_link->>'amenity_id', '')), '')::uuid;
        if v_amenity_id is null then
          continue;
        end if;
        v_descriptions := public.sanitize_amenity_localized_descriptions(v_link->'descriptions');
        insert into public."EstatePropertyAmenity" (
          "EstatePropertyId", "AmenityId", "LocalizedDescriptions", "CreatedAtUtc", "DeletedAtUtc"
        ) values (
          v_property_id, v_amenity_id, v_descriptions, now(), null
        );
      end loop;
    elsif p_amenity_ids is not null
          and jsonb_typeof(p_amenity_ids) = 'array'
          and jsonb_array_length(p_amenity_ids) > 0 then
      for v_amenity_id in
        select nullif(trim(both from value), '')::uuid
        from jsonb_array_elements_text(p_amenity_ids) as t(value)
        where nullif(trim(both from value), '') is not null
      loop
        insert into public."EstatePropertyAmenity" (
          "EstatePropertyId", "AmenityId", "LocalizedDescriptions", "CreatedAtUtc", "DeletedAtUtc"
        ) values (
          v_property_id, v_amenity_id, '{}'::jsonb, now(), null
        );
      end loop;
    end if;
  end if;

  if p_policies is not null then
    perform public.replace_estate_property_policies(v_property_id, p_policies);
  end if;

  if p_content_sections is not null then
    perform public.replace_estate_property_content_sections(v_property_id, p_content_sections);
  end if;

  select jsonb_build_object(
    'id', ep."Id",
    'streetName', ep."StreetName",
    'houseNumber', ep."HouseNumber",
    'neighborhood', ep."Neighborhood",
    'city', ep."City",
    'state', ep."State",
    'zipCode', ep."ZipCode",
    'country', ep."Country",
    'location', jsonb_build_object('lat', ep."LocationLatitude", 'lng', ep."LocationLongitude"),
    'title', l."Title",
    'areaValue', ep."AreaValue",
    'areaUnit', ep."AreaUnit",
    'bedrooms', ep."Bedrooms",
    'bathrooms', ep."Bathrooms",
    'hasGarage', ep."HasGarage",
    'garageSpaces', ep."GarageSpaces",
    'description', l."Description",
    'availableFrom', l."AvailableFrom",
    'ownerId', ep."OwnerId",
    'currency', l."Currency",
    'salePrice', l."SalePrice",
    'rentPrice', l."RentPrice",
    'hasCommonExpenses', l."HasCommonExpenses",
    'commonExpensesValue', l."CommonExpensesValue",
    'isElectricityIncluded', l."IsElectricityIncluded",
    'isWaterIncluded', l."IsWaterIncluded",
    'isPriceVisible', l."IsPriceVisible",
    'status', l."Status",
    'isActive', l."IsActive",
    'isPropertyVisible', l."IsPropertyVisible",
    'created', ep."Created"
  )
  into v_result
  from public."EstateProperties" ep
  left join public."Listings" l on l."Id" = v_listing_id
  where ep."Id" = v_property_id;

  return v_result;
exception
  when others then
    raise exception 'Failed to update estate property: %', sqlerrm;
end;
$$;


--
-- Name: update_guest_review_by_reservation_code(text, text, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_guest_review_by_reservation_code(p_reservation_code text, p_guest_email text, p_rating integer, p_comment text, p_listing_type text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_code text;
  v_listing_type public."ListingType";
  v_booking record;
  v_guest_email text;
  v_profile_email text;
  v_review_id uuid;
  v_window jsonb;
  v_window_start timestamptz;
  v_window_end timestamptz;
begin
  v_code := upper(trim(coalesce(p_reservation_code, '')));

  if v_code = '' or v_code !~ '^RSV-[A-Z0-9]{6}$' then
    return jsonb_build_object('success', false, 'error', 'Invalid reservation code format');
  end if;

  begin
    v_listing_type := public.validate_guest_site_listing_type(p_listing_type);
  exception
    when others then
      return jsonb_build_object('success', false, 'error', 'Invalid listing type');
  end;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('success', false, 'error', 'Rating must be between 1 and 5');
  end if;

  if coalesce(trim(p_comment), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Comment is required');
  end if;

  if coalesce(trim(p_guest_email), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Guest email does not match');
  end if;

  select
    b."Id" as booking_id,
    b."GuestId" as guest_id,
    b."EstatePropertyId" as estate_property_id,
    b."ListingType" as booking_listing_type,
    b."CheckInDate" as check_in,
    b."CheckOutDate" as check_out,
    b."Status" as status_code,
    b."IsDeleted" as is_deleted
  into v_booking
  from public."Bookings" b
  where b."ReservationCode" = v_code
    and b."IsDeleted" = false
  order by b."Created" desc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if not public.booking_matches_guest_site_listing_type(
    v_booking.booking_listing_type,
    v_booking.estate_property_id,
    v_booking.check_in,
    v_booking.check_out,
    v_listing_type
  ) then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if coalesce(v_booking.is_deleted, false) then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if v_booking.guest_id is null then
    return jsonb_build_object('success', false, 'error', 'Booking not eligible for review');
  end if;

  if v_booking.status_code not in (1, 3) then
    return jsonb_build_object('success', false, 'error', 'Booking not eligible for review');
  end if;

  v_window := public.compute_guest_review_window(v_booking.check_out);
  v_window_start := (v_window->>'windowStart')::timestamptz;
  v_window_end := (v_window->>'windowEnd')::timestamptz;

  if now() < v_window_start then
    return jsonb_build_object('success', false, 'error', 'Checkout has not passed');
  end if;

  if now() > v_window_end then
    return jsonb_build_object('success', false, 'error', 'Review window expired');
  end if;

  v_guest_email := lower(trim(p_guest_email));
  v_profile_email := lower(trim(coalesce(public.resolve_guest_profile(v_booking.guest_id)->>'email', '')));

  if v_guest_email = '' or v_profile_email = '' or v_guest_email <> v_profile_email then
    return jsonb_build_object('success', false, 'error', 'Guest email does not match');
  end if;

  update public."Reviews" r
  set
    "Rating" = p_rating,
    "Comment" = trim(p_comment),
    "LastModified" = now()
  where r."BookingId" = v_booking.booking_id
  returning r."Id" into v_review_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Review not found');
  end if;

  return jsonb_build_object(
    'success', true,
    'reviewId', v_review_id,
    'listingType', v_listing_type::text
  );
end;
$_$;


--
-- Name: update_member_avatar(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_member_avatar(avatar_url text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update "Members"
  set
    "AvatarUrl"   = avatar_url,
    "LastModified" = now()
  where "UserId" = auth.uid()
    and "IsDeleted" = false;

  return true;
end;
$$;


--
-- Name: update_owner_onboarding_step(uuid, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_owner_onboarding_step(p_member_id uuid, p_step integer, p_dismissed boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.member_rpc_caller_ok(p_member_id) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  -- p_step is not persisted (no column); dismiss/exit sets "NeedsOnboarding" = false.
  update public."Members" m
  set
    "NeedsOnboarding" = case
      when p_dismissed then false
      else m."NeedsOnboarding"
    end,
    "LastModified" = timezone('utc', now())
  where m."Id" = p_member_id
    and m."IsDeleted" = false;

  return jsonb_build_object('success', true);
end;
$$;


--
-- Name: update_user_role(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_role(p_member_id uuid, p_new_role text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform admin_internal.require_admin();
  update public."Members"
  set
    "Role" = p_new_role,
    "LastModified" = timezone('utc', now())
  where "Id" = p_member_id;
  return jsonb_build_object('success', true, 'message', 'Role updated');
end;
$$;


--
-- Name: update_user_role(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_role(p_member_id uuid, p_new_role text, p_admin_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Validate role
    IF p_new_role NOT IN ('user', 'admin') THEN
        RETURN json_build_object('success', false, 'message', 'Invalid role specified');
    END IF;

    -- Get admin ID from current user if not provided
    IF p_admin_id IS NULL THEN
        SELECT "Id" INTO v_admin_id
        FROM "Members"
        WHERE "UserId" = auth.uid() AND "IsDeleted" = false;
    ELSE
        v_admin_id := p_admin_id;
    END IF;

    -- Update member role (single role system)
    UPDATE "Members"
    SET "Role" = p_new_role, "LastModified" = now(), "LastModifiedBy" = v_admin_id::text
    WHERE "Id" = p_member_id AND "IsDeleted" = false;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Insert audit history
    INSERT INTO "MemberActionHistory" ("MemberId", "ActionType", "ActionDetails", "PerformedBy")
    VALUES (p_member_id, 'role_change', json_build_object('newRole', p_new_role), v_admin_id);

    RETURN json_build_object('success', true, 'message', 'User role updated successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;


--
-- Name: upsert_admin_plan(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_admin_plan(p_payload jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: FUNCTION upsert_admin_plan(p_payload jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.upsert_admin_plan(p_payload jsonb) IS 'Admin-only create/update for Plans catalog. Key and Id are immutable on update.';


--
-- Name: upsert_app_parameter(text, text, jsonb, text, text, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_app_parameter(p_name text, p_parameter_type text, p_value jsonb, p_site_scope text DEFAULT 'global'::text, p_description text DEFAULT NULL::text, p_is_active boolean DEFAULT true, p_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_type public."AppParameterType";
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  v_type := p_parameter_type::public."AppParameterType";

  if p_id is not null then
    update public."AppParameters"
    set
      "Name" = upper(trim(p_name)),
      "ParameterType" = v_type,
      "Value" = p_value,
      "SiteScope" = coalesce(nullif(trim(p_site_scope), ''), 'global'),
      "Description" = p_description,
      "IsActive" = coalesce(p_is_active, true),
      "LastModified" = now()
    where "Id" = p_id
      and "IsDeleted" = false
    returning "Id" into v_id;

    if v_id is null then
      raise exception 'Parameter not found';
    end if;
    return v_id;
  end if;

  insert into public."AppParameters" (
    "Name", "ParameterType", "Value", "SiteScope", "Description", "IsActive"
  )
  values (
    upper(trim(p_name)),
    v_type,
    p_value,
    coalesce(nullif(trim(p_site_scope), ''), 'global'),
    p_description,
    coalesce(p_is_active, true)
  )
  on conflict ("Name", "SiteScope") do update
  set
    "ParameterType" = excluded."ParameterType",
    "Value" = excluded."Value",
    "Description" = excluded."Description",
    "IsActive" = excluded."IsActive",
    "IsDeleted" = false,
    "LastModified" = now()
  returning "Id" into v_id;

  return v_id;
end;
$$;


--
-- Name: upsert_guest_by_email(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_guest_by_email(p_first_name text, p_last_name text, p_email text, p_phone_number text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_first text := trim(coalesce(p_first_name, ''));
  v_last text := trim(coalesce(p_last_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := trim(coalesce(p_phone_number, ''));
  v_id uuid;
begin
  if v_first = '' then
    raise exception 'First name is required';
  end if;

  if v_last = '' then
    raise exception 'Last name is required';
  end if;

  if v_email = '' then
    raise exception 'Email is required';
  end if;

  if v_phone = '' then
    raise exception 'Phone number is required';
  end if;

  insert into public."Guests" (
    "FirstName",
    "LastName",
    "Email",
    "PhoneNumber",
    "Created",
    "LastModified"
  ) values (
    v_first,
    v_last,
    v_email,
    v_phone,
    now(),
    now()
  )
  on conflict ((lower(trim("Email"))))
  do update set
    "FirstName" = excluded."FirstName",
    "LastName" = excluded."LastName",
    "PhoneNumber" = excluded."PhoneNumber",
    "LastModified" = now()
  returning "Id" into v_id;

  return v_id;
end;
$$;


--
-- Name: usage_reference_matches_billing_subject(text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.usage_reference_matches_billing_subject(p_subject_type text, p_subject_id uuid, p_type text, p_reference_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case
    when p_type = 'booking' then exists (
      select 1
      from public."Bookings" b
      join public."EstateProperties" ep
        on ep."Id" = b."EstatePropertyId"
       and ep."IsDeleted" = false
      join public."Owners" o
        on o."Id" = ep."OwnerId"
       and o."IsDeleted" = false
      where b."Id"::text = p_reference_id
        and coalesce(b."IsDeleted", false) = false
        and (
          (p_subject_type = 'member' and o."OwnerType" = 'member' and o."MemberId" = p_subject_id)
          or (p_subject_type = 'company' and o."OwnerType" = 'company' and o."CompanyId" = p_subject_id)
        )
    )
    when p_type = 'listing' then exists (
      select 1
      from public."Listings" l
      join public."EstateProperties" ep
        on ep."Id" = l."EstatePropertyId"
       and ep."IsDeleted" = false
      join public."Owners" o
        on o."Id" = ep."OwnerId"
       and o."IsDeleted" = false
      where l."Id"::text = p_reference_id
        and coalesce(l."IsDeleted", false) = false
        and (
          (p_subject_type = 'member' and o."OwnerType" = 'member' and o."MemberId" = p_subject_id)
          or (p_subject_type = 'company' and o."OwnerType" = 'company' and o."CompanyId" = p_subject_id)
        )
    )
    else false
  end;
$$;


--
-- Name: user_can_manage_billing_subject(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_can_manage_billing_subject(p_subject_type text, p_subject_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    public.is_admin()
    or (
      p_subject_type = 'member'
      and p_subject_id in (
        select m."Id"
        from public."Members" m
        where m."UserId" = auth.uid()
          and m."IsDeleted" = false
      )
    )
    or (
      p_subject_type = 'company'
      and public.is_company_manager(p_subject_id)
    );
$$;


--
-- Name: user_can_manage_calendar_integration(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_can_manage_calendar_integration(p_integration_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public."CalendarIntegrations" ci
    where ci."Id" = p_integration_id
      and ci."IsDeleted" = false
      and public.user_can_manage_estate_property(ci."EstatePropertyId")
  );
$$;


--
-- Name: user_can_manage_estate_property(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_can_manage_estate_property(p_estate_property_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.is_property_owner(auth.uid(), p_estate_property_id);
$$;


--
-- Name: FUNCTION user_can_manage_estate_property(p_estate_property_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.user_can_manage_estate_property(p_estate_property_id uuid) IS 'True when the current auth user owns or manages the estate property (member owner or company Admin/Manager).';


--
-- Name: user_can_manage_listing(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_can_manage_listing(p_listing_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public."Listings" l
    where l."Id" = p_listing_id
      and l."IsDeleted" = false
      and public.user_can_manage_estate_property(l."EstatePropertyId")
  );
$$;


--
-- Name: user_can_manage_property_section(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_can_manage_property_section(p_section_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.propertydetailssection s
    where s.id = p_section_id
      and s.isdeleted = false
      and public.user_can_manage_estate_property(s.propertyid)
  );
$$;


--
-- Name: user_can_read_owner_record(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_can_read_owner_record(p_owner_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public."Owners" o
    where o."Id" = p_owner_id
      and o."IsDeleted" = false
      and (
        (
          o."OwnerType" = 'member'
          and o."MemberId" = public.current_member_id()
        )
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = public.current_member_id()
              and cm."IsDeleted" = false
          )
        )
      )
  );
$$;


--
-- Name: user_is_record_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_is_record_member(p_member_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p_member_id is not null
    and p_member_id = public.current_member_id();
$$;


--
-- Name: user_owns_auth_user_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_owns_auth_user_id(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p_user_id is not null
    and p_user_id = auth.uid();
$$;


--
-- Name: FUNCTION user_owns_auth_user_id(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.user_owns_auth_user_id(p_user_id uuid) IS 'True when p_user_id matches the current auth.users id.';


--
-- Name: user_owns_owner_record(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_owns_owner_record(p_owner_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public."Owners" o
    join public."Members" m
      on m."UserId" = auth.uid()
     and m."IsDeleted" = false
    where o."Id" = p_owner_id
      and o."IsDeleted" = false
      and (
        (o."OwnerType" = 'member' and o."MemberId" = m."Id")
        or (
          o."OwnerType" = 'company'
          and public.is_company_manager(o."CompanyId")
        )
      )
  );
$$;


--
-- Name: FUNCTION user_owns_owner_record(p_owner_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.user_owns_owner_record(p_owner_id uuid) IS 'True when the current auth user is the member owner or a company Admin/Manager for the Owners row.';


--
-- Name: validate_booking_selection(uuid, date, date, integer, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_booking_selection(p_property_id uuid, p_check_in date, p_check_out date, p_guests integer, p_visible_check_out date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_nights integer;
  v_rules record;
  v_errors text[] := array[]::text[];
  v_effective_check_out date;
begin
  v_effective_check_out := coalesce(p_visible_check_out, p_check_out);

  if p_property_id is null or p_check_in is null or p_check_out is null then
    return jsonb_build_object(
      'is_valid', false,
      'errors', jsonb_build_array('Missing required fields')
    );
  end if;

  if v_effective_check_out <= p_check_in then
    v_errors := array_append(v_errors, 'Check-out date must be after check-in date');
  end if;

  if p_guests is null or p_guests < 1 then
    v_errors := array_append(v_errors, 'Guests must be at least 1');
  end if;

  select
    sx."MinStayDays" as min_stay_days,
    sx."MaxStayDays" as max_stay_days,
    sx."LeadTimeDays" as lead_time_days,
    sx."BufferDays" as buffer_days,
    coalesce(l."RentPrice", 0) as rent_price,
    coalesce(l."Capacity", ep."Capacity", 0) as max_guests
  into v_rules
  from public."EstateProperties" ep
  join public."Listings" l on l."EstatePropertyId" = ep."Id"
  left join public."SummerRentExtension" sx on sx."EstatePropertyId" = ep."Id"
  where ep."Id" = p_property_id
    and ep."IsDeleted" = false
    and l."IsDeleted" = false
    and l."IsActive" = true
  limit 1;

  if not found then
    v_errors := array_append(v_errors, 'Property not found or inactive');
  end if;

  v_nights := greatest((v_effective_check_out - p_check_in), 0);

  if v_rules.min_stay_days is not null and v_nights < v_rules.min_stay_days then
    v_errors := array_append(v_errors, 'Minimum stay rule not met');
  end if;

  if v_rules.max_stay_days is not null and v_nights > v_rules.max_stay_days then
    v_errors := array_append(v_errors, 'Maximum stay rule exceeded');
  end if;

  if v_rules.lead_time_days is not null and p_check_in < (current_date + v_rules.lead_time_days) then
    v_errors := array_append(v_errors, 'Lead time rule not met');
  end if;

  if v_rules.max_guests > 0 and p_guests > v_rules.max_guests then
    v_errors := array_append(v_errors, 'Guest count exceeds property capacity');
  end if;

  return jsonb_build_object(
    'is_valid', array_length(v_errors, 1) is null,
    'errors', to_jsonb(coalesce(v_errors, array[]::text[])),
    'pricing', jsonb_build_object(
      'nightly_price', coalesce(v_rules.rent_price, 0),
      'nights', v_nights,
      'total_price', coalesce(v_rules.rent_price, 0) * v_nights
    ),
    'normalized_rules', jsonb_build_object(
      'min_stay_days', v_rules.min_stay_days,
      'max_stay_days', v_rules.max_stay_days,
      'lead_time_days', v_rules.lead_time_days,
      'buffer_days', v_rules.buffer_days,
      'max_guests', v_rules.max_guests
    )
  );
end;
$$;


--
-- Name: validate_booking_selection(uuid, date, date, integer, text, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_booking_selection(p_property_id uuid, p_check_in date, p_check_out date, p_guests integer, p_listing_type text DEFAULT NULL::text, p_client_total numeric DEFAULT NULL::numeric, p_site_scope text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_listing_type text;
  v_scope text;
  v_result jsonb;
  v_total numeric;
  v_tolerance numeric;
  v_pricing jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_is_valid boolean := true;
begin
  if p_guests is null or p_guests < 1 then
    v_errors := v_errors || jsonb_build_array('Invalid guest count');
    v_is_valid := false;
  end if;

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    v_errors := v_errors || jsonb_build_array('Invalid check-in/check-out dates');
    v_is_valid := false;
  end if;

  if not v_is_valid then
    return jsonb_build_object('is_valid', false, 'errors', v_errors, 'pricing', null);
  end if;

  -- Resolve listing type from featured listing if omitted
  v_listing_type := nullif(trim(coalesce(p_listing_type, '')), '');
  if v_listing_type is null then
    select l."ListingType"::text
    into v_listing_type
    from public."Listings" l
    where l."EstatePropertyId" = p_property_id
      and l."IsDeleted" = false
      and l."IsFeatured" = true
    limit 1;
  end if;

  v_scope := coalesce(nullif(trim(p_site_scope), ''), v_listing_type, 'SummerRent');

  if v_listing_type in ('SummerRent', 'EventVenue') then
    v_result := public.pricing_compute_stay_total(
      null,
      p_property_id,
      v_listing_type,
      p_check_in,
      p_check_out,
      v_scope,
      current_date
    );

    if not coalesce((v_result->>'is_valid')::boolean, false) then
      return v_result;
    end if;

    v_pricing := v_result -> 'pricing';
    v_total := (v_pricing->>'total_price')::numeric;

    v_tolerance := public.pricing_param_number(
      public.get_app_parameters(v_scope),
      'PRICE_QUOTE_TOLERANCE',
      1
    );

    if p_client_total is not null and abs(v_total - p_client_total) > v_tolerance then
      return jsonb_build_object(
        'is_valid', false,
        'errors', jsonb_build_array('Price quote mismatch'),
        'error_code', 'PRICE_QUOTE_MISMATCH',
        'pricing', v_pricing
      );
    end if;

    return jsonb_build_object(
      'is_valid', true,
      'errors', '[]'::jsonb,
      'pricing', v_pricing
    );
  end if;

  -- Non dynamic types: legacy flat rent * nights if RentPrice set
  declare
    v_listing record;
    v_nights integer := (p_check_out - p_check_in);
    v_legacy_total numeric;
  begin
    select l."RentPrice", l."Id"
    into v_listing
    from public."Listings" l
    where l."EstatePropertyId" = p_property_id
      and l."IsDeleted" = false
      and l."IsFeatured" = true
    limit 1;

    if v_listing."RentPrice" is not null and v_nights > 0 then
      v_legacy_total := round((v_listing."RentPrice" * v_nights)::numeric, 2);
      v_pricing := jsonb_build_object(
        'nightly_price', v_listing."RentPrice",
        'nights', v_nights,
        'total_price', v_legacy_total
      );
      return jsonb_build_object('is_valid', true, 'errors', '[]'::jsonb, 'pricing', v_pricing);
    end if;

    return jsonb_build_object('is_valid', true, 'errors', '[]'::jsonb, 'pricing', null);
  end;
end;
$$;


--
-- Name: validate_guest_booking_overlap(text, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_guest_booking_overlap(p_email text, p_check_in timestamp with time zone, p_check_out timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_guest_id uuid;
  v_overlap_message text := 'You already have a reservation that overlaps these dates.';
begin
  if v_email = '' then
    return jsonb_build_object('success', false, 'error', 'Email is required');
  end if;

  if p_check_in is null or p_check_out is null then
    return jsonb_build_object('success', false, 'error', 'Check-in and check-out are required');
  end if;

  if p_check_in >= p_check_out then
    return jsonb_build_object('success', false, 'error', 'Check-in must be before check-out');
  end if;

  select g."Id"
  into v_guest_id
  from public."Guests" g
  where lower(trim(g."Email")) = v_email
  limit 1;

  if v_guest_id is null then
    return jsonb_build_object('success', true, 'hasOverlap', false);
  end if;

  if public.guest_has_overlapping_booking(v_guest_id, p_check_in, p_check_out) then
    return jsonb_build_object(
      'success', true,
      'hasOverlap', true,
      'error_code', 'GUEST_BOOKING_OVERLAP',
      'error', v_overlap_message
    );
  end if;

  return jsonb_build_object('success', true, 'hasOverlap', false);
end;
$$;


--
-- Name: FUNCTION validate_guest_booking_overlap(p_email text, p_check_in timestamp with time zone, p_check_out timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validate_guest_booking_overlap(p_email text, p_check_in timestamp with time zone, p_check_out timestamp with time zone) IS 'Pre-check whether a guest email already has overlapping non-cancelled bookings for the date range.';


--
-- Name: validate_guest_site_listing_type(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_guest_site_listing_type(p_listing_type text) RETURNS public."ListingType"
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  v_normalized text;
begin
  v_normalized := trim(coalesce(p_listing_type, ''));

  if v_normalized = '' then
    raise exception 'Listing type is required';
  end if;

  if v_normalized not in ('RealEstate', 'SummerRent', 'EventVenue') then
    raise exception 'Invalid listing type: %', v_normalized;
  end if;

  return v_normalized::public."ListingType";
end;
$$;


--
-- Name: validate_polymorphic_guest_id(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_polymorphic_guest_id(p_guest_id uuid, p_allow_null boolean DEFAULT false) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if p_guest_id is null then
    if p_allow_null then
      return;
    end if;
    raise exception 'GuestId is required';
  end if;

  if exists (
    select 1
    from public."Members" m
    where m."Id" = p_guest_id
      and m."IsDeleted" = false
  ) then
    return;
  end if;

  if exists (
    select 1
    from public."Guests" g
    where g."Id" = p_guest_id
  ) then
    return;
  end if;

  raise exception 'GuestId must reference an active Member or a Guest';
end;
$$;


--
-- Name: verify_booking_otp(text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_booking_otp(p_phone text, p_otp_code text, p_hold_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
declare
  v_request public.otp_requests%rowtype;
  v_salt text;
  v_hash text;
  v_computed_hash text;
begin
  select *
  into v_request
  from public.otp_requests
  where phone = p_phone
    and (p_hold_id is null or hold_id = p_hold_id)
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'OTP request not found');
  end if;

  if v_request.verified then
    return jsonb_build_object('success', false, 'error', 'OTP already used');
  end if;

  if v_request.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'OTP expired');
  end if;

  if v_request.attempts >= v_request.max_attempts then
    return jsonb_build_object('success', false, 'error', 'Max attempts exceeded');
  end if;

  v_salt := split_part(v_request.otp_hash, '$', 1);
  v_hash := split_part(v_request.otp_hash, '$', 2);

  if v_salt is null or v_salt = '' or v_hash is null or v_hash = '' then
    return jsonb_build_object('success', false, 'error', 'Stored OTP hash is invalid');
  end if;

  v_computed_hash := encode(digest(v_salt || ':' || p_otp_code, 'sha256'), 'hex');

  if v_computed_hash <> v_hash then
    update public.otp_requests
    set
      attempts = attempts + 1,
      updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'success', false,
      'error', 'Invalid OTP code',
      'attempts_left', greatest((v_request.max_attempts - (v_request.attempts + 1)), 0)
    );
  end if;

  update public.otp_requests
  set
    verified = true,
    verified_at = now(),
    updated_at = now()
  where id = v_request.id;

  if p_hold_id is not null then
    update public.booking_holds
    set
      phone = p_phone,
      otp_verified_at = now(),
      updated_at = now()
    where id = p_hold_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'otp_request_id', v_request.id
  );
end;
$_$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Amenities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Amenities" (
    "Id" uuid NOT NULL,
    "Name" text,
    "IconId" text,
    "IsDeleted" boolean NOT NULL,
    "PropertyType" public."PropertyType"
);


--
-- Name: AppParameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AppParameters" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "Name" text NOT NULL,
    "ParameterType" public."AppParameterType" DEFAULT 'string'::public."AppParameterType" NOT NULL,
    "Value" jsonb DEFAULT 'null'::jsonb NOT NULL,
    "SiteScope" text DEFAULT 'global'::text NOT NULL,
    "Description" text,
    "IsActive" boolean DEFAULT true NOT NULL,
    "IsDeleted" boolean DEFAULT false NOT NULL,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "AppParameters_SiteScope_check" CHECK (("SiteScope" = ANY (ARRAY['global'::text, 'SummerRent'::text, 'EventVenue'::text])))
);


--
-- Name: AuthEmailChangeRequests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuthEmailChangeRequests" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "UserId" uuid NOT NULL,
    "NewEmail" text NOT NULL,
    "CodeHash" text NOT NULL,
    "ExpiresAt" timestamp with time zone NOT NULL,
    "ConsumedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: AvailabilityBlocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AvailabilityBlocks" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "EstatePropertyId" uuid NOT NULL,
    "IsAvailable" boolean NOT NULL,
    "StartDate" timestamp with time zone NOT NULL,
    "EndDate" timestamp with time zone NOT NULL,
    "RecurrencePattern" jsonb,
    "BlockType" integer DEFAULT 0 NOT NULL,
    "Source" character varying(50) DEFAULT 'internal'::character varying,
    "ExternalEventId" character varying(500),
    "Title" character varying(255),
    "Description" text,
    "IsReadOnly" boolean DEFAULT false NOT NULL,
    "ConflictFlagged" boolean DEFAULT false NOT NULL,
    "IsDeleted" boolean DEFAULT false NOT NULL,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModifiedBy" text,
    CONSTRAINT "CHK_AvailabilityBlocks_BlockType" CHECK (("BlockType" = ANY (ARRAY[0, 1, 2, 3]))),
    CONSTRAINT "CHK_AvailabilityBlocks_DateRange" CHECK (("StartDate" < "EndDate"))
);


--
-- Name: BillingCycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BillingCycles" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "StartDate" timestamp with time zone NOT NULL,
    "EndDate" timestamp with time zone NOT NULL,
    "Status" text DEFAULT 'open'::text NOT NULL,
    "TotalAmount" numeric DEFAULT 0 NOT NULL,
    "CreatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "UpdatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModifiedBy" text,
    "SubjectType" text NOT NULL,
    "MemberOrCompanyId" uuid NOT NULL,
    CONSTRAINT "CK_BillingCycles_Status" CHECK (("Status" = ANY (ARRAY['open'::text, 'closed'::text, 'paid'::text]))),
    CONSTRAINT "CK_BillingCycles_SubjectType" CHECK (("SubjectType" = ANY (ARRAY['member'::text, 'company'::text])))
);


--
-- Name: BillingPlanAssignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BillingPlanAssignments" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "SubjectType" text NOT NULL,
    "MemberOrCompanyId" uuid NOT NULL,
    "PlanId" uuid NOT NULL,
    "StartDate" timestamp with time zone DEFAULT now() NOT NULL,
    "EndDate" timestamp with time zone,
    "IsActive" boolean DEFAULT true NOT NULL,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModifiedBy" text,
    CONSTRAINT "CK_BillingPlanAssignments_SubjectType" CHECK (("SubjectType" = ANY (ARRAY['member'::text, 'company'::text])))
);


--
-- Name: TABLE "BillingPlanAssignments"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."BillingPlanAssignments" IS 'Plan subscription for a member or company (SubjectType + MemberOrCompanyId).';


--
-- Name: Bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Bookings" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "EstatePropertyId" uuid NOT NULL,
    "GuestId" uuid,
    "CheckInDate" date NOT NULL,
    "CheckOutDate" date NOT NULL,
    "Status" integer DEFAULT 0 NOT NULL,
    "ValidationStatus" integer DEFAULT 0 NOT NULL,
    "HasConflict" boolean DEFAULT false NOT NULL,
    "ConflictReason" text,
    "GuestCount" integer DEFAULT 1 NOT NULL,
    "TotalAmount" numeric,
    "Currency" integer DEFAULT 0 NOT NULL,
    "Notes" text,
    "BookingSource" character varying(100),
    "ExternalBookingId" character varying(255),
    "IsDeleted" boolean DEFAULT false NOT NULL,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModifiedBy" text,
    "PaymentStatus" integer DEFAULT 0 NOT NULL,
    "ReservationCode" text,
    "ListingType" public."ListingType",
    CONSTRAINT "CHK_Bookings_DateRange" CHECK (("CheckInDate" < "CheckOutDate")),
    CONSTRAINT "CHK_Bookings_GuestCount" CHECK (("GuestCount" > 0)),
    CONSTRAINT "CHK_Bookings_ReservationCode_Format" CHECK ((("ReservationCode" IS NULL) OR ("ReservationCode" ~ '^RSV-[A-Z0-9]{6}$'::text)))
);


--
-- Name: COLUMN "Bookings"."PaymentStatus"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Bookings"."PaymentStatus" IS '0 = Unpaid, 1 = Paid; required for review eligibility';


--
-- Name: CalendarIntegrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CalendarIntegrations" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "EstatePropertyId" uuid NOT NULL,
    "PlatformType" integer NOT NULL,
    "ExternalCalendarId" character varying(500) NOT NULL,
    "ExternalCalendarName" character varying(255),
    "AccessToken" text,
    "RefreshToken" text,
    "TokenExpiresAt" timestamp with time zone,
    "IsActive" boolean DEFAULT true NOT NULL,
    "LastSyncAt" timestamp with time zone,
    "SyncStatus" integer DEFAULT 0 NOT NULL,
    "IsDeleted" boolean DEFAULT false NOT NULL,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModifiedBy" text,
    "ICalUrl" text,
    "ICalSyncToken" text,
    CONSTRAINT "CHK_CalendarIntegrations_PlatformType" CHECK (("PlatformType" = ANY (ARRAY[0, 1, 2, 3, 4]))),
    CONSTRAINT "CalendarIntegrations_PlatformType_check" CHECK (("PlatformType" = ANY (ARRAY[0, 1])))
);


--
-- Name: COLUMN "CalendarIntegrations"."ICalUrl"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."CalendarIntegrations"."ICalUrl" IS 'iCal feed URL for external calendar import (HTTPS only)';


--
-- Name: COLUMN "CalendarIntegrations"."ICalSyncToken"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."CalendarIntegrations"."ICalSyncToken" IS 'ETag or sync token for iCal optimization';


--
-- Name: CONSTRAINT "CHK_CalendarIntegrations_PlatformType" ON "CalendarIntegrations"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT "CHK_CalendarIntegrations_PlatformType" ON public."CalendarIntegrations" IS 'Platform types: 0=Google Calendar, 1=Apple Calendar, 2=Airbnb iCal, 3=Booking.com iCal, 4=Other iCal';


--
-- Name: Companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Companies" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "Name" character varying(200) NOT NULL,
    "BillingContactUserId" uuid NOT NULL,
    "BillingEmail" character varying(255) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "LogoUrl" character varying(2048),
    "BannerUrl" character varying(2048),
    "Description" character varying(500),
    "Street" character varying(255),
    "Street2" character varying(255),
    "City" character varying(100),
    "State" character varying(100),
    "PostalCode" character varying(20),
    "Country" character varying(100),
    "Phone" character varying(50),
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" text
);


--
-- Name: CompanyMembers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CompanyMembers" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "MemberId" uuid NOT NULL,
    "CompanyId" uuid NOT NULL,
    "Role" text NOT NULL,
    "AddedBy" uuid NOT NULL,
    "JoinedAt" timestamp with time zone NOT NULL,
    "IsDeleted" boolean NOT NULL
);


--
-- Name: EstateProperties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EstateProperties" (
    "Id" uuid NOT NULL,
    "StreetName" character varying(255),
    "HouseNumber" character varying(25),
    "Neighborhood" character varying(100),
    "City" character varying(100),
    "State" character varying(100),
    "ZipCode" character varying(20),
    "Country" character varying(100),
    "LocationLatitude" numeric NOT NULL,
    "LocationLongitude" numeric NOT NULL,
    "AreaValue" numeric,
    "AreaUnit" integer,
    "Bedrooms" integer NOT NULL,
    "Bathrooms" integer NOT NULL,
    "HasGarage" boolean NOT NULL,
    "GarageSpaces" integer NOT NULL,
    "OwnerId" uuid,
    "IsDeleted" boolean NOT NULL,
    "HasLaundryRoom" boolean DEFAULT false NOT NULL,
    "HasPool" boolean DEFAULT false NOT NULL,
    "HasBalcony" boolean DEFAULT false NOT NULL,
    "IsFurnished" boolean DEFAULT false NOT NULL,
    "Capacity" integer,
    "LocationCategory" public."LocationCategory",
    "ViewType" public."ViewType",
    "Created" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: COLUMN "EstateProperties"."OwnerId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."EstateProperties"."OwnerId" IS 'References Owners.Id - unified ownership for members and companies';


--
-- Name: EstatePropertyAmenity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EstatePropertyAmenity" (
    "EstatePropertyId" uuid NOT NULL,
    "AmenityId" uuid NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "DeletedAtUtc" timestamp with time zone,
    "LocalizedDescriptions" jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT estate_property_amenity_localized_descriptions_check CHECK (public.is_valid_amenity_localized_descriptions("LocalizedDescriptions"))
);


--
-- Name: COLUMN "EstatePropertyAmenity"."LocalizedDescriptions"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."EstatePropertyAmenity"."LocalizedDescriptions" IS 'Optional per-language copy for this amenity on this property. Keys: en, es, pt.';


--
-- Name: EstatePropertyPolicy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EstatePropertyPolicy" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "EstatePropertyId" uuid NOT NULL,
    "ListingType" public."ListingType" NOT NULL,
    "LocalizedTitle" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "LocalizedDescription" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "DisplayOrder" integer DEFAULT 0 NOT NULL,
    "IsDeleted" boolean DEFAULT false NOT NULL,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT estate_property_policy_localized_description_check CHECK (public.is_valid_localized_text_json("LocalizedDescription")),
    CONSTRAINT estate_property_policy_localized_title_check CHECK (public.is_valid_localized_text_json("LocalizedTitle"))
);


--
-- Name: TABLE "EstatePropertyPolicy"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."EstatePropertyPolicy" IS 'Stationary policies per estate property, scoped by guest-site ListingType (not linked to Listings rows).';


--
-- Name: EventVenueExtension; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EventVenueExtension" (
    "EstatePropertyId" uuid NOT NULL,
    "MaxGuests" integer,
    "HasCatering" boolean,
    "HasSoundSystem" boolean,
    "ClosingHour" time without time zone,
    "AllowedEventsDescription" text,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModifiedBy" text
);


--
-- Name: ExternalCalendarEvents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExternalCalendarEvents" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "CalendarIntegrationId" uuid NOT NULL,
    "ExternalEventId" character varying(500) NOT NULL,
    "ExternalEventData" jsonb NOT NULL,
    "Title" character varying(500),
    "Description" text,
    "StartDate" timestamp with time zone NOT NULL,
    "EndDate" timestamp with time zone NOT NULL,
    "IsAllDay" boolean DEFAULT false NOT NULL,
    "Location" character varying(500),
    "LastSyncedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "IsDeleted" boolean DEFAULT false NOT NULL,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModifiedBy" text,
    CONSTRAINT "CHK_ExternalCalendarEvents_DateRange" CHECK (("StartDate" <= "EndDate"))
);


--
-- Name: Favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Favorites" (
    "MemberId" uuid NOT NULL,
    "EstatePropertyId" uuid NOT NULL,
    "FavoritedAt" timestamp with time zone NOT NULL
);


--
-- Name: ForceLogoutRequests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ForceLogoutRequests" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "MemberId" uuid NOT NULL,
    "RequestedByMemberId" uuid NOT NULL,
    "Reason" text,
    "RequestedAt" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    "AcknowledgedAt" timestamp with time zone
);


--
-- Name: Guests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Guests" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "FirstName" text NOT NULL,
    "LastName" text NOT NULL,
    "Email" text NOT NULL,
    "PhoneNumber" text NOT NULL,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CHK_Guests_Email" CHECK ((length(TRIM(BOTH FROM "Email")) > 0)),
    CONSTRAINT "CHK_Guests_FirstName" CHECK ((length(TRIM(BOTH FROM "FirstName")) > 0)),
    CONSTRAINT "CHK_Guests_LastName" CHECK ((length(TRIM(BOTH FROM "LastName")) > 0)),
    CONSTRAINT "CHK_Guests_PhoneNumber" CHECK ((length(TRIM(BOTH FROM "PhoneNumber")) > 0))
);


--
-- Name: TABLE "Guests"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Guests" IS 'Non-member guests for client-side bookings. Unique by normalized email; upsert updates name and phone.';


--
-- Name: Invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Invoices" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "BillingCycleId" uuid NOT NULL,
    "Total" numeric DEFAULT 0 NOT NULL,
    "Status" text DEFAULT 'pending'::text NOT NULL,
    "CreatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "UpdatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModifiedBy" text,
    "DueDate" timestamp with time zone,
    "PaidAt" timestamp with time zone,
    "SubjectType" text NOT NULL,
    "MemberOrCompanyId" uuid NOT NULL,
    CONSTRAINT "CK_Invoices_Status" CHECK (("Status" = ANY (ARRAY['pending'::text, 'paid'::text]))),
    CONSTRAINT "CK_Invoices_SubjectType" CHECK (("SubjectType" = ANY (ARRAY['member'::text, 'company'::text])))
);


--
-- Name: ListingDailyFactors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ListingDailyFactors" (
    "ListingId" uuid NOT NULL,
    "Date" date NOT NULL,
    "SeasonFactor" numeric,
    "SpecialFactor" numeric,
    "DemandFactor" numeric DEFAULT 1.0 NOT NULL,
    "DemandScore" numeric,
    "ComputedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: Listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Listings" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "EstatePropertyId" uuid NOT NULL,
    "ListingType" public."ListingType" NOT NULL,
    "Description" character varying(1000),
    "AvailableFrom" timestamp with time zone NOT NULL,
    "Capacity" integer,
    "Currency" integer NOT NULL,
    "SalePrice" numeric,
    "RentPrice" numeric,
    "HasCommonExpenses" boolean,
    "CommonExpensesValue" numeric,
    "IsElectricityIncluded" boolean,
    "IsWaterIncluded" boolean,
    "IsPriceVisible" boolean NOT NULL,
    "Status" integer,
    "IsActive" boolean NOT NULL,
    "IsPropertyVisible" boolean NOT NULL,
    "IsFeatured" boolean DEFAULT false NOT NULL,
    "BlockedForBooking" boolean DEFAULT false NOT NULL,
    "IsDeleted" boolean DEFAULT false NOT NULL,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModifiedBy" text,
    "Title" text,
    "RentPricePeriod" public."RentPricePeriod",
    "BasePrice" numeric,
    "MinPrice" numeric,
    "MaxPrice" numeric,
    "LongStayDiscountEnabled" boolean DEFAULT false NOT NULL,
    "LongStayMinDays" integer,
    "LongStayDiscountPercentage" numeric
);


--
-- Name: COLUMN "Listings"."BasePrice"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Listings"."BasePrice" IS 'Nightly/event base for dynamic pricing (SummerRent, EventVenue).';


--
-- Name: COLUMN "Listings"."MinPrice"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Listings"."MinPrice" IS 'Floor after pricing factors.';


--
-- Name: COLUMN "Listings"."MaxPrice"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Listings"."MaxPrice" IS 'Ceiling after pricing factors.';


--
-- Name: MemberActionHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MemberActionHistory" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "MemberId" uuid NOT NULL,
    "ActionType" character varying(50) NOT NULL,
    "ActionDetails" jsonb,
    "PerformedBy" uuid NOT NULL,
    "PerformedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "IsDeleted" boolean DEFAULT false NOT NULL,
    CONSTRAINT "MemberActionHistory_ActionType_check" CHECK ((("ActionType")::text = ANY ((ARRAY['suspend'::character varying, 'reactivate'::character varying, 'role_change'::character varying, 'reset_onboarding'::character varying, 'force_logout'::character varying, 'delete'::character varying])::text[])))
);


--
-- Name: MemberForceLogout; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MemberForceLogout" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "MemberId" uuid NOT NULL,
    "ForceLogout" boolean DEFAULT false NOT NULL,
    "Reason" text,
    "RequestedBy" uuid NOT NULL,
    "RequestedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "AcknowledgedAt" timestamp with time zone,
    "IsDeleted" boolean DEFAULT false NOT NULL
);


--
-- Name: MemberOnboarding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MemberOnboarding" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "MemberId" uuid NOT NULL,
    "OnboardingStep" integer DEFAULT 0 NOT NULL,
    "IsComplete" boolean DEFAULT false NOT NULL,
    "CompletedAt" timestamp with time zone,
    "LastResetBy" uuid,
    "LastResetAt" timestamp with time zone,
    "IsDeleted" boolean DEFAULT false NOT NULL,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModifiedBy" text
);


--
-- Name: Members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Members" (
    "Id" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "FirstName" character varying(100),
    "LastName" character varying(100),
    "Title" character varying(100),
    "AvatarUrl" character varying(2048),
    "Street" character varying(255),
    "Street2" character varying(255),
    "City" character varying(100),
    "State" character varying(100),
    "PostalCode" character varying(20),
    "Country" character varying(100),
    "IsDeleted" boolean DEFAULT false NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" text,
    "Phone" character varying(50),
    "Role" text DEFAULT 'user'::text,
    "Email" character varying(255),
    twofactorenabled boolean DEFAULT false,
    "PhonePrefix" character varying(10),
    "NeedsOnboarding" boolean DEFAULT true NOT NULL,
    "EmailVerifiedAt" timestamp with time zone,
    "PhoneVerifiedAt" timestamp with time zone,
    "OnboardingStep" integer DEFAULT 0 NOT NULL,
    "OnboardingComplete" boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN "Members"."Phone"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Members"."Phone" IS 'User phone number';


--
-- Name: COLUMN "Members"."Email"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Members"."Email" IS 'User email address, synced from auth.users during signup and backfilled for existing records';


--
-- Name: COLUMN "Members".twofactorenabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Members".twofactorenabled IS 'Indicates whether the user has two-factor authentication enabled';


--
-- Name: COLUMN "Members"."PhonePrefix"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Members"."PhonePrefix" IS 'Dial code prefix for member phone numbers (e.g. +598, +55).';


--
-- Name: COLUMN "Members"."EmailVerifiedAt"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Members"."EmailVerifiedAt" IS 'When the member verified their email (e.g. after change-email flow).';


--
-- Name: COLUMN "Members"."PhoneVerifiedAt"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Members"."PhoneVerifiedAt" IS 'When the member verified their phone (e.g. after change-phone flow).';


--
-- Name: COLUMN "Members"."OnboardingStep"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Members"."OnboardingStep" IS 'Admin RPC get_admin_user_detail / reset_user_onboarding; may diverge from get_owner_onboarding_state until unified.';


--
-- Name: COLUMN "Members"."OnboardingComplete"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Members"."OnboardingComplete" IS 'Admin RPC get_admin_user_detail / reset_user_onboarding; may diverge from owner onboarding RPCs until unified.';


--
-- Name: MessageRecipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessageRecipients" (
    "Id" uuid NOT NULL,
    "MessageId" uuid NOT NULL,
    "RecipientId" uuid NOT NULL,
    "ReceivedAtUtc" timestamp with time zone NOT NULL,
    "IsRead" boolean NOT NULL,
    "HasBeenRepliedToByRecipient" boolean NOT NULL,
    "IsStarred" boolean NOT NULL,
    "IsArchived" boolean NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" text
);


--
-- Name: MessageThreads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessageThreads" (
    "Id" uuid NOT NULL,
    "Subject" character varying(255) NOT NULL,
    "PropertyId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "LastMessageAtUtc" timestamp with time zone NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" text
);


--
-- Name: Messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Messages" (
    "Id" uuid NOT NULL,
    "ThreadId" uuid NOT NULL,
    "SenderId" uuid NOT NULL,
    "Body" text NOT NULL,
    "Snippet" character varying(200) NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "InReplyToMessageId" uuid,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" text
);


--
-- Name: OwnerOnboarding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OwnerOnboarding" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "MemberId" uuid NOT NULL,
    "CurrentStep" integer DEFAULT 0 NOT NULL,
    "CompletedAt" timestamp with time zone,
    "DismissedAt" timestamp with time zone,
    "IsDeleted" boolean DEFAULT false NOT NULL,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModifiedBy" text
);


--
-- Name: TABLE "OwnerOnboarding"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."OwnerOnboarding" IS 'Tracks owner activation onboarding progress (first property publish flow).';


--
-- Name: Owners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Owners" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "OwnerType" public."OwnerType" NOT NULL,
    "MemberId" uuid,
    "CompanyId" uuid,
    "IsDeleted" boolean DEFAULT false NOT NULL,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModifiedBy" text,
    CONSTRAINT "CHK_Owners_ExclusiveOwnership" CHECK (((("OwnerType" = 'member'::public."OwnerType") AND ("MemberId" IS NOT NULL) AND ("CompanyId" IS NULL)) OR (("OwnerType" = 'company'::public."OwnerType") AND ("CompanyId" IS NOT NULL) AND ("MemberId" IS NULL))))
);


--
-- Name: TABLE "Owners"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Owners" IS 'Unified ownership table supporting both member and company ownership of properties';


--
-- Name: Plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Plans" (
    "Id" uuid NOT NULL,
    "Key" integer NOT NULL,
    "Name" character varying(200) NOT NULL,
    "MonthlyPrice" numeric NOT NULL,
    "Currency" character varying(10) NOT NULL,
    "MaxProperties" integer,
    "MaxUsers" integer,
    "MaxStorageMb" integer,
    "BillingCycle" integer NOT NULL,
    "IsActive" boolean NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" text,
    "MaxPublishedProperties" integer,
    "CommissionPercentage" numeric,
    "CommissionMinimumAmount" numeric,
    "ExtraPropertiesPrice11to30" numeric,
    "ExtraPropertiesPrice31Plus" numeric,
    "BookingReceiptMinimumAmount" numeric,
    "PropertyType" public."PropertyType",
    "PricingModel" text,
    "Price" numeric,
    "MinMonthlyFee" numeric,
    "PricePerBooking" numeric,
    "ListingLimit" integer,
    "DurationDays" integer,
    "IsActiveV2" boolean,
    "BookingLimit" integer,
    CONSTRAINT "CK_Plans_PricingModel" CHECK (("PricingModel" = ANY (ARRAY['per_booking'::text, 'per_listing'::text, 'hybrid'::text])))
);


--
-- Name: COLUMN "Plans"."BookingLimit"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Plans"."BookingLimit" IS 'Max booking UsageRecords per billing window for per_booking/hybrid; null = unlimited.';


--
-- Name: PropertyDocuments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PropertyDocuments" (
    "Id" uuid NOT NULL,
    "Name" text,
    "FileType" text,
    "Url" text,
    "EstatePropertyId" uuid NOT NULL,
    "IsPublic" boolean NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" text
);


--
-- Name: PropertyImages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PropertyImages" (
    "Id" uuid NOT NULL,
    "Url" character varying(2048) NOT NULL,
    "AltText" character varying(255),
    "IsMain" boolean NOT NULL,
    "EstatePropertyId" uuid NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" text,
    "Metadata" jsonb,
    "DisplayOrder" integer DEFAULT 0 NOT NULL
);


--
-- Name: PropertyMessageLogs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PropertyMessageLogs" (
    "Id" uuid NOT NULL,
    "PropertyId" uuid NOT NULL,
    "SentOnUtc" timestamp with time zone NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" text
);


--
-- Name: PropertyModerationActions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PropertyModerationActions" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "PropertyId" uuid NOT NULL,
    "ActionType" character varying(50) NOT NULL,
    "Reason" text,
    "PerformedBy" uuid NOT NULL,
    "PerformedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "IsDeleted" boolean DEFAULT false NOT NULL,
    CONSTRAINT "PropertyModerationActions_ActionType_check" CHECK ((("ActionType")::text = ANY ((ARRAY['hide'::character varying, 'mark_invalid'::character varying, 'mark_spam'::character varying, 'delete'::character varying])::text[])))
);


--
-- Name: PropertySearchScores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PropertySearchScores" (
    "EstatePropertyId" uuid NOT NULL,
    "ListingType" text NOT NULL,
    "ListingId" uuid,
    "Scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "Metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "ComputedAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PropertySearchScores_ListingType_check" CHECK (("ListingType" = ANY (ARRAY['SummerRent'::text, 'EventVenue'::text])))
);


--
-- Name: TABLE "PropertySearchScores"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."PropertySearchScores" IS 'Daily precomputed search ranking components per property and guest listing type.';


--
-- Name: PropertyVideos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PropertyVideos" (
    "Id" uuid NOT NULL,
    "Url" character varying(2048) NOT NULL,
    "Title" character varying(50),
    "Description" character varying(255),
    "EstatePropertyId" uuid NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" text
);


--
-- Name: PropertyVisitLogs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PropertyVisitLogs" (
    "Id" uuid NOT NULL,
    "PropertyId" uuid NOT NULL,
    "VisitedOnUtc" timestamp with time zone NOT NULL,
    "Source" character varying(50),
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" text
);


--
-- Name: RealEstateExtension; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RealEstateExtension" (
    "EstatePropertyId" uuid NOT NULL,
    "AllowsFinancing" boolean,
    "IsNewConstruction" boolean,
    "HasMortgage" boolean,
    "HOAFees" numeric,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModifiedBy" text,
    "MinContractMonths" integer,
    "RequiresGuarantee" boolean,
    "GuaranteeType" text,
    "AllowsPets" boolean,
    "Category" public."PropertyCategory"
);


--
-- Name: RecoveryCodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RecoveryCodes" (
    "RecoveryCodeId" uuid NOT NULL,
    "Code" text NOT NULL,
    "UserId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UsedAt" timestamp with time zone
);


--
-- Name: Reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Reviews" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "BookingId" uuid NOT NULL,
    "GuestId" uuid NOT NULL,
    "EstatePropertyId" uuid NOT NULL,
    "Rating" integer NOT NULL,
    "Comment" text,
    "CreatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "ListingType" public."ListingType",
    "LastModified" timestamp with time zone,
    CONSTRAINT "CHK_Reviews_Rating" CHECK ((("Rating" >= 1) AND ("Rating" <= 5)))
);


--
-- Name: TABLE "Reviews"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Reviews" IS 'One review per booking. GuestId references Members.Id or Guests.Id. ListingType scopes reviews per property modality (guest sites: RealEstate, SummerRent, EventVenue).';


--
-- Name: COLUMN "Reviews"."LastModified"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Reviews"."LastModified" IS 'Set when a guest or member updates an existing review; null until first edit.';


--
-- Name: SummerRentExtension; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SummerRentExtension" (
    "EstatePropertyId" uuid NOT NULL,
    "MinStayDays" integer,
    "MaxStayDays" integer,
    "LeadTimeDays" integer,
    "BufferDays" integer,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModifiedBy" text,
    "ICalExportToken" uuid DEFAULT gen_random_uuid()
);


--
-- Name: SyncJobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SyncJobs" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "CalendarIntegrationId" uuid NOT NULL,
    "JobType" integer DEFAULT 0 NOT NULL,
    "Status" integer DEFAULT 0 NOT NULL,
    "StartedAt" timestamp with time zone,
    "CompletedAt" timestamp with time zone,
    "Error" text,
    "EventsProcessed" integer DEFAULT 0,
    "IsDeleted" boolean DEFAULT false NOT NULL,
    "Created" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "LastModified" timestamp with time zone DEFAULT now() NOT NULL,
    "LastModifiedBy" text,
    CONSTRAINT "CHK_SyncJobs_JobType" CHECK (("JobType" = ANY (ARRAY[0, 1, 2]))),
    CONSTRAINT "CHK_SyncJobs_Status" CHECK (("Status" = ANY (ARRAY[0, 1, 2, 3])))
);


--
-- Name: UsageRecords; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UsageRecords" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "Type" text NOT NULL,
    "ReferenceId" text NOT NULL,
    "Amount" numeric DEFAULT 0,
    "CreatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "CreatedBy" text,
    "InvoiceId" uuid,
    "SubjectType" text NOT NULL,
    "MemberOrCompanyId" uuid NOT NULL,
    CONSTRAINT "CK_UsageRecords_SubjectType" CHECK (("SubjectType" = ANY (ARRAY['member'::text, 'company'::text]))),
    CONSTRAINT "CK_UsageRecords_Type" CHECK (("Type" = ANY (ARRAY['booking'::text, 'listing'::text])))
);


--
-- Name: UserApps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserApps" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "UserId" uuid NOT NULL,
    "AppName" text NOT NULL,
    "CreatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE "UserApps"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."UserApps" IS 'Tracks which platform apps (rentals_app, admin_app, venues_app) a user has used for first-time messaging.';


--
-- Name: COLUMN "UserApps"."AppName"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."UserApps"."AppName" IS 'One of: rentals_app, admin_app, venues_app';


--
-- Name: VerificationCodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationCodes" (
    "Id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "UserId" uuid NOT NULL,
    "Email" text,
    "Phone" text,
    "Code" text NOT NULL,
    "Type" text NOT NULL,
    "ExpiresAt" timestamp with time zone NOT NULL,
    "CreatedAt" timestamp with time zone DEFAULT now(),
    "UsedAt" timestamp with time zone,
    CONSTRAINT "CK_VerificationCodes_Type" CHECK (("Type" = ANY (ARRAY['email_change'::text, 'phone_change'::text])))
);


--
-- Name: TABLE "VerificationCodes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."VerificationCodes" IS 'Stores verification codes for email and phone changes';


--
-- Name: COLUMN "VerificationCodes"."UserId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."VerificationCodes"."UserId" IS 'Reference to the user who requested the verification';


--
-- Name: COLUMN "VerificationCodes"."Email"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."VerificationCodes"."Email" IS 'New email address to be verified (for email_change type)';


--
-- Name: COLUMN "VerificationCodes"."Phone"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."VerificationCodes"."Phone" IS 'New phone number to be verified (for phone_change type)';


--
-- Name: COLUMN "VerificationCodes"."Code"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."VerificationCodes"."Code" IS 'The verification code';


--
-- Name: COLUMN "VerificationCodes"."Type"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."VerificationCodes"."Type" IS 'Type of verification (email_change or phone_change)';


--
-- Name: COLUMN "VerificationCodes"."ExpiresAt"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."VerificationCodes"."ExpiresAt" IS 'When the code expires';


--
-- Name: COLUMN "VerificationCodes"."UsedAt"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."VerificationCodes"."UsedAt" IS 'When the code was used';


--
-- Name: WebhookEvents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WebhookEvents" (
    "Id" uuid NOT NULL,
    "ProviderEventId" character varying(255) NOT NULL,
    "EventType" character varying(100) NOT NULL,
    "Processed" boolean NOT NULL,
    "ProcessedAt" timestamp with time zone,
    "Created" timestamp with time zone NOT NULL,
    "IsDeleted" boolean NOT NULL
);


--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_name text NOT NULL,
    property_id text,
    user_id text,
    session_id text NOT NULL,
    source text,
    medium text,
    revenue numeric,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_holds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_holds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    check_in date NOT NULL,
    check_out date NOT NULL,
    guests integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:10:00'::interval) NOT NULL,
    full_name text,
    email text,
    phone text,
    document_id text,
    otp_verified_at timestamp with time zone,
    ip_hash text,
    idempotency_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    estimated_guests integer,
    listing_type text,
    CONSTRAINT booking_holds_guests_check CHECK ((guests > 0)),
    CONSTRAINT booking_holds_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'expired'::text, 'released'::text])))
);


--
-- Name: COLUMN booking_holds.listing_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_holds.listing_type IS 'Site listing modality when the hold was created (RealEstate, SummerRent, or EventVenue). Required for guest review lookup when Bookings.ListingType is unset.';


--
-- Name: booking_manage_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_manage_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    key text NOT NULL,
    hits integer DEFAULT 1 NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL,
    window_end timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: otp_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    key text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    hits integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT otp_rate_limits_hits_check CHECK ((hits >= 0)),
    CONSTRAINT otp_rate_limits_scope_check CHECK ((scope = ANY (ARRAY['phone'::text, 'ip'::text])))
);


--
-- Name: otp_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hold_id uuid,
    phone text NOT NULL,
    otp_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    request_ip text,
    provider text DEFAULT 'meta'::text NOT NULL,
    whatsapp_message_id text,
    whatsapp_status text DEFAULT 'pending'::text NOT NULL,
    sms_status text DEFAULT 'not_sent'::text NOT NULL,
    fallback_required_at timestamp with time zone,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT otp_requests_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT otp_requests_max_attempts_check CHECK (((max_attempts >= 3) AND (max_attempts <= 5)))
);


--
-- Name: propertydetailssection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.propertydetailssection (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    propertyid uuid NOT NULL,
    name text NOT NULL,
    description text,
    layouttype text DEFAULT 'split'::text NOT NULL,
    layoutconfig jsonb,
    displayorder integer DEFAULT 0 NOT NULL,
    isdeleted boolean DEFAULT false NOT NULL,
    createdat timestamp with time zone DEFAULT now() NOT NULL,
    updatedat timestamp with time zone DEFAULT now() NOT NULL,
    localizedname jsonb DEFAULT '{}'::jsonb NOT NULL,
    localizeddescription jsonb DEFAULT '{}'::jsonb NOT NULL,
    propertytype public."PropertyType",
    CONSTRAINT propertydetailssection_layouttype_check CHECK ((layouttype = ANY (ARRAY['split'::text, 'carousel'::text, 'stacked'::text]))),
    CONSTRAINT propertydetailssection_localizeddescription_check CHECK (public.is_valid_localized_text_json(localizeddescription)),
    CONSTRAINT propertydetailssection_localizedname_check CHECK (public.is_valid_localized_text_json(localizedname))
);


--
-- Name: propertysectionimages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.propertysectionimages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sectionid uuid NOT NULL,
    propertyimageid uuid NOT NULL,
    displayorder integer DEFAULT 0 NOT NULL,
    createdat timestamp with time zone DEFAULT now() NOT NULL,
    updatedat timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: AppParameters AppParameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AppParameters"
    ADD CONSTRAINT "AppParameters_pkey" PRIMARY KEY ("Id");


--
-- Name: BillingCycles BillingCycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BillingCycles"
    ADD CONSTRAINT "BillingCycles_pkey" PRIMARY KEY ("Id");


--
-- Name: BillingPlanAssignments BillingPlanAssignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BillingPlanAssignments"
    ADD CONSTRAINT "BillingPlanAssignments_pkey" PRIMARY KEY ("Id");


--
-- Name: EstatePropertyPolicy EstatePropertyPolicy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EstatePropertyPolicy"
    ADD CONSTRAINT "EstatePropertyPolicy_pkey" PRIMARY KEY ("Id");


--
-- Name: EventVenueExtension EventVenueExtension_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EventVenueExtension"
    ADD CONSTRAINT "EventVenueExtension_pkey" PRIMARY KEY ("EstatePropertyId");


--
-- Name: ForceLogoutRequests ForceLogoutRequests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ForceLogoutRequests"
    ADD CONSTRAINT "ForceLogoutRequests_pkey" PRIMARY KEY ("Id");


--
-- Name: Invoices Invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoices"
    ADD CONSTRAINT "Invoices_pkey" PRIMARY KEY ("Id");


--
-- Name: ListingDailyFactors ListingDailyFactors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ListingDailyFactors"
    ADD CONSTRAINT "ListingDailyFactors_pkey" PRIMARY KEY ("ListingId", "Date");


--
-- Name: Listings Listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Listings"
    ADD CONSTRAINT "Listings_pkey" PRIMARY KEY ("Id");


--
-- Name: Amenities PK_Amenities; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Amenities"
    ADD CONSTRAINT "PK_Amenities" PRIMARY KEY ("Id");


--
-- Name: AuthEmailChangeRequests PK_AuthEmailChangeRequests; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuthEmailChangeRequests"
    ADD CONSTRAINT "PK_AuthEmailChangeRequests" PRIMARY KEY ("Id");


--
-- Name: AvailabilityBlocks PK_AvailabilityBlocks; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AvailabilityBlocks"
    ADD CONSTRAINT "PK_AvailabilityBlocks" PRIMARY KEY ("Id");


--
-- Name: Bookings PK_Bookings; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bookings"
    ADD CONSTRAINT "PK_Bookings" PRIMARY KEY ("Id");


--
-- Name: CalendarIntegrations PK_CalendarIntegrations; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CalendarIntegrations"
    ADD CONSTRAINT "PK_CalendarIntegrations" PRIMARY KEY ("Id");


--
-- Name: Companies PK_Companies; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Companies"
    ADD CONSTRAINT "PK_Companies" PRIMARY KEY ("Id");


--
-- Name: EstateProperties PK_EstateProperties; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EstateProperties"
    ADD CONSTRAINT "PK_EstateProperties" PRIMARY KEY ("Id");


--
-- Name: EstatePropertyAmenity PK_EstatePropertyAmenity; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EstatePropertyAmenity"
    ADD CONSTRAINT "PK_EstatePropertyAmenity" PRIMARY KEY ("EstatePropertyId", "AmenityId");


--
-- Name: ExternalCalendarEvents PK_ExternalCalendarEvents; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExternalCalendarEvents"
    ADD CONSTRAINT "PK_ExternalCalendarEvents" PRIMARY KEY ("Id");


--
-- Name: Favorites PK_Favorites; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Favorites"
    ADD CONSTRAINT "PK_Favorites" PRIMARY KEY ("MemberId", "EstatePropertyId");


--
-- Name: Guests PK_Guests; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Guests"
    ADD CONSTRAINT "PK_Guests" PRIMARY KEY ("Id");


--
-- Name: MemberActionHistory PK_MemberActionHistory; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MemberActionHistory"
    ADD CONSTRAINT "PK_MemberActionHistory" PRIMARY KEY ("Id");


--
-- Name: MemberForceLogout PK_MemberForceLogout; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MemberForceLogout"
    ADD CONSTRAINT "PK_MemberForceLogout" PRIMARY KEY ("Id");


--
-- Name: MemberOnboarding PK_MemberOnboarding; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MemberOnboarding"
    ADD CONSTRAINT "PK_MemberOnboarding" PRIMARY KEY ("Id");


--
-- Name: Members PK_Members; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Members"
    ADD CONSTRAINT "PK_Members" PRIMARY KEY ("Id");


--
-- Name: MessageRecipients PK_MessageRecipients; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageRecipients"
    ADD CONSTRAINT "PK_MessageRecipients" PRIMARY KEY ("Id");


--
-- Name: MessageThreads PK_MessageThreads; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageThreads"
    ADD CONSTRAINT "PK_MessageThreads" PRIMARY KEY ("Id");


--
-- Name: Messages PK_Messages; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Messages"
    ADD CONSTRAINT "PK_Messages" PRIMARY KEY ("Id");


--
-- Name: OwnerOnboarding PK_OwnerOnboarding; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OwnerOnboarding"
    ADD CONSTRAINT "PK_OwnerOnboarding" PRIMARY KEY ("Id");


--
-- Name: Owners PK_Owners; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Owners"
    ADD CONSTRAINT "PK_Owners" PRIMARY KEY ("Id");


--
-- Name: Plans PK_Plans; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Plans"
    ADD CONSTRAINT "PK_Plans" PRIMARY KEY ("Id");


--
-- Name: PropertyDocuments PK_PropertyDocuments; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertyDocuments"
    ADD CONSTRAINT "PK_PropertyDocuments" PRIMARY KEY ("Id");


--
-- Name: PropertyImages PK_PropertyImages; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertyImages"
    ADD CONSTRAINT "PK_PropertyImages" PRIMARY KEY ("Id");


--
-- Name: PropertyMessageLogs PK_PropertyMessageLogs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertyMessageLogs"
    ADD CONSTRAINT "PK_PropertyMessageLogs" PRIMARY KEY ("Id");


--
-- Name: PropertyModerationActions PK_PropertyModerationActions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertyModerationActions"
    ADD CONSTRAINT "PK_PropertyModerationActions" PRIMARY KEY ("Id");


--
-- Name: PropertyVideos PK_PropertyVideos; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertyVideos"
    ADD CONSTRAINT "PK_PropertyVideos" PRIMARY KEY ("Id");


--
-- Name: PropertyVisitLogs PK_PropertyVisitLogs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertyVisitLogs"
    ADD CONSTRAINT "PK_PropertyVisitLogs" PRIMARY KEY ("Id");


--
-- Name: RecoveryCodes PK_RecoveryCodes; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecoveryCodes"
    ADD CONSTRAINT "PK_RecoveryCodes" PRIMARY KEY ("RecoveryCodeId");


--
-- Name: Reviews PK_Reviews; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reviews"
    ADD CONSTRAINT "PK_Reviews" PRIMARY KEY ("Id");


--
-- Name: SyncJobs PK_SyncJobs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SyncJobs"
    ADD CONSTRAINT "PK_SyncJobs" PRIMARY KEY ("Id");


--
-- Name: UserApps PK_UserApps; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserApps"
    ADD CONSTRAINT "PK_UserApps" PRIMARY KEY ("Id");


--
-- Name: CompanyMembers PK_UserCompanies; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompanyMembers"
    ADD CONSTRAINT "PK_UserCompanies" PRIMARY KEY ("Id");


--
-- Name: VerificationCodes PK_VerificationCodes; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationCodes"
    ADD CONSTRAINT "PK_VerificationCodes" PRIMARY KEY ("Id");


--
-- Name: WebhookEvents PK_WebhookEvents; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WebhookEvents"
    ADD CONSTRAINT "PK_WebhookEvents" PRIMARY KEY ("Id");


--
-- Name: PropertySearchScores PropertySearchScores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertySearchScores"
    ADD CONSTRAINT "PropertySearchScores_pkey" PRIMARY KEY ("EstatePropertyId", "ListingType");


--
-- Name: RealEstateExtension RealEstateExtension_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RealEstateExtension"
    ADD CONSTRAINT "RealEstateExtension_pkey" PRIMARY KEY ("EstatePropertyId");


--
-- Name: SummerRentExtension SummerRentExtension_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SummerRentExtension"
    ADD CONSTRAINT "SummerRentExtension_pkey" PRIMARY KEY ("EstatePropertyId");


--
-- Name: CalendarIntegrations UQ_CalendarIntegrations_Property_Platform; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CalendarIntegrations"
    ADD CONSTRAINT "UQ_CalendarIntegrations_Property_Platform" UNIQUE ("EstatePropertyId", "PlatformType", "ExternalCalendarId");


--
-- Name: ExternalCalendarEvents UQ_ExternalCalendarEvents_Integration_EventId; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExternalCalendarEvents"
    ADD CONSTRAINT "UQ_ExternalCalendarEvents_Integration_EventId" UNIQUE ("CalendarIntegrationId", "ExternalEventId");


--
-- Name: Reviews UQ_Reviews_BookingId; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reviews"
    ADD CONSTRAINT "UQ_Reviews_BookingId" UNIQUE ("BookingId");


--
-- Name: UserApps UQ_UserApps_UserId_AppName; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserApps"
    ADD CONSTRAINT "UQ_UserApps_UserId_AppName" UNIQUE ("UserId", "AppName");


--
-- Name: AppParameters UX_AppParameters_Name_SiteScope; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AppParameters"
    ADD CONSTRAINT "UX_AppParameters_Name_SiteScope" UNIQUE ("Name", "SiteScope");


--
-- Name: UsageRecords UsageRecords_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsageRecords"
    ADD CONSTRAINT "UsageRecords_pkey" PRIMARY KEY ("Id");


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: booking_holds booking_holds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_holds
    ADD CONSTRAINT booking_holds_pkey PRIMARY KEY (id);


--
-- Name: booking_manage_tokens booking_manage_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_manage_tokens
    ADD CONSTRAINT booking_manage_tokens_pkey PRIMARY KEY (id);


--
-- Name: booking_manage_tokens booking_manage_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_manage_tokens
    ADD CONSTRAINT booking_manage_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: booking_rate_limits booking_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_rate_limits
    ADD CONSTRAINT booking_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: otp_rate_limits otp_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_rate_limits
    ADD CONSTRAINT otp_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: otp_rate_limits otp_rate_limits_scope_key_window_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_rate_limits
    ADD CONSTRAINT otp_rate_limits_scope_key_window_start_key UNIQUE (scope, key, window_start);


--
-- Name: otp_requests otp_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_requests
    ADD CONSTRAINT otp_requests_pkey PRIMARY KEY (id);


--
-- Name: propertydetailssection propertydetailssection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propertydetailssection
    ADD CONSTRAINT propertydetailssection_pkey PRIMARY KEY (id);


--
-- Name: propertysectionimages propertysectionimages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propertysectionimages
    ADD CONSTRAINT propertysectionimages_pkey PRIMARY KEY (id);


--
-- Name: propertysectionimages propertysectionimages_sectionid_propertyimageid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propertysectionimages
    ADD CONSTRAINT propertysectionimages_sectionid_propertyimageid_key UNIQUE (sectionid, propertyimageid);


--
-- Name: IX_Amenities_PropertyType; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Amenities_PropertyType" ON public."Amenities" USING btree ("PropertyType");


--
-- Name: IX_AppParameters_SiteScope_Active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_AppParameters_SiteScope_Active" ON public."AppParameters" USING btree ("SiteScope", "IsActive") WHERE ("IsDeleted" = false);


--
-- Name: IX_AuthEmailChangeRequests_UserId_Active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_AuthEmailChangeRequests_UserId_Active" ON public."AuthEmailChangeRequests" USING btree ("UserId") WHERE ("ConsumedAt" IS NULL);


--
-- Name: IX_AvailabilityBlocks_DateRange; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_AvailabilityBlocks_DateRange" ON public."AvailabilityBlocks" USING gist (tstzrange("StartDate", "EndDate"));


--
-- Name: IX_AvailabilityBlocks_EndDate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_AvailabilityBlocks_EndDate" ON public."AvailabilityBlocks" USING btree ("EndDate");


--
-- Name: IX_AvailabilityBlocks_EstatePropertyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_AvailabilityBlocks_EstatePropertyId" ON public."AvailabilityBlocks" USING btree ("EstatePropertyId");


--
-- Name: IX_AvailabilityBlocks_IsAvailable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_AvailabilityBlocks_IsAvailable" ON public."AvailabilityBlocks" USING btree ("IsAvailable");


--
-- Name: IX_AvailabilityBlocks_PropertyId_Source_Dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_AvailabilityBlocks_PropertyId_Source_Dates" ON public."AvailabilityBlocks" USING btree ("EstatePropertyId", "Source", "StartDate", "EndDate") WHERE ("IsDeleted" = false);


--
-- Name: IX_AvailabilityBlocks_StartDate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_AvailabilityBlocks_StartDate" ON public."AvailabilityBlocks" USING btree ("StartDate");


--
-- Name: IX_BillingCycles_Start_End; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_BillingCycles_Start_End" ON public."BillingCycles" USING btree ("StartDate", "EndDate");


--
-- Name: IX_BillingCycles_Subject_Status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_BillingCycles_Subject_Status" ON public."BillingCycles" USING btree ("SubjectType", "MemberOrCompanyId", "Status");


--
-- Name: IX_BillingPlanAssignments_PlanId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_BillingPlanAssignments_PlanId" ON public."BillingPlanAssignments" USING btree ("PlanId");


--
-- Name: IX_BillingPlanAssignments_Subject_IsActive; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_BillingPlanAssignments_Subject_IsActive" ON public."BillingPlanAssignments" USING btree ("SubjectType", "MemberOrCompanyId", "IsActive");


--
-- Name: IX_Bookings_CheckInDate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Bookings_CheckInDate" ON public."Bookings" USING btree ("CheckInDate");


--
-- Name: IX_Bookings_CheckOutDate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Bookings_CheckOutDate" ON public."Bookings" USING btree ("CheckOutDate");


--
-- Name: IX_Bookings_DateRange; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Bookings_DateRange" ON public."Bookings" USING gist (daterange("CheckInDate", "CheckOutDate"));


--
-- Name: IX_Bookings_EstatePropertyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Bookings_EstatePropertyId" ON public."Bookings" USING btree ("EstatePropertyId");


--
-- Name: IX_Bookings_GuestId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Bookings_GuestId" ON public."Bookings" USING btree ("GuestId");


--
-- Name: IX_Bookings_HasConflict; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Bookings_HasConflict" ON public."Bookings" USING btree ("HasConflict");


--
-- Name: IX_Bookings_ReservationCode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Bookings_ReservationCode" ON public."Bookings" USING btree ("ReservationCode") WHERE ("IsDeleted" = false);


--
-- Name: IX_Bookings_Status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Bookings_Status" ON public."Bookings" USING btree ("Status");


--
-- Name: IX_Bookings_ValidationStatus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Bookings_ValidationStatus" ON public."Bookings" USING btree ("ValidationStatus");


--
-- Name: IX_CalendarIntegrations_EstatePropertyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_CalendarIntegrations_EstatePropertyId" ON public."CalendarIntegrations" USING btree ("EstatePropertyId");


--
-- Name: IX_CalendarIntegrations_ICalUrl; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_CalendarIntegrations_ICalUrl" ON public."CalendarIntegrations" USING btree ("ICalUrl") WHERE ("ICalUrl" IS NOT NULL);


--
-- Name: IX_CalendarIntegrations_IsActive; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_CalendarIntegrations_IsActive" ON public."CalendarIntegrations" USING btree ("IsActive");


--
-- Name: IX_CalendarIntegrations_LastSyncAt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_CalendarIntegrations_LastSyncAt" ON public."CalendarIntegrations" USING btree ("LastSyncAt");


--
-- Name: IX_CalendarIntegrations_PlatformType; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_CalendarIntegrations_PlatformType" ON public."CalendarIntegrations" USING btree ("PlatformType");


--
-- Name: IX_CalendarIntegrations_Platform_Active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_CalendarIntegrations_Platform_Active" ON public."CalendarIntegrations" USING btree ("PlatformType", "IsActive", "LastSyncAt") WHERE ("IsDeleted" = false);


--
-- Name: IX_Companies_BillingContactUserId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Companies_BillingContactUserId" ON public."Companies" USING btree ("BillingContactUserId");


--
-- Name: IX_Companies_Name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Companies_Name" ON public."Companies" USING btree ("Name");


--
-- Name: IX_EstateProperties_OwnerId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_EstateProperties_OwnerId" ON public."EstateProperties" USING btree ("OwnerId");


--
-- Name: IX_EstatePropertyAmenity_AmenityId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_EstatePropertyAmenity_AmenityId" ON public."EstatePropertyAmenity" USING btree ("AmenityId");


--
-- Name: IX_ExternalCalendarEvents_CalendarIntegrationId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_ExternalCalendarEvents_CalendarIntegrationId" ON public."ExternalCalendarEvents" USING btree ("CalendarIntegrationId");


--
-- Name: IX_ExternalCalendarEvents_DateRange; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_ExternalCalendarEvents_DateRange" ON public."ExternalCalendarEvents" USING gist (tstzrange("StartDate", "EndDate"));


--
-- Name: IX_ExternalCalendarEvents_EndDate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_ExternalCalendarEvents_EndDate" ON public."ExternalCalendarEvents" USING btree ("EndDate");


--
-- Name: IX_ExternalCalendarEvents_Integration_LastModified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_ExternalCalendarEvents_Integration_LastModified" ON public."ExternalCalendarEvents" USING btree ("CalendarIntegrationId", "LastModified") WHERE ("IsDeleted" = false);


--
-- Name: IX_ExternalCalendarEvents_LastSyncedAt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_ExternalCalendarEvents_LastSyncedAt" ON public."ExternalCalendarEvents" USING btree ("LastSyncedAt");


--
-- Name: IX_ExternalCalendarEvents_StartDate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_ExternalCalendarEvents_StartDate" ON public."ExternalCalendarEvents" USING btree ("StartDate");


--
-- Name: IX_Favorites_EstatePropertyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Favorites_EstatePropertyId" ON public."Favorites" USING btree ("EstatePropertyId");


--
-- Name: IX_Favorites_MemberId_EstatePropertyId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_Favorites_MemberId_EstatePropertyId" ON public."Favorites" USING btree ("MemberId", "EstatePropertyId");


--
-- Name: IX_Invoices_Subject_Status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Invoices_Subject_Status" ON public."Invoices" USING btree ("SubjectType", "MemberOrCompanyId", "Status");


--
-- Name: IX_ListingDailyFactors_Date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_ListingDailyFactors_Date" ON public."ListingDailyFactors" USING btree ("Date");


--
-- Name: IX_Listings_EstatePropertyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Listings_EstatePropertyId" ON public."Listings" USING btree ("EstatePropertyId");


--
-- Name: IX_Listings_VisibleActive; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Listings_VisibleActive" ON public."Listings" USING btree ("EstatePropertyId", "ListingType") WHERE (("IsActive" = true) AND ("IsDeleted" = false) AND ("IsPropertyVisible" = true));


--
-- Name: IX_MemberActionHistory_ActionType; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_MemberActionHistory_ActionType" ON public."MemberActionHistory" USING btree ("ActionType");


--
-- Name: IX_MemberActionHistory_MemberId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_MemberActionHistory_MemberId" ON public."MemberActionHistory" USING btree ("MemberId");


--
-- Name: IX_MemberActionHistory_PerformedAt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_MemberActionHistory_PerformedAt" ON public."MemberActionHistory" USING btree ("PerformedAt");


--
-- Name: IX_MemberForceLogout_ForceLogout; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_MemberForceLogout_ForceLogout" ON public."MemberForceLogout" USING btree ("ForceLogout");


--
-- Name: IX_MemberForceLogout_MemberId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_MemberForceLogout_MemberId" ON public."MemberForceLogout" USING btree ("MemberId");


--
-- Name: IX_MemberOnboarding_MemberId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_MemberOnboarding_MemberId" ON public."MemberOnboarding" USING btree ("MemberId");


--
-- Name: IX_Members_UserId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_Members_UserId" ON public."Members" USING btree ("UserId");


--
-- Name: IX_MessageRecipients_MessageId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_MessageRecipients_MessageId" ON public."MessageRecipients" USING btree ("MessageId");


--
-- Name: IX_MessageRecipients_RecipientId_IsRead_IsArchived_IsDeleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_MessageRecipients_RecipientId_IsRead_IsArchived_IsDeleted" ON public."MessageRecipients" USING btree ("RecipientId", "IsRead", "IsArchived", "IsDeleted");


--
-- Name: IX_MessageRecipients_RecipientId_IsStarred_IsDeleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_MessageRecipients_RecipientId_IsStarred_IsDeleted" ON public."MessageRecipients" USING btree ("RecipientId", "IsStarred", "IsDeleted");


--
-- Name: IX_MessageThreads_LastMessageAtUtc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_MessageThreads_LastMessageAtUtc" ON public."MessageThreads" USING btree ("LastMessageAtUtc");


--
-- Name: IX_MessageThreads_PropertyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_MessageThreads_PropertyId" ON public."MessageThreads" USING btree ("PropertyId");


--
-- Name: IX_Messages_CreatedAtUtc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Messages_CreatedAtUtc" ON public."Messages" USING btree ("CreatedAtUtc");


--
-- Name: IX_Messages_InReplyToMessageId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Messages_InReplyToMessageId" ON public."Messages" USING btree ("InReplyToMessageId");


--
-- Name: IX_Messages_SenderId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Messages_SenderId" ON public."Messages" USING btree ("SenderId");


--
-- Name: IX_Messages_ThreadId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Messages_ThreadId" ON public."Messages" USING btree ("ThreadId");


--
-- Name: IX_OwnerOnboarding_CurrentStep; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_OwnerOnboarding_CurrentStep" ON public."OwnerOnboarding" USING btree ("CurrentStep");


--
-- Name: IX_OwnerOnboarding_MemberId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_OwnerOnboarding_MemberId" ON public."OwnerOnboarding" USING btree ("MemberId");


--
-- Name: IX_Owners_CompanyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Owners_CompanyId" ON public."Owners" USING btree ("CompanyId");


--
-- Name: IX_Owners_MemberId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Owners_MemberId" ON public."Owners" USING btree ("MemberId");


--
-- Name: IX_Owners_OwnerType; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Owners_OwnerType" ON public."Owners" USING btree ("OwnerType");


--
-- Name: IX_Plans_IsActive; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Plans_IsActive" ON public."Plans" USING btree ("IsActive");


--
-- Name: IX_Plans_Key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Plans_Key" ON public."Plans" USING btree ("Key");


--
-- Name: IX_PropertyDocuments_EstatePropertyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PropertyDocuments_EstatePropertyId" ON public."PropertyDocuments" USING btree ("EstatePropertyId");


--
-- Name: IX_PropertyImages_EstatePropertyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PropertyImages_EstatePropertyId" ON public."PropertyImages" USING btree ("EstatePropertyId");


--
-- Name: IX_PropertyMessageLogs_PropertyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PropertyMessageLogs_PropertyId" ON public."PropertyMessageLogs" USING btree ("PropertyId");


--
-- Name: IX_PropertyMessageLogs_SentOnUtc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PropertyMessageLogs_SentOnUtc" ON public."PropertyMessageLogs" USING btree ("SentOnUtc");


--
-- Name: IX_PropertyModerationActions_PerformedAt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PropertyModerationActions_PerformedAt" ON public."PropertyModerationActions" USING btree ("PerformedAt");


--
-- Name: IX_PropertyModerationActions_PerformedBy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PropertyModerationActions_PerformedBy" ON public."PropertyModerationActions" USING btree ("PerformedBy");


--
-- Name: IX_PropertyModerationActions_PropertyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PropertyModerationActions_PropertyId" ON public."PropertyModerationActions" USING btree ("PropertyId");


--
-- Name: IX_PropertySearchScores_ComputedAt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PropertySearchScores_ComputedAt" ON public."PropertySearchScores" USING btree ("ComputedAt" DESC);


--
-- Name: IX_PropertySearchScores_ListingType; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PropertySearchScores_ListingType" ON public."PropertySearchScores" USING btree ("ListingType");


--
-- Name: IX_PropertyVideos_EstatePropertyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PropertyVideos_EstatePropertyId" ON public."PropertyVideos" USING btree ("EstatePropertyId");


--
-- Name: IX_PropertyVisitLogs_PropertyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PropertyVisitLogs_PropertyId" ON public."PropertyVisitLogs" USING btree ("PropertyId");


--
-- Name: IX_PropertyVisitLogs_VisitedOnUtc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PropertyVisitLogs_VisitedOnUtc" ON public."PropertyVisitLogs" USING btree ("VisitedOnUtc");


--
-- Name: IX_RecoveryCodes_Code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_RecoveryCodes_Code" ON public."RecoveryCodes" USING btree ("Code");


--
-- Name: IX_RecoveryCodes_UserId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_RecoveryCodes_UserId" ON public."RecoveryCodes" USING btree ("UserId");


--
-- Name: IX_Reviews_BookingId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Reviews_BookingId" ON public."Reviews" USING btree ("BookingId");


--
-- Name: IX_Reviews_CreatedAt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Reviews_CreatedAt" ON public."Reviews" USING btree ("CreatedAt" DESC);


--
-- Name: IX_Reviews_EstatePropertyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Reviews_EstatePropertyId" ON public."Reviews" USING btree ("EstatePropertyId");


--
-- Name: IX_Reviews_EstatePropertyId_ListingType; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Reviews_EstatePropertyId_ListingType" ON public."Reviews" USING btree ("EstatePropertyId", "ListingType") WHERE ("ListingType" IS NOT NULL);


--
-- Name: IX_Reviews_GuestId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Reviews_GuestId" ON public."Reviews" USING btree ("GuestId");


--
-- Name: IX_SyncJobs_CalendarIntegrationId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_SyncJobs_CalendarIntegrationId" ON public."SyncJobs" USING btree ("CalendarIntegrationId");


--
-- Name: IX_SyncJobs_Created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_SyncJobs_Created" ON public."SyncJobs" USING btree ("Created");


--
-- Name: IX_SyncJobs_Integration_Status_Created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_SyncJobs_Integration_Status_Created" ON public."SyncJobs" USING btree ("CalendarIntegrationId", "Status", "Created");


--
-- Name: IX_SyncJobs_JobType; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_SyncJobs_JobType" ON public."SyncJobs" USING btree ("JobType");


--
-- Name: IX_SyncJobs_StartedAt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_SyncJobs_StartedAt" ON public."SyncJobs" USING btree ("StartedAt");


--
-- Name: IX_SyncJobs_Status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_SyncJobs_Status" ON public."SyncJobs" USING btree ("Status");


--
-- Name: IX_UsageRecords_InvoiceId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_UsageRecords_InvoiceId" ON public."UsageRecords" USING btree ("InvoiceId");


--
-- Name: IX_UsageRecords_Subject_CreatedAt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_UsageRecords_Subject_CreatedAt" ON public."UsageRecords" USING btree ("SubjectType", "MemberOrCompanyId", "CreatedAt");


--
-- Name: IX_UsageRecords_Subject_Invoice_CreatedAt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_UsageRecords_Subject_Invoice_CreatedAt" ON public."UsageRecords" USING btree ("SubjectType", "MemberOrCompanyId", "InvoiceId", "CreatedAt");


--
-- Name: IX_UserApps_UserId_AppName; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_UserApps_UserId_AppName" ON public."UserApps" USING btree ("UserId", "AppName");


--
-- Name: IX_UserCompanies_CompanyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_UserCompanies_CompanyId" ON public."CompanyMembers" USING btree ("CompanyId");


--
-- Name: IX_UserCompanies_MemberId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_UserCompanies_MemberId" ON public."CompanyMembers" USING btree ("MemberId");


--
-- Name: IX_UserCompanies_MemberId_CompanyId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_UserCompanies_MemberId_CompanyId" ON public."CompanyMembers" USING btree ("MemberId", "CompanyId");


--
-- Name: IX_VerificationCodes_ExpiresAt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_VerificationCodes_ExpiresAt" ON public."VerificationCodes" USING btree ("ExpiresAt");


--
-- Name: IX_VerificationCodes_Type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_VerificationCodes_Type" ON public."VerificationCodes" USING btree ("Type");


--
-- Name: IX_VerificationCodes_UserId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_VerificationCodes_UserId" ON public."VerificationCodes" USING btree ("UserId");


--
-- Name: IX_WebhookEvents_EventType; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_WebhookEvents_EventType" ON public."WebhookEvents" USING btree ("EventType");


--
-- Name: IX_WebhookEvents_Processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_WebhookEvents_Processed" ON public."WebhookEvents" USING btree ("Processed");


--
-- Name: IX_WebhookEvents_ProviderEventId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_WebhookEvents_ProviderEventId" ON public."WebhookEvents" USING btree ("ProviderEventId");


--
-- Name: UX_BillingPlanAssignments_Active_Subject; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UX_BillingPlanAssignments_Active_Subject" ON public."BillingPlanAssignments" USING btree ("SubjectType", "MemberOrCompanyId") WHERE ("IsActive" = true);


--
-- Name: UX_Bookings_ReservationCode_Active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UX_Bookings_ReservationCode_Active" ON public."Bookings" USING btree ("ReservationCode") WHERE (("IsDeleted" = false) AND ("ReservationCode" IS NOT NULL));


--
-- Name: UX_Guests_Email_Normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UX_Guests_Email_Normalized" ON public."Guests" USING btree (lower(TRIM(BOTH FROM "Email")));


--
-- Name: UX_Invoices_BillingCycleId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UX_Invoices_BillingCycleId" ON public."Invoices" USING btree ("BillingCycleId");


--
-- Name: UX_Listings_EstatePropertyId_ListingType_Active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UX_Listings_EstatePropertyId_ListingType_Active" ON public."Listings" USING btree ("EstatePropertyId", "ListingType") WHERE (("IsActive" = true) AND ("IsDeleted" = false));


--
-- Name: UX_UsageRecords_Subject_Type_Reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UX_UsageRecords_Subject_Type_Reference" ON public."UsageRecords" USING btree ("SubjectType", "MemberOrCompanyId", "Type", "ReferenceId");


--
-- Name: analytics_events_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_events_created_at_idx ON public.analytics_events USING btree (created_at);


--
-- Name: analytics_events_event_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_events_event_name_idx ON public.analytics_events USING btree (event_name);


--
-- Name: analytics_events_property_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_events_property_id_idx ON public.analytics_events USING btree (property_id);


--
-- Name: analytics_events_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_events_session_id_idx ON public.analytics_events USING btree (session_id);


--
-- Name: estate_property_policy_property_listing_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX estate_property_policy_property_listing_idx ON public."EstatePropertyPolicy" USING btree ("EstatePropertyId", "ListingType") WHERE ("IsDeleted" = false);


--
-- Name: force_logout_member_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX force_logout_member_pending_idx ON public."ForceLogoutRequests" USING btree ("MemberId", "AcknowledgedAt");


--
-- Name: idx_booking_holds_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_holds_expires_at ON public.booking_holds USING btree (expires_at);


--
-- Name: idx_booking_holds_property_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_holds_property_dates ON public.booking_holds USING btree (property_id, check_in, check_out);


--
-- Name: idx_booking_manage_tokens_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_manage_tokens_booking_id ON public.booking_manage_tokens USING btree (booking_id);


--
-- Name: idx_booking_rate_limits_scope_key_window; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_booking_rate_limits_scope_key_window ON public.booking_rate_limits USING btree (scope, key, window_start);


--
-- Name: idx_otp_rate_limits_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_rate_limits_lookup ON public.otp_rate_limits USING btree (scope, key, window_start DESC);


--
-- Name: idx_otp_requests_hold_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_requests_hold_id ON public.otp_requests USING btree (hold_id) WHERE (hold_id IS NOT NULL);


--
-- Name: idx_otp_requests_pending_fallback; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_requests_pending_fallback ON public.otp_requests USING btree (fallback_required_at) WHERE ((verified = false) AND (sms_status = 'not_sent'::text) AND (fallback_required_at IS NOT NULL));


--
-- Name: idx_otp_requests_phone_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_requests_phone_created_at ON public.otp_requests USING btree (phone, created_at DESC);


--
-- Name: idx_otp_requests_phone_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_requests_phone_expires_at ON public.otp_requests USING btree (phone, expires_at DESC);


--
-- Name: idx_propertydetailssection_property_display; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propertydetailssection_property_display ON public.propertydetailssection USING btree (propertyid, displayorder);


--
-- Name: idx_propertyimages_property_display; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propertyimages_property_display ON public."PropertyImages" USING btree ("EstatePropertyId", "DisplayOrder");


--
-- Name: idx_propertysectionimages_propertyimage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propertysectionimages_propertyimage ON public.propertysectionimages USING btree (propertyimageid);


--
-- Name: idx_propertysectionimages_section_display; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propertysectionimages_section_display ON public.propertysectionimages USING btree (sectionid, displayorder);


--
-- Name: members_email_active_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX members_email_active_unique_idx ON public."Members" USING btree (lower((COALESCE("Email", ''::character varying))::text)) WHERE (("IsDeleted" = false) AND ("Email" IS NOT NULL) AND (length(TRIM(BOTH FROM "Email")) > 0));


--
-- Name: members_phone_active_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX members_phone_active_unique_idx ON public."Members" USING btree ("Phone") WHERE (("IsDeleted" = false) AND ("Phone" IS NOT NULL) AND (length(TRIM(BOTH FROM "Phone")) > 0));


--
-- Name: members_userid_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX members_userid_unique_idx ON public."Members" USING btree ("UserId");


--
-- Name: Bookings TRG_Bookings_Validate_GuestId; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "TRG_Bookings_Validate_GuestId" BEFORE INSERT OR UPDATE OF "GuestId" ON public."Bookings" FOR EACH ROW EXECUTE FUNCTION public.trg_bookings_validate_guest_id();


--
-- Name: Reviews TRG_Reviews_Validate_GuestId; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "TRG_Reviews_Validate_GuestId" BEFORE INSERT OR UPDATE OF "GuestId" ON public."Reviews" FOR EACH ROW EXECUTE FUNCTION public.trg_reviews_validate_guest_id();


--
-- Name: Invoices trg_validate_invoice_billing_subject; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_invoice_billing_subject BEFORE INSERT OR UPDATE ON public."Invoices" FOR EACH ROW EXECUTE FUNCTION public.trg_validate_invoice_billing_subject();


--
-- Name: BillingPlanAssignments BillingPlanAssignments_PlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BillingPlanAssignments"
    ADD CONSTRAINT "BillingPlanAssignments_PlanId_fkey" FOREIGN KEY ("PlanId") REFERENCES public."Plans"("Id");


--
-- Name: EstatePropertyPolicy EstatePropertyPolicy_EstatePropertyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EstatePropertyPolicy"
    ADD CONSTRAINT "EstatePropertyPolicy_EstatePropertyId_fkey" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: EventVenueExtension EventVenueExtension_EstatePropertyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EventVenueExtension"
    ADD CONSTRAINT "EventVenueExtension_EstatePropertyId_fkey" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: AuthEmailChangeRequests FK_AuthEmailChangeRequests_UserId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuthEmailChangeRequests"
    ADD CONSTRAINT "FK_AuthEmailChangeRequests_UserId" FOREIGN KEY ("UserId") REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: AvailabilityBlocks FK_AvailabilityBlocks_EstateProperties_EstatePropertyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AvailabilityBlocks"
    ADD CONSTRAINT "FK_AvailabilityBlocks_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: Bookings FK_Bookings_EstateProperties_EstatePropertyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bookings"
    ADD CONSTRAINT "FK_Bookings_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: CalendarIntegrations FK_CalendarIntegrations_EstateProperties_EstatePropertyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CalendarIntegrations"
    ADD CONSTRAINT "FK_CalendarIntegrations_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: CompanyMembers FK_CompanyMembers_Companies_CompanyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompanyMembers"
    ADD CONSTRAINT "FK_CompanyMembers_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES public."Companies"("Id") ON DELETE CASCADE;


--
-- Name: EstateProperties FK_EstateProperties_Owners_OwnerId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EstateProperties"
    ADD CONSTRAINT "FK_EstateProperties_Owners_OwnerId" FOREIGN KEY ("OwnerId") REFERENCES public."Owners"("Id");


--
-- Name: EstatePropertyAmenity FK_EstatePropertyAmenity_Amenities_AmenityId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EstatePropertyAmenity"
    ADD CONSTRAINT "FK_EstatePropertyAmenity_Amenities_AmenityId" FOREIGN KEY ("AmenityId") REFERENCES public."Amenities"("Id") ON DELETE CASCADE;


--
-- Name: EstatePropertyAmenity FK_EstatePropertyAmenity_EstateProperties_EstatePropertyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EstatePropertyAmenity"
    ADD CONSTRAINT "FK_EstatePropertyAmenity_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: ExternalCalendarEvents FK_ExternalCalendarEvents_CalendarIntegrations_CalendarIntegrat; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExternalCalendarEvents"
    ADD CONSTRAINT "FK_ExternalCalendarEvents_CalendarIntegrations_CalendarIntegrat" FOREIGN KEY ("CalendarIntegrationId") REFERENCES public."CalendarIntegrations"("Id") ON DELETE CASCADE;


--
-- Name: Favorites FK_Favorites_EstateProperties_EstatePropertyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Favorites"
    ADD CONSTRAINT "FK_Favorites_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: Favorites FK_Favorites_Members_MemberId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Favorites"
    ADD CONSTRAINT "FK_Favorites_Members_MemberId" FOREIGN KEY ("MemberId") REFERENCES public."Members"("Id") ON DELETE CASCADE;


--
-- Name: MemberActionHistory FK_MemberActionHistory_Members_MemberId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MemberActionHistory"
    ADD CONSTRAINT "FK_MemberActionHistory_Members_MemberId" FOREIGN KEY ("MemberId") REFERENCES public."Members"("Id") ON DELETE CASCADE;


--
-- Name: MemberActionHistory FK_MemberActionHistory_Members_PerformedBy; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MemberActionHistory"
    ADD CONSTRAINT "FK_MemberActionHistory_Members_PerformedBy" FOREIGN KEY ("PerformedBy") REFERENCES public."Members"("Id") ON DELETE CASCADE;


--
-- Name: MemberForceLogout FK_MemberForceLogout_Members_MemberId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MemberForceLogout"
    ADD CONSTRAINT "FK_MemberForceLogout_Members_MemberId" FOREIGN KEY ("MemberId") REFERENCES public."Members"("Id") ON DELETE CASCADE;


--
-- Name: MemberForceLogout FK_MemberForceLogout_Members_RequestedBy; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MemberForceLogout"
    ADD CONSTRAINT "FK_MemberForceLogout_Members_RequestedBy" FOREIGN KEY ("RequestedBy") REFERENCES public."Members"("Id") ON DELETE CASCADE;


--
-- Name: MemberOnboarding FK_MemberOnboarding_Members_LastResetBy; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MemberOnboarding"
    ADD CONSTRAINT "FK_MemberOnboarding_Members_LastResetBy" FOREIGN KEY ("LastResetBy") REFERENCES public."Members"("Id") ON DELETE CASCADE;


--
-- Name: MemberOnboarding FK_MemberOnboarding_Members_MemberId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MemberOnboarding"
    ADD CONSTRAINT "FK_MemberOnboarding_Members_MemberId" FOREIGN KEY ("MemberId") REFERENCES public."Members"("Id") ON DELETE CASCADE;


--
-- Name: MessageRecipients FK_MessageRecipients_Members_RecipientId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageRecipients"
    ADD CONSTRAINT "FK_MessageRecipients_Members_RecipientId" FOREIGN KEY ("RecipientId") REFERENCES public."Members"("Id") ON DELETE CASCADE;


--
-- Name: MessageRecipients FK_MessageRecipients_Messages_MessageId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageRecipients"
    ADD CONSTRAINT "FK_MessageRecipients_Messages_MessageId" FOREIGN KEY ("MessageId") REFERENCES public."Messages"("Id") ON DELETE CASCADE;


--
-- Name: MessageThreads FK_MessageThreads_EstateProperties_PropertyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageThreads"
    ADD CONSTRAINT "FK_MessageThreads_EstateProperties_PropertyId" FOREIGN KEY ("PropertyId") REFERENCES public."EstateProperties"("Id");


--
-- Name: Messages FK_Messages_Members_SenderId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Messages"
    ADD CONSTRAINT "FK_Messages_Members_SenderId" FOREIGN KEY ("SenderId") REFERENCES public."Members"("Id") ON DELETE CASCADE;


--
-- Name: Messages FK_Messages_MessageThreads_ThreadId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Messages"
    ADD CONSTRAINT "FK_Messages_MessageThreads_ThreadId" FOREIGN KEY ("ThreadId") REFERENCES public."MessageThreads"("Id") ON DELETE CASCADE;


--
-- Name: Messages FK_Messages_Messages_InReplyToMessageId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Messages"
    ADD CONSTRAINT "FK_Messages_Messages_InReplyToMessageId" FOREIGN KEY ("InReplyToMessageId") REFERENCES public."Messages"("Id") ON DELETE SET NULL;


--
-- Name: OwnerOnboarding FK_OwnerOnboarding_Members_MemberId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OwnerOnboarding"
    ADD CONSTRAINT "FK_OwnerOnboarding_Members_MemberId" FOREIGN KEY ("MemberId") REFERENCES public."Members"("Id") ON DELETE CASCADE;


--
-- Name: Owners FK_Owners_Companies_CompanyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Owners"
    ADD CONSTRAINT "FK_Owners_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES public."Companies"("Id") ON DELETE CASCADE;


--
-- Name: Owners FK_Owners_Members_MemberId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Owners"
    ADD CONSTRAINT "FK_Owners_Members_MemberId" FOREIGN KEY ("MemberId") REFERENCES public."Members"("Id") ON DELETE CASCADE;


--
-- Name: PropertyDocuments FK_PropertyDocuments_EstateProperties_EstatePropertyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertyDocuments"
    ADD CONSTRAINT "FK_PropertyDocuments_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: PropertyImages FK_PropertyImages_EstateProperties_EstatePropertyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertyImages"
    ADD CONSTRAINT "FK_PropertyImages_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: PropertyMessageLogs FK_PropertyMessageLogs_EstateProperties_PropertyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertyMessageLogs"
    ADD CONSTRAINT "FK_PropertyMessageLogs_EstateProperties_PropertyId" FOREIGN KEY ("PropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: PropertyModerationActions FK_PropertyModerationActions_EstateProperties_PropertyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertyModerationActions"
    ADD CONSTRAINT "FK_PropertyModerationActions_EstateProperties_PropertyId" FOREIGN KEY ("PropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: PropertyVideos FK_PropertyVideos_EstateProperties_EstatePropertyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertyVideos"
    ADD CONSTRAINT "FK_PropertyVideos_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: PropertyVisitLogs FK_PropertyVisitLogs_EstateProperties_PropertyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertyVisitLogs"
    ADD CONSTRAINT "FK_PropertyVisitLogs_EstateProperties_PropertyId" FOREIGN KEY ("PropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: Reviews FK_Reviews_Bookings_BookingId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reviews"
    ADD CONSTRAINT "FK_Reviews_Bookings_BookingId" FOREIGN KEY ("BookingId") REFERENCES public."Bookings"("Id") ON DELETE CASCADE;


--
-- Name: Reviews FK_Reviews_EstateProperties_EstatePropertyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reviews"
    ADD CONSTRAINT "FK_Reviews_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: SyncJobs FK_SyncJobs_CalendarIntegrations_CalendarIntegrationId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SyncJobs"
    ADD CONSTRAINT "FK_SyncJobs_CalendarIntegrations_CalendarIntegrationId" FOREIGN KEY ("CalendarIntegrationId") REFERENCES public."CalendarIntegrations"("Id") ON DELETE CASCADE;


--
-- Name: UserApps FK_UserApps_UserId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserApps"
    ADD CONSTRAINT "FK_UserApps_UserId" FOREIGN KEY ("UserId") REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ForceLogoutRequests ForceLogoutRequests_MemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ForceLogoutRequests"
    ADD CONSTRAINT "ForceLogoutRequests_MemberId_fkey" FOREIGN KEY ("MemberId") REFERENCES public."Members"("Id") ON DELETE CASCADE;


--
-- Name: ForceLogoutRequests ForceLogoutRequests_RequestedByMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ForceLogoutRequests"
    ADD CONSTRAINT "ForceLogoutRequests_RequestedByMemberId_fkey" FOREIGN KEY ("RequestedByMemberId") REFERENCES public."Members"("Id") ON DELETE RESTRICT;


--
-- Name: Invoices Invoices_BillingCycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoices"
    ADD CONSTRAINT "Invoices_BillingCycleId_fkey" FOREIGN KEY ("BillingCycleId") REFERENCES public."BillingCycles"("Id");


--
-- Name: ListingDailyFactors ListingDailyFactors_ListingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ListingDailyFactors"
    ADD CONSTRAINT "ListingDailyFactors_ListingId_fkey" FOREIGN KEY ("ListingId") REFERENCES public."Listings"("Id") ON DELETE CASCADE;


--
-- Name: Listings Listings_EstatePropertyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Listings"
    ADD CONSTRAINT "Listings_EstatePropertyId_fkey" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: Members Members_UserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Members"
    ADD CONSTRAINT "Members_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: PropertySearchScores PropertySearchScores_EstatePropertyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertySearchScores"
    ADD CONSTRAINT "PropertySearchScores_EstatePropertyId_fkey" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: PropertySearchScores PropertySearchScores_ListingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PropertySearchScores"
    ADD CONSTRAINT "PropertySearchScores_ListingId_fkey" FOREIGN KEY ("ListingId") REFERENCES public."Listings"("Id") ON DELETE SET NULL;


--
-- Name: RealEstateExtension RealEstateExtension_EstatePropertyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RealEstateExtension"
    ADD CONSTRAINT "RealEstateExtension_EstatePropertyId_fkey" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: SummerRentExtension SummerRentExtension_EstatePropertyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SummerRentExtension"
    ADD CONSTRAINT "SummerRentExtension_EstatePropertyId_fkey" FOREIGN KEY ("EstatePropertyId") REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: UsageRecords UsageRecords_InvoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsageRecords"
    ADD CONSTRAINT "UsageRecords_InvoiceId_fkey" FOREIGN KEY ("InvoiceId") REFERENCES public."Invoices"("Id");


--
-- Name: CompanyMembers fk_usercompanies_companyid; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompanyMembers"
    ADD CONSTRAINT fk_usercompanies_companyid FOREIGN KEY ("CompanyId") REFERENCES public."Companies"("Id");


--
-- Name: CompanyMembers fk_usercompanies_memberid; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompanyMembers"
    ADD CONSTRAINT fk_usercompanies_memberid FOREIGN KEY ("MemberId") REFERENCES public."Members"("Id");


--
-- Name: Members members_userid_fkey_auth_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Members"
    ADD CONSTRAINT members_userid_fkey_auth_users FOREIGN KEY ("UserId") REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: otp_requests otp_requests_hold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_requests
    ADD CONSTRAINT otp_requests_hold_id_fkey FOREIGN KEY (hold_id) REFERENCES public.booking_holds(id) ON DELETE SET NULL;


--
-- Name: propertydetailssection propertydetailssection_propertyid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propertydetailssection
    ADD CONSTRAINT propertydetailssection_propertyid_fkey FOREIGN KEY (propertyid) REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE;


--
-- Name: propertysectionimages propertysectionimages_propertyimageid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propertysectionimages
    ADD CONSTRAINT propertysectionimages_propertyimageid_fkey FOREIGN KEY (propertyimageid) REFERENCES public."PropertyImages"("Id") ON DELETE CASCADE;


--
-- Name: propertysectionimages propertysectionimages_sectionid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propertysectionimages
    ADD CONSTRAINT propertysectionimages_sectionid_fkey FOREIGN KEY (sectionid) REFERENCES public.propertydetailssection(id) ON DELETE CASCADE;


--
-- Name: EstateProperties Admins and managers can update company properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can update company properties" ON public."EstateProperties" FOR UPDATE USING (("OwnerId" IN ( SELECT "CompanyMembers"."CompanyId"
   FROM public."CompanyMembers"
  WHERE (("CompanyMembers"."MemberId" IN ( SELECT "Members"."Id"
           FROM public."Members"
          WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false)))) AND ("CompanyMembers"."Role" = ANY (ARRAY['Admin'::text, 'Manager'::text])) AND ("CompanyMembers"."IsDeleted" = false)))));


--
-- Name: EstateProperties Admins can delete company properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete company properties" ON public."EstateProperties" FOR DELETE USING (("OwnerId" IN ( SELECT "CompanyMembers"."CompanyId"
   FROM public."CompanyMembers"
  WHERE (("CompanyMembers"."MemberId" IN ( SELECT "Members"."Id"
           FROM public."Members"
          WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false)))) AND ("CompanyMembers"."Role" = 'Admin'::text) AND ("CompanyMembers"."IsDeleted" = false)))));


--
-- Name: PropertyModerationActions Admins can insert property moderation actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert property moderation actions" ON public."PropertyModerationActions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false) AND (m."Role" = 'admin'::text)))));


--
-- Name: AvailabilityBlocks Admins can manage all availability blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all availability blocks" ON public."AvailabilityBlocks" USING ((EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false) AND (m."Role" = 'admin'::text)))));


--
-- Name: Bookings Admins can manage all bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all bookings" ON public."Bookings" USING ((EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false) AND (m."Role" = 'admin'::text)))));


--
-- Name: CalendarIntegrations Admins can manage all calendar integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all calendar integrations" ON public."CalendarIntegrations" USING ((EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false) AND (m."Role" = 'admin'::text)))));


--
-- Name: ExternalCalendarEvents Admins can manage all external calendar events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all external calendar events" ON public."ExternalCalendarEvents" USING ((EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false) AND (m."Role" = 'admin'::text)))));


--
-- Name: Owners Admins can manage all owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all owners" ON public."Owners" USING ((EXISTS ( SELECT 1
   FROM public."Members"
  WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false) AND ("Members"."Role" = 'admin'::text)))));


--
-- Name: SyncJobs Admins can manage all sync jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all sync jobs" ON public."SyncJobs" USING ((EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false) AND (m."Role" = 'admin'::text)))));


--
-- Name: MemberActionHistory Admins can manage member action history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage member action history" ON public."MemberActionHistory" USING ((EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false) AND (m."Role" = 'admin'::text)))));


--
-- Name: MemberForceLogout Admins can manage member force logout; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage member force logout" ON public."MemberForceLogout" USING ((EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false) AND (m."Role" = 'admin'::text)))));


--
-- Name: MemberOnboarding Admins can manage member onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage member onboarding" ON public."MemberOnboarding" USING ((EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false) AND (m."Role" = 'admin'::text)))));


--
-- Name: Members Admins can read any members table record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read any members table record" ON public."Members" FOR SELECT USING (public.is_admin());


--
-- Name: PropertyModerationActions Admins can view all property moderation actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all property moderation actions" ON public."PropertyModerationActions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false) AND (m."Role" = 'admin'::text)))));


--
-- Name: MemberActionHistory Admins can view member action history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view member action history" ON public."MemberActionHistory" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false) AND (m."Role" = 'admin'::text)))));


--
-- Name: MemberForceLogout Admins can view member force logout; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view member force logout" ON public."MemberForceLogout" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false) AND (m."Role" = 'admin'::text)))));


--
-- Name: MemberOnboarding Admins can view member onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view member onboarding" ON public."MemberOnboarding" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false) AND (m."Role" = 'admin'::text)))));


--
-- Name: Amenities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Amenities" ENABLE ROW LEVEL SECURITY;

--
-- Name: Amenities Amenities_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Amenities_admin_all" ON public."Amenities" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: Amenities Amenities_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Amenities_anon_select" ON public."Amenities" FOR SELECT TO anon USING (("IsDeleted" = false));


--
-- Name: Amenities Amenities_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Amenities_authenticated_select" ON public."Amenities" FOR SELECT TO authenticated USING (("IsDeleted" = false));


--
-- Name: AppParameters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."AppParameters" ENABLE ROW LEVEL SECURITY;

--
-- Name: AppParameters AppParameters_all_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AppParameters_all_admin" ON public."AppParameters" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: AppParameters AppParameters_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AppParameters_select_authenticated" ON public."AppParameters" FOR SELECT TO authenticated, anon USING ((("IsDeleted" = false) AND ("IsActive" = true)));


--
-- Name: AuthEmailChangeRequests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."AuthEmailChangeRequests" ENABLE ROW LEVEL SECURITY;

--
-- Name: AuthEmailChangeRequests AuthEmailChangeRequests_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AuthEmailChangeRequests_admin_all" ON public."AuthEmailChangeRequests" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: AuthEmailChangeRequests AuthEmailChangeRequests_user_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AuthEmailChangeRequests_user_all" ON public."AuthEmailChangeRequests" TO authenticated USING (("UserId" = auth.uid())) WITH CHECK (("UserId" = auth.uid()));


--
-- Name: AvailabilityBlocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."AvailabilityBlocks" ENABLE ROW LEVEL SECURITY;

--
-- Name: AvailabilityBlocks AvailabilityBlocks_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AvailabilityBlocks_admin_all" ON public."AvailabilityBlocks" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: AvailabilityBlocks AvailabilityBlocks_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AvailabilityBlocks_anon_select" ON public."AvailabilityBlocks" FOR SELECT TO anon USING (("IsDeleted" = false));


--
-- Name: AvailabilityBlocks AvailabilityBlocks_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AvailabilityBlocks_user_delete" ON public."AvailabilityBlocks" FOR DELETE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: AvailabilityBlocks AvailabilityBlocks_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AvailabilityBlocks_user_insert" ON public."AvailabilityBlocks" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: AvailabilityBlocks AvailabilityBlocks_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AvailabilityBlocks_user_select" ON public."AvailabilityBlocks" FOR SELECT TO authenticated USING ((("IsDeleted" = false) AND public.user_can_manage_estate_property("EstatePropertyId")));


--
-- Name: AvailabilityBlocks AvailabilityBlocks_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AvailabilityBlocks_user_update" ON public."AvailabilityBlocks" FOR UPDATE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId")) WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: BillingCycles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."BillingCycles" ENABLE ROW LEVEL SECURITY;

--
-- Name: BillingCycles BillingCycles_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingCycles_admin_delete" ON public."BillingCycles" FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: BillingCycles BillingCycles_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingCycles_admin_insert" ON public."BillingCycles" FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: BillingCycles BillingCycles_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingCycles_admin_select" ON public."BillingCycles" FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: BillingCycles BillingCycles_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingCycles_admin_update" ON public."BillingCycles" FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: BillingCycles BillingCycles_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingCycles_service_all" ON public."BillingCycles" TO service_role USING (true) WITH CHECK (true);


--
-- Name: BillingCycles BillingCycles_subject_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingCycles_subject_delete" ON public."BillingCycles" FOR DELETE TO authenticated USING (public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId"));


--
-- Name: BillingCycles BillingCycles_subject_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingCycles_subject_insert" ON public."BillingCycles" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId"));


--
-- Name: BillingCycles BillingCycles_subject_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingCycles_subject_select" ON public."BillingCycles" FOR SELECT TO authenticated USING (((("SubjectType" = 'member'::text) AND ("MemberOrCompanyId" IN ( SELECT m."Id"
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false))))) OR (("SubjectType" = 'company'::text) AND ("MemberOrCompanyId" IN ( SELECT cm."CompanyId"
   FROM (public."CompanyMembers" cm
     JOIN public."Members" m ON (((m."Id" = cm."MemberId") AND (m."IsDeleted" = false))))
  WHERE ((m."UserId" = auth.uid()) AND (cm."IsDeleted" = false)))))));


--
-- Name: BillingCycles BillingCycles_subject_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingCycles_subject_update" ON public."BillingCycles" FOR UPDATE TO authenticated USING (public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId")) WITH CHECK (public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId"));


--
-- Name: BillingPlanAssignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."BillingPlanAssignments" ENABLE ROW LEVEL SECURITY;

--
-- Name: BillingPlanAssignments BillingPlanAssignments_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingPlanAssignments_admin_delete" ON public."BillingPlanAssignments" FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: BillingPlanAssignments BillingPlanAssignments_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingPlanAssignments_admin_insert" ON public."BillingPlanAssignments" FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: BillingPlanAssignments BillingPlanAssignments_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingPlanAssignments_admin_select" ON public."BillingPlanAssignments" FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: BillingPlanAssignments BillingPlanAssignments_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingPlanAssignments_admin_update" ON public."BillingPlanAssignments" FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: BillingPlanAssignments BillingPlanAssignments_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingPlanAssignments_member_select" ON public."BillingPlanAssignments" FOR SELECT TO authenticated USING (((("SubjectType" = 'member'::text) AND ("MemberOrCompanyId" IN ( SELECT m."Id"
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false))))) OR (("SubjectType" = 'company'::text) AND ("MemberOrCompanyId" IN ( SELECT cm."CompanyId"
   FROM (public."CompanyMembers" cm
     JOIN public."Members" m ON (((m."Id" = cm."MemberId") AND (m."IsDeleted" = false))))
  WHERE ((m."UserId" = auth.uid()) AND (cm."IsDeleted" = false)))))));


--
-- Name: BillingPlanAssignments BillingPlanAssignments_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingPlanAssignments_service_all" ON public."BillingPlanAssignments" TO service_role USING (true) WITH CHECK (true);


--
-- Name: BillingPlanAssignments BillingPlanAssignments_subject_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingPlanAssignments_subject_delete" ON public."BillingPlanAssignments" FOR DELETE TO authenticated USING (public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId"));


--
-- Name: BillingPlanAssignments BillingPlanAssignments_subject_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingPlanAssignments_subject_insert" ON public."BillingPlanAssignments" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId"));


--
-- Name: BillingPlanAssignments BillingPlanAssignments_subject_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "BillingPlanAssignments_subject_update" ON public."BillingPlanAssignments" FOR UPDATE TO authenticated USING (public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId")) WITH CHECK (public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId"));


--
-- Name: Bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Bookings" ENABLE ROW LEVEL SECURITY;

--
-- Name: Bookings Bookings_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Bookings_admin_all" ON public."Bookings" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: Bookings Bookings_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Bookings_anon_insert" ON public."Bookings" FOR INSERT TO anon WITH CHECK (true);


--
-- Name: Bookings Bookings_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Bookings_anon_select" ON public."Bookings" FOR SELECT TO anon USING (("IsDeleted" = false));


--
-- Name: Bookings Bookings_anon_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Bookings_anon_update" ON public."Bookings" FOR UPDATE TO anon USING (("IsDeleted" = false)) WITH CHECK (("IsDeleted" = false));


--
-- Name: Bookings Bookings_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Bookings_user_delete" ON public."Bookings" FOR DELETE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: Bookings Bookings_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Bookings_user_insert" ON public."Bookings" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: Bookings Bookings_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Bookings_user_select" ON public."Bookings" FOR SELECT TO authenticated USING ((("IsDeleted" = false) AND public.user_can_manage_estate_property("EstatePropertyId")));


--
-- Name: Bookings Bookings_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Bookings_user_update" ON public."Bookings" FOR UPDATE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId")) WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: CalendarIntegrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."CalendarIntegrations" ENABLE ROW LEVEL SECURITY;

--
-- Name: CalendarIntegrations CalendarIntegrations_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "CalendarIntegrations_admin_all" ON public."CalendarIntegrations" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: CalendarIntegrations CalendarIntegrations_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "CalendarIntegrations_user_delete" ON public."CalendarIntegrations" FOR DELETE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: CalendarIntegrations CalendarIntegrations_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "CalendarIntegrations_user_insert" ON public."CalendarIntegrations" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: CalendarIntegrations CalendarIntegrations_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "CalendarIntegrations_user_select" ON public."CalendarIntegrations" FOR SELECT TO authenticated USING ((("IsDeleted" = false) AND public.user_can_manage_estate_property("EstatePropertyId")));


--
-- Name: CalendarIntegrations CalendarIntegrations_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "CalendarIntegrations_user_update" ON public."CalendarIntegrations" FOR UPDATE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId")) WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: Companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Companies" ENABLE ROW LEVEL SECURITY;

--
-- Name: Companies Companies_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Companies_admin_delete" ON public."Companies" FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: Companies Companies_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Companies_admin_insert" ON public."Companies" FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: Companies Companies_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Companies_admin_select" ON public."Companies" FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: Companies Companies_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Companies_anon_select" ON public."Companies" FOR SELECT TO anon USING (("IsDeleted" = false));


--
-- Name: Companies Companies_authenticated_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Companies_authenticated_insert" ON public."Companies" FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: Companies Companies_authenticated_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Companies_authenticated_select_all" ON public."Companies" FOR SELECT TO authenticated USING (("IsDeleted" = false));


--
-- Name: CompanyMembers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."CompanyMembers" ENABLE ROW LEVEL SECURITY;

--
-- Name: CompanyMembers CompanyMembers_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "CompanyMembers_admin_select" ON public."CompanyMembers" FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: CompanyMembers CompanyMembers_authenticated_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "CompanyMembers_authenticated_select_all" ON public."CompanyMembers" FOR SELECT TO authenticated USING (("IsDeleted" = false));


--
-- Name: CompanyMembers CompanyMembers_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "CompanyMembers_delete_policy" ON public."CompanyMembers" FOR DELETE TO authenticated USING ((public.is_admin() OR public.is_company_manager("CompanyId")));


--
-- Name: EstateProperties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."EstateProperties" ENABLE ROW LEVEL SECURITY;

--
-- Name: EstateProperties EstateProperties_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstateProperties_admin_all" ON public."EstateProperties" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: EstateProperties EstateProperties_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstateProperties_anon_select" ON public."EstateProperties" FOR SELECT TO anon USING (("IsDeleted" = false));


--
-- Name: EstateProperties EstateProperties_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstateProperties_user_delete" ON public."EstateProperties" FOR DELETE TO authenticated USING (public.user_can_manage_estate_property("Id"));


--
-- Name: EstateProperties EstateProperties_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstateProperties_user_insert" ON public."EstateProperties" FOR INSERT TO authenticated WITH CHECK (public.user_owns_owner_record("OwnerId"));


--
-- Name: EstateProperties EstateProperties_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstateProperties_user_select" ON public."EstateProperties" FOR SELECT TO authenticated USING ((("IsDeleted" = false) AND public.user_can_manage_estate_property("Id")));


--
-- Name: EstateProperties EstateProperties_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstateProperties_user_update" ON public."EstateProperties" FOR UPDATE TO authenticated USING (public.user_can_manage_estate_property("Id")) WITH CHECK (public.user_can_manage_estate_property("Id"));


--
-- Name: EstatePropertyAmenity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."EstatePropertyAmenity" ENABLE ROW LEVEL SECURITY;

--
-- Name: EstatePropertyAmenity EstatePropertyAmenity_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstatePropertyAmenity_admin_all" ON public."EstatePropertyAmenity" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: EstatePropertyAmenity EstatePropertyAmenity_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstatePropertyAmenity_anon_select" ON public."EstatePropertyAmenity" FOR SELECT TO anon USING (((COALESCE("DeletedAtUtc", 'infinity'::timestamp with time zone) > now()) AND public.is_public_estate_property("EstatePropertyId")));


--
-- Name: EstatePropertyAmenity EstatePropertyAmenity_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstatePropertyAmenity_user_delete" ON public."EstatePropertyAmenity" FOR DELETE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: EstatePropertyAmenity EstatePropertyAmenity_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstatePropertyAmenity_user_insert" ON public."EstatePropertyAmenity" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: EstatePropertyAmenity EstatePropertyAmenity_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstatePropertyAmenity_user_select" ON public."EstatePropertyAmenity" FOR SELECT TO authenticated USING (((COALESCE("DeletedAtUtc", 'infinity'::timestamp with time zone) > now()) AND public.user_can_manage_estate_property("EstatePropertyId")));


--
-- Name: EstatePropertyAmenity EstatePropertyAmenity_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstatePropertyAmenity_user_update" ON public."EstatePropertyAmenity" FOR UPDATE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId")) WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: EstatePropertyPolicy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."EstatePropertyPolicy" ENABLE ROW LEVEL SECURITY;

--
-- Name: EstatePropertyPolicy EstatePropertyPolicy_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstatePropertyPolicy_admin_all" ON public."EstatePropertyPolicy" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: EstatePropertyPolicy EstatePropertyPolicy_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstatePropertyPolicy_anon_select" ON public."EstatePropertyPolicy" FOR SELECT TO anon USING ((("IsDeleted" = false) AND public.is_public_estate_property("EstatePropertyId")));


--
-- Name: EstatePropertyPolicy EstatePropertyPolicy_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstatePropertyPolicy_user_delete" ON public."EstatePropertyPolicy" FOR DELETE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: EstatePropertyPolicy EstatePropertyPolicy_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstatePropertyPolicy_user_insert" ON public."EstatePropertyPolicy" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: EstatePropertyPolicy EstatePropertyPolicy_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstatePropertyPolicy_user_select" ON public."EstatePropertyPolicy" FOR SELECT TO authenticated USING ((("IsDeleted" = false) AND public.user_can_manage_estate_property("EstatePropertyId")));


--
-- Name: EstatePropertyPolicy EstatePropertyPolicy_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EstatePropertyPolicy_user_update" ON public."EstatePropertyPolicy" FOR UPDATE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId")) WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: EventVenueExtension; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."EventVenueExtension" ENABLE ROW LEVEL SECURITY;

--
-- Name: EventVenueExtension EventVenueExtension_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EventVenueExtension_admin_all" ON public."EventVenueExtension" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: EventVenueExtension EventVenueExtension_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EventVenueExtension_anon_select" ON public."EventVenueExtension" FOR SELECT TO anon USING (public.is_public_estate_property("EstatePropertyId"));


--
-- Name: EventVenueExtension EventVenueExtension_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EventVenueExtension_user_delete" ON public."EventVenueExtension" FOR DELETE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: EventVenueExtension EventVenueExtension_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EventVenueExtension_user_insert" ON public."EventVenueExtension" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: EventVenueExtension EventVenueExtension_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EventVenueExtension_user_select" ON public."EventVenueExtension" FOR SELECT TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: EventVenueExtension EventVenueExtension_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EventVenueExtension_user_update" ON public."EventVenueExtension" FOR UPDATE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId")) WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: ExternalCalendarEvents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ExternalCalendarEvents" ENABLE ROW LEVEL SECURITY;

--
-- Name: ExternalCalendarEvents ExternalCalendarEvents_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ExternalCalendarEvents_admin_all" ON public."ExternalCalendarEvents" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: ExternalCalendarEvents ExternalCalendarEvents_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ExternalCalendarEvents_anon_select" ON public."ExternalCalendarEvents" FOR SELECT TO anon USING (true);


--
-- Name: ExternalCalendarEvents ExternalCalendarEvents_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ExternalCalendarEvents_user_delete" ON public."ExternalCalendarEvents" FOR DELETE TO authenticated USING (public.user_can_manage_calendar_integration("CalendarIntegrationId"));


--
-- Name: ExternalCalendarEvents ExternalCalendarEvents_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ExternalCalendarEvents_user_insert" ON public."ExternalCalendarEvents" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_calendar_integration("CalendarIntegrationId"));


--
-- Name: ExternalCalendarEvents ExternalCalendarEvents_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ExternalCalendarEvents_user_select" ON public."ExternalCalendarEvents" FOR SELECT TO authenticated USING (public.user_can_manage_calendar_integration("CalendarIntegrationId"));


--
-- Name: ExternalCalendarEvents ExternalCalendarEvents_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ExternalCalendarEvents_user_update" ON public."ExternalCalendarEvents" FOR UPDATE TO authenticated USING (public.user_can_manage_calendar_integration("CalendarIntegrationId")) WITH CHECK (public.user_can_manage_calendar_integration("CalendarIntegrationId"));


--
-- Name: Favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Favorites" ENABLE ROW LEVEL SECURITY;

--
-- Name: ForceLogoutRequests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ForceLogoutRequests" ENABLE ROW LEVEL SECURITY;

--
-- Name: ForceLogoutRequests ForceLogoutRequests_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ForceLogoutRequests_admin_all" ON public."ForceLogoutRequests" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: ForceLogoutRequests ForceLogoutRequests_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ForceLogoutRequests_anon_select" ON public."ForceLogoutRequests" FOR SELECT TO anon USING (true);


--
-- Name: ForceLogoutRequests ForceLogoutRequests_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ForceLogoutRequests_user_select" ON public."ForceLogoutRequests" FOR SELECT TO authenticated USING (public.user_is_record_member("MemberId"));


--
-- Name: Guests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Guests" ENABLE ROW LEVEL SECURITY;

--
-- Name: Guests Guests_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests_admin_all" ON public."Guests" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: Guests Guests_anon_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests_anon_all" ON public."Guests" TO anon USING (true) WITH CHECK (true);


--
-- Name: Guests Guests_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests_authenticated_select" ON public."Guests" FOR SELECT TO authenticated USING (true);


--
-- Name: Invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Invoices" ENABLE ROW LEVEL SECURITY;

--
-- Name: Invoices Invoices_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Invoices_admin_all" ON public."Invoices" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: Invoices Invoices_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Invoices_service_all" ON public."Invoices" TO service_role USING (true) WITH CHECK (true);


--
-- Name: Invoices Invoices_subject_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Invoices_subject_select" ON public."Invoices" FOR SELECT TO authenticated USING (((("SubjectType" = 'member'::text) AND ("MemberOrCompanyId" IN ( SELECT m."Id"
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false))))) OR (("SubjectType" = 'company'::text) AND ("MemberOrCompanyId" IN ( SELECT cm."CompanyId"
   FROM (public."CompanyMembers" cm
     JOIN public."Members" m ON (((m."Id" = cm."MemberId") AND (m."IsDeleted" = false))))
  WHERE ((m."UserId" = auth.uid()) AND (cm."IsDeleted" = false)))))));


--
-- Name: ListingDailyFactors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."ListingDailyFactors" ENABLE ROW LEVEL SECURITY;

--
-- Name: ListingDailyFactors ListingDailyFactors_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ListingDailyFactors_select_all" ON public."ListingDailyFactors" FOR SELECT TO authenticated, anon USING (true);


--
-- Name: ListingDailyFactors ListingDailyFactors_write_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ListingDailyFactors_write_admin" ON public."ListingDailyFactors" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: Listings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Listings" ENABLE ROW LEVEL SECURITY;

--
-- Name: Listings Listings_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Listings_admin_all" ON public."Listings" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: Listings Listings_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Listings_anon_select" ON public."Listings" FOR SELECT TO anon USING ((("IsDeleted" = false) AND public.is_public_estate_property("EstatePropertyId")));


--
-- Name: Listings Listings_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Listings_user_delete" ON public."Listings" FOR DELETE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: Listings Listings_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Listings_user_insert" ON public."Listings" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: Listings Listings_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Listings_user_select" ON public."Listings" FOR SELECT TO authenticated USING ((("IsDeleted" = false) AND public.user_can_manage_estate_property("EstatePropertyId")));


--
-- Name: Listings Listings_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Listings_user_update" ON public."Listings" FOR UPDATE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId")) WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: MemberActionHistory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."MemberActionHistory" ENABLE ROW LEVEL SECURITY;

--
-- Name: MemberActionHistory MemberActionHistory_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "MemberActionHistory_admin_select" ON public."MemberActionHistory" FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: MemberForceLogout; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."MemberForceLogout" ENABLE ROW LEVEL SECURITY;

--
-- Name: MemberForceLogout MemberForceLogout_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "MemberForceLogout_admin_all" ON public."MemberForceLogout" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: MemberForceLogout MemberForceLogout_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "MemberForceLogout_anon_select" ON public."MemberForceLogout" FOR SELECT TO anon USING (true);


--
-- Name: MemberForceLogout MemberForceLogout_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "MemberForceLogout_user_select" ON public."MemberForceLogout" FOR SELECT TO authenticated USING (public.user_is_record_member("MemberId"));


--
-- Name: MemberOnboarding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."MemberOnboarding" ENABLE ROW LEVEL SECURITY;

--
-- Name: MemberOnboarding MemberOnboarding_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "MemberOnboarding_admin_all" ON public."MemberOnboarding" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: MemberOnboarding MemberOnboarding_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "MemberOnboarding_anon_select" ON public."MemberOnboarding" FOR SELECT TO anon USING (true);


--
-- Name: MemberOnboarding MemberOnboarding_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "MemberOnboarding_user_insert" ON public."MemberOnboarding" FOR INSERT TO authenticated WITH CHECK (public.user_is_record_member("MemberId"));


--
-- Name: MemberOnboarding MemberOnboarding_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "MemberOnboarding_user_select" ON public."MemberOnboarding" FOR SELECT TO authenticated USING (public.user_is_record_member("MemberId"));


--
-- Name: MemberOnboarding MemberOnboarding_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "MemberOnboarding_user_update" ON public."MemberOnboarding" FOR UPDATE TO authenticated USING (public.user_is_record_member("MemberId")) WITH CHECK (public.user_is_record_member("MemberId"));


--
-- Name: Members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Members" ENABLE ROW LEVEL SECURITY;

--
-- Name: OwnerOnboarding Members can insert own owner onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can insert own owner onboarding" ON public."OwnerOnboarding" FOR INSERT WITH CHECK (("MemberId" IN ( SELECT "Members"."Id"
   FROM public."Members"
  WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false)))));


--
-- Name: OwnerOnboarding Members can update own owner onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can update own owner onboarding" ON public."OwnerOnboarding" FOR UPDATE USING (("MemberId" IN ( SELECT "Members"."Id"
   FROM public."Members"
  WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false)))));


--
-- Name: OwnerOnboarding Members can view own owner onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view own owner onboarding" ON public."OwnerOnboarding" FOR SELECT USING (("MemberId" IN ( SELECT "Members"."Id"
   FROM public."Members"
  WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false)))));


--
-- Name: Members Members_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members_admin_all" ON public."Members" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: Members Members_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members_anon_select" ON public."Members" FOR SELECT TO anon USING (("IsDeleted" = false));


--
-- Name: Members Members_authenticated_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members_authenticated_insert" ON public."Members" FOR INSERT TO authenticated WITH CHECK (("UserId" = auth.uid()));


--
-- Name: Members Members_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members_authenticated_select" ON public."Members" FOR SELECT TO authenticated USING (("IsDeleted" = false));


--
-- Name: Members Members_authenticated_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members_authenticated_update" ON public."Members" FOR UPDATE TO authenticated USING (("UserId" = auth.uid())) WITH CHECK (("UserId" = auth.uid()));


--
-- Name: MessageRecipients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."MessageRecipients" ENABLE ROW LEVEL SECURITY;

--
-- Name: MessageThreads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."MessageThreads" ENABLE ROW LEVEL SECURITY;

--
-- Name: Messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: OwnerOnboarding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."OwnerOnboarding" ENABLE ROW LEVEL SECURITY;

--
-- Name: OwnerOnboarding OwnerOnboarding_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OwnerOnboarding_admin_all" ON public."OwnerOnboarding" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: OwnerOnboarding OwnerOnboarding_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OwnerOnboarding_user_insert" ON public."OwnerOnboarding" FOR INSERT TO authenticated WITH CHECK (public.user_is_record_member("MemberId"));


--
-- Name: OwnerOnboarding OwnerOnboarding_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OwnerOnboarding_user_select" ON public."OwnerOnboarding" FOR SELECT TO authenticated USING (public.user_is_record_member("MemberId"));


--
-- Name: OwnerOnboarding OwnerOnboarding_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OwnerOnboarding_user_update" ON public."OwnerOnboarding" FOR UPDATE TO authenticated USING (public.user_is_record_member("MemberId")) WITH CHECK (public.user_is_record_member("MemberId"));


--
-- Name: Owners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Owners" ENABLE ROW LEVEL SECURITY;

--
-- Name: Owners Owners_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners_admin_all" ON public."Owners" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: Owners Owners_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners_anon_select" ON public."Owners" FOR SELECT TO anon USING (("IsDeleted" = false));


--
-- Name: Owners Owners_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners_user_delete" ON public."Owners" FOR DELETE TO authenticated USING (public.user_owns_owner_record("Id"));


--
-- Name: Owners Owners_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners_user_insert" ON public."Owners" FOR INSERT TO authenticated WITH CHECK (((("OwnerType" = 'member'::public."OwnerType") AND ("MemberId" = public.current_member_id())) OR (("OwnerType" = 'company'::public."OwnerType") AND public.is_company_manager("CompanyId"))));


--
-- Name: Owners Owners_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners_user_select" ON public."Owners" FOR SELECT TO authenticated USING ((("IsDeleted" = false) AND public.user_can_read_owner_record("Id")));


--
-- Name: Owners Owners_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners_user_update" ON public."Owners" FOR UPDATE TO authenticated USING (public.user_owns_owner_record("Id")) WITH CHECK (public.user_owns_owner_record("Id"));


--
-- Name: Plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Plans" ENABLE ROW LEVEL SECURITY;

--
-- Name: Plans Plans_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Plans_admin_all" ON public."Plans" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: Plans Plans_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Plans_authenticated_select" ON public."Plans" FOR SELECT TO authenticated USING (true);


--
-- Name: Plans Plans_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Plans_service_all" ON public."Plans" TO service_role USING (true) WITH CHECK (true);


--
-- Name: AvailabilityBlocks Property owners can manage their availability blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Property owners can manage their availability blocks" ON public."AvailabilityBlocks" USING ((EXISTS ( SELECT 1
   FROM (public."EstateProperties" ep
     JOIN public."Owners" o ON ((ep."OwnerId" = o."Id")))
  WHERE ((ep."Id" = "AvailabilityBlocks"."EstatePropertyId") AND (ep."IsDeleted" = false) AND (o."IsDeleted" = false) AND (((o."OwnerType" = 'member'::public."OwnerType") AND (o."MemberId" IN ( SELECT "Members"."Id"
           FROM public."Members"
          WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false))))) OR ((o."OwnerType" = 'company'::public."OwnerType") AND (o."CompanyId" IN ( SELECT "CompanyMembers"."CompanyId"
           FROM public."CompanyMembers"
          WHERE (("CompanyMembers"."MemberId" IN ( SELECT "Members"."Id"
                   FROM public."Members"
                  WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false)))) AND ("CompanyMembers"."IsDeleted" = false))))))))));


--
-- Name: CalendarIntegrations Property owners can manage their calendar integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Property owners can manage their calendar integrations" ON public."CalendarIntegrations" USING ((EXISTS ( SELECT 1
   FROM (public."EstateProperties" ep
     JOIN public."Owners" o ON ((ep."OwnerId" = o."Id")))
  WHERE ((ep."Id" = "CalendarIntegrations"."EstatePropertyId") AND (ep."IsDeleted" = false) AND (o."IsDeleted" = false) AND (((o."OwnerType" = 'member'::public."OwnerType") AND (o."MemberId" IN ( SELECT "Members"."Id"
           FROM public."Members"
          WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false))))) OR ((o."OwnerType" = 'company'::public."OwnerType") AND (o."CompanyId" IN ( SELECT "CompanyMembers"."CompanyId"
           FROM public."CompanyMembers"
          WHERE (("CompanyMembers"."MemberId" IN ( SELECT "Members"."Id"
                   FROM public."Members"
                  WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false)))) AND ("CompanyMembers"."IsDeleted" = false))))))))));


--
-- Name: Bookings Property owners can manage their property bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Property owners can manage their property bookings" ON public."Bookings" USING ((EXISTS ( SELECT 1
   FROM (public."EstateProperties" ep
     JOIN public."Owners" o ON ((ep."OwnerId" = o."Id")))
  WHERE ((ep."Id" = "Bookings"."EstatePropertyId") AND (ep."IsDeleted" = false) AND (o."IsDeleted" = false) AND (((o."OwnerType" = 'member'::public."OwnerType") AND (o."MemberId" IN ( SELECT "Members"."Id"
           FROM public."Members"
          WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false))))) OR ((o."OwnerType" = 'company'::public."OwnerType") AND (o."CompanyId" IN ( SELECT "CompanyMembers"."CompanyId"
           FROM public."CompanyMembers"
          WHERE (("CompanyMembers"."MemberId" IN ( SELECT "Members"."Id"
                   FROM public."Members"
                  WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false)))) AND ("CompanyMembers"."IsDeleted" = false))))))))));


--
-- Name: ExternalCalendarEvents Property owners can view their external calendar events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Property owners can view their external calendar events" ON public."ExternalCalendarEvents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public."CalendarIntegrations" ci
     JOIN public."EstateProperties" ep ON ((ci."EstatePropertyId" = ep."Id")))
     JOIN public."Owners" o ON ((ep."OwnerId" = o."Id")))
  WHERE ((ci."Id" = "ExternalCalendarEvents"."CalendarIntegrationId") AND (ep."IsDeleted" = false) AND (o."IsDeleted" = false) AND (((o."OwnerType" = 'member'::public."OwnerType") AND (o."MemberId" IN ( SELECT "Members"."Id"
           FROM public."Members"
          WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false))))) OR ((o."OwnerType" = 'company'::public."OwnerType") AND (o."CompanyId" IN ( SELECT "CompanyMembers"."CompanyId"
           FROM public."CompanyMembers"
          WHERE (("CompanyMembers"."MemberId" IN ( SELECT "Members"."Id"
                   FROM public."Members"
                  WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false)))) AND ("CompanyMembers"."IsDeleted" = false))))))))));


--
-- Name: SyncJobs Property owners can view their sync jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Property owners can view their sync jobs" ON public."SyncJobs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public."CalendarIntegrations" ci
     JOIN public."EstateProperties" ep ON ((ci."EstatePropertyId" = ep."Id")))
     JOIN public."Owners" o ON ((ep."OwnerId" = o."Id")))
  WHERE ((ci."Id" = "SyncJobs"."CalendarIntegrationId") AND (ep."IsDeleted" = false) AND (o."IsDeleted" = false) AND (((o."OwnerType" = 'member'::public."OwnerType") AND (o."MemberId" IN ( SELECT "Members"."Id"
           FROM public."Members"
          WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false))))) OR ((o."OwnerType" = 'company'::public."OwnerType") AND (o."CompanyId" IN ( SELECT "CompanyMembers"."CompanyId"
           FROM public."CompanyMembers"
          WHERE (("CompanyMembers"."MemberId" IN ( SELECT "Members"."Id"
                   FROM public."Members"
                  WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false)))) AND ("CompanyMembers"."IsDeleted" = false))))))))));


--
-- Name: PropertyDocuments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PropertyDocuments" ENABLE ROW LEVEL SECURITY;

--
-- Name: PropertyDocuments PropertyDocuments_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyDocuments_admin_all" ON public."PropertyDocuments" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: PropertyDocuments PropertyDocuments_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyDocuments_user_delete" ON public."PropertyDocuments" FOR DELETE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: PropertyDocuments PropertyDocuments_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyDocuments_user_insert" ON public."PropertyDocuments" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: PropertyDocuments PropertyDocuments_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyDocuments_user_select" ON public."PropertyDocuments" FOR SELECT TO authenticated USING ((("IsDeleted" = false) AND public.user_can_manage_estate_property("EstatePropertyId")));


--
-- Name: PropertyDocuments PropertyDocuments_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyDocuments_user_update" ON public."PropertyDocuments" FOR UPDATE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId")) WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: PropertyImages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PropertyImages" ENABLE ROW LEVEL SECURITY;

--
-- Name: PropertyImages PropertyImages_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyImages_admin_all" ON public."PropertyImages" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: PropertyImages PropertyImages_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyImages_user_delete" ON public."PropertyImages" FOR DELETE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: PropertyImages PropertyImages_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyImages_user_insert" ON public."PropertyImages" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: PropertyImages PropertyImages_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyImages_user_select" ON public."PropertyImages" FOR SELECT TO authenticated USING ((("IsDeleted" = false) AND public.user_can_manage_estate_property("EstatePropertyId")));


--
-- Name: PropertyImages PropertyImages_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyImages_user_update" ON public."PropertyImages" FOR UPDATE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId")) WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: PropertyMessageLogs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PropertyMessageLogs" ENABLE ROW LEVEL SECURITY;

--
-- Name: PropertyMessageLogs PropertyMessageLogs_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyMessageLogs_admin_all" ON public."PropertyMessageLogs" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: PropertyMessageLogs PropertyMessageLogs_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyMessageLogs_anon_insert" ON public."PropertyMessageLogs" FOR INSERT TO anon WITH CHECK (true);


--
-- Name: PropertyMessageLogs PropertyMessageLogs_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyMessageLogs_user_insert" ON public."PropertyMessageLogs" FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: PropertyModerationActions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PropertyModerationActions" ENABLE ROW LEVEL SECURITY;

--
-- Name: PropertyModerationActions PropertyModerationActions_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyModerationActions_admin_all" ON public."PropertyModerationActions" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: PropertySearchScores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PropertySearchScores" ENABLE ROW LEVEL SECURITY;

--
-- Name: PropertySearchScores PropertySearchScores_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertySearchScores_admin_all" ON public."PropertySearchScores" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: PropertySearchScores PropertySearchScores_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertySearchScores_select_all" ON public."PropertySearchScores" FOR SELECT TO authenticated, anon USING (true);


--
-- Name: PropertySearchScores PropertySearchScores_write_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertySearchScores_write_service" ON public."PropertySearchScores" TO service_role USING (true) WITH CHECK (true);


--
-- Name: PropertyVideos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PropertyVideos" ENABLE ROW LEVEL SECURITY;

--
-- Name: PropertyVideos PropertyVideos_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyVideos_admin_all" ON public."PropertyVideos" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: PropertyVideos PropertyVideos_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyVideos_anon_select" ON public."PropertyVideos" FOR SELECT TO anon USING ((("IsDeleted" = false) AND public.is_public_estate_property("EstatePropertyId")));


--
-- Name: PropertyVideos PropertyVideos_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyVideos_user_delete" ON public."PropertyVideos" FOR DELETE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: PropertyVideos PropertyVideos_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyVideos_user_insert" ON public."PropertyVideos" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: PropertyVideos PropertyVideos_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyVideos_user_select" ON public."PropertyVideos" FOR SELECT TO authenticated USING ((("IsDeleted" = false) AND public.user_can_manage_estate_property("EstatePropertyId")));


--
-- Name: PropertyVideos PropertyVideos_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyVideos_user_update" ON public."PropertyVideos" FOR UPDATE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId")) WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: PropertyVisitLogs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PropertyVisitLogs" ENABLE ROW LEVEL SECURITY;

--
-- Name: PropertyVisitLogs PropertyVisitLogs_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyVisitLogs_admin_all" ON public."PropertyVisitLogs" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: PropertyVisitLogs PropertyVisitLogs_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyVisitLogs_anon_insert" ON public."PropertyVisitLogs" FOR INSERT TO anon WITH CHECK (true);


--
-- Name: PropertyVisitLogs PropertyVisitLogs_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyVisitLogs_user_insert" ON public."PropertyVisitLogs" FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: PropertyVisitLogs PropertyVisitLogs_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PropertyVisitLogs_user_select" ON public."PropertyVisitLogs" FOR SELECT TO authenticated USING (true);


--
-- Name: PropertyVisitLogs Public app can insert property visit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public app can insert property visit logs" ON public."PropertyVisitLogs" FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: RealEstateExtension; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RealEstateExtension" ENABLE ROW LEVEL SECURITY;

--
-- Name: RealEstateExtension RealEstateExtension_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RealEstateExtension_admin_all" ON public."RealEstateExtension" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: RealEstateExtension RealEstateExtension_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RealEstateExtension_anon_select" ON public."RealEstateExtension" FOR SELECT TO anon USING (public.is_public_estate_property("EstatePropertyId"));


--
-- Name: RealEstateExtension RealEstateExtension_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RealEstateExtension_user_delete" ON public."RealEstateExtension" FOR DELETE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: RealEstateExtension RealEstateExtension_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RealEstateExtension_user_insert" ON public."RealEstateExtension" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: RealEstateExtension RealEstateExtension_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RealEstateExtension_user_select" ON public."RealEstateExtension" FOR SELECT TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: RealEstateExtension RealEstateExtension_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RealEstateExtension_user_update" ON public."RealEstateExtension" FOR UPDATE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId")) WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: RecoveryCodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RecoveryCodes" ENABLE ROW LEVEL SECURITY;

--
-- Name: RecoveryCodes RecoveryCodes_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RecoveryCodes_admin_all" ON public."RecoveryCodes" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: RecoveryCodes RecoveryCodes_user_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RecoveryCodes_user_all" ON public."RecoveryCodes" TO authenticated USING (public.user_owns_auth_user_id("UserId")) WITH CHECK (public.user_owns_auth_user_id("UserId"));


--
-- Name: Reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Reviews" ENABLE ROW LEVEL SECURITY;

--
-- Name: Reviews Reviews_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reviews_admin_all" ON public."Reviews" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: Reviews Reviews_anon_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reviews_anon_all" ON public."Reviews" TO anon USING (true) WITH CHECK (true);


--
-- Name: Reviews Reviews_user_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reviews_user_all" ON public."Reviews" TO authenticated USING (true) WITH CHECK (true);


--
-- Name: SummerRentExtension; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."SummerRentExtension" ENABLE ROW LEVEL SECURITY;

--
-- Name: SummerRentExtension SummerRentExtension_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SummerRentExtension_admin_all" ON public."SummerRentExtension" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: SummerRentExtension SummerRentExtension_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SummerRentExtension_anon_select" ON public."SummerRentExtension" FOR SELECT TO anon USING (public.is_public_estate_property("EstatePropertyId"));


--
-- Name: SummerRentExtension SummerRentExtension_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SummerRentExtension_user_delete" ON public."SummerRentExtension" FOR DELETE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: SummerRentExtension SummerRentExtension_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SummerRentExtension_user_insert" ON public."SummerRentExtension" FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: SummerRentExtension SummerRentExtension_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SummerRentExtension_user_select" ON public."SummerRentExtension" FOR SELECT TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: SummerRentExtension SummerRentExtension_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SummerRentExtension_user_update" ON public."SummerRentExtension" FOR UPDATE TO authenticated USING (public.user_can_manage_estate_property("EstatePropertyId")) WITH CHECK (public.user_can_manage_estate_property("EstatePropertyId"));


--
-- Name: SyncJobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."SyncJobs" ENABLE ROW LEVEL SECURITY;

--
-- Name: SyncJobs SyncJobs_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SyncJobs_admin_all" ON public."SyncJobs" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: UsageRecords; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UsageRecords" ENABLE ROW LEVEL SECURITY;

--
-- Name: UsageRecords UsageRecords_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "UsageRecords_admin_all" ON public."UsageRecords" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: UsageRecords UsageRecords_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "UsageRecords_service_all" ON public."UsageRecords" TO service_role USING (true) WITH CHECK (true);


--
-- Name: UsageRecords UsageRecords_subject_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "UsageRecords_subject_insert" ON public."UsageRecords" FOR INSERT TO authenticated WITH CHECK ((("InvoiceId" IS NULL) AND (public.is_admin() OR (public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId") AND public.usage_reference_matches_billing_subject("SubjectType", "MemberOrCompanyId", "Type", "ReferenceId")))));


--
-- Name: UsageRecords UsageRecords_subject_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "UsageRecords_subject_select" ON public."UsageRecords" FOR SELECT TO authenticated USING (((("SubjectType" = 'member'::text) AND ("MemberOrCompanyId" IN ( SELECT m."Id"
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false))))) OR (("SubjectType" = 'company'::text) AND ("MemberOrCompanyId" IN ( SELECT cm."CompanyId"
   FROM (public."CompanyMembers" cm
     JOIN public."Members" m ON (((m."Id" = cm."MemberId") AND (m."IsDeleted" = false))))
  WHERE ((m."UserId" = auth.uid()) AND (cm."IsDeleted" = false)))))));


--
-- Name: UsageRecords UsageRecords_subject_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "UsageRecords_subject_update" ON public."UsageRecords" FOR UPDATE TO authenticated USING ((("InvoiceId" IS NULL) AND (public.is_admin() OR (public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId") AND public.usage_reference_matches_billing_subject("SubjectType", "MemberOrCompanyId", "Type", "ReferenceId"))))) WITH CHECK ((("InvoiceId" IS NULL) AND (public.is_admin() OR (public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId") AND public.usage_reference_matches_billing_subject("SubjectType", "MemberOrCompanyId", "Type", "ReferenceId")))));


--
-- Name: UserApps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."UserApps" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserApps UserApps_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "UserApps_admin_all" ON public."UserApps" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: UserApps UserApps_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "UserApps_user_insert" ON public."UserApps" FOR INSERT TO authenticated WITH CHECK (("UserId" = auth.uid()));


--
-- Name: UserApps UserApps_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "UserApps_user_select" ON public."UserApps" FOR SELECT TO authenticated USING (("UserId" = auth.uid()));


--
-- Name: UserApps UserApps_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "UserApps_user_update" ON public."UserApps" FOR UPDATE TO authenticated USING (("UserId" = auth.uid())) WITH CHECK (("UserId" = auth.uid()));


--
-- Name: Bookings Users can create their own bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own bookings" ON public."Bookings" FOR INSERT WITH CHECK (("GuestId" IN ( SELECT m."Id"
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false)))));


--
-- Name: Owners Users can create their own owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own owners" ON public."Owners" FOR INSERT WITH CHECK (((("OwnerType" = 'member'::public."OwnerType") AND ("MemberId" IN ( SELECT "Members"."Id"
   FROM public."Members"
  WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false))))) OR (("OwnerType" = 'company'::public."OwnerType") AND ("CompanyId" IN ( SELECT "CompanyMembers"."CompanyId"
   FROM public."CompanyMembers"
  WHERE (("CompanyMembers"."MemberId" IN ( SELECT "Members"."Id"
           FROM public."Members"
          WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false)))) AND ("CompanyMembers"."IsDeleted" = false)))))));


--
-- Name: VerificationCodes Users can delete own verification codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own verification codes" ON public."VerificationCodes" FOR DELETE USING ((auth.uid() = "UserId"));


--
-- Name: Owners Users can delete their own owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own owners" ON public."Owners" FOR UPDATE USING (((("OwnerType" = 'member'::public."OwnerType") AND ("MemberId" IN ( SELECT "Members"."Id"
   FROM public."Members"
  WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false))))) OR (("OwnerType" = 'company'::public."OwnerType") AND ("CompanyId" IN ( SELECT "CompanyMembers"."CompanyId"
   FROM public."CompanyMembers"
  WHERE (("CompanyMembers"."MemberId" IN ( SELECT "Members"."Id"
           FROM public."Members"
          WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false)))) AND ("CompanyMembers"."IsDeleted" = false)))))));


--
-- Name: UserApps Users can insert own UserApps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own UserApps" ON public."UserApps" FOR INSERT WITH CHECK (("UserId" = auth.uid()));


--
-- Name: VerificationCodes Users can insert own verification codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own verification codes" ON public."VerificationCodes" FOR INSERT WITH CHECK ((auth.uid() = "UserId"));


--
-- Name: UserApps Users can select own UserApps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can select own UserApps" ON public."UserApps" FOR SELECT USING (("UserId" = auth.uid()));


--
-- Name: VerificationCodes Users can update own verification codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own verification codes" ON public."VerificationCodes" FOR UPDATE USING ((auth.uid() = "UserId"));


--
-- Name: Bookings Users can update their own bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own bookings" ON public."Bookings" FOR UPDATE USING (("GuestId" IN ( SELECT m."Id"
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false))))) WITH CHECK (("GuestId" IN ( SELECT m."Id"
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false)))));


--
-- Name: Members Users can update their own member record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own member record" ON public."Members" FOR UPDATE USING ((auth.uid() = "UserId"));


--
-- Name: Owners Users can update their own owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own owners" ON public."Owners" FOR UPDATE USING (((("OwnerType" = 'member'::public."OwnerType") AND ("MemberId" IN ( SELECT "Members"."Id"
   FROM public."Members"
  WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false))))) OR (("OwnerType" = 'company'::public."OwnerType") AND ("CompanyId" IN ( SELECT "CompanyMembers"."CompanyId"
   FROM public."CompanyMembers"
  WHERE (("CompanyMembers"."MemberId" IN ( SELECT "Members"."Id"
           FROM public."Members"
          WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false)))) AND ("CompanyMembers"."IsDeleted" = false)))))));


--
-- Name: VerificationCodes Users can view own verification codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own verification codes" ON public."VerificationCodes" FOR SELECT USING ((auth.uid() = "UserId"));


--
-- Name: Bookings Users can view their own bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own bookings" ON public."Bookings" FOR SELECT USING (("GuestId" IN ( SELECT m."Id"
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."IsDeleted" = false)))));


--
-- Name: MemberForceLogout Users can view their own force logout; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own force logout" ON public."MemberForceLogout" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."UserId" = auth.uid()) AND (m."Id" = "MemberForceLogout"."MemberId") AND (m."IsDeleted" = false)))));


--
-- Name: Members Users can view their own member record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own member record" ON public."Members" FOR SELECT USING ((auth.uid() = "UserId"));


--
-- Name: Owners Users can view their own owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own owners" ON public."Owners" FOR SELECT USING (((("OwnerType" = 'member'::public."OwnerType") AND ("MemberId" IN ( SELECT "Members"."Id"
   FROM public."Members"
  WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false))))) OR (("OwnerType" = 'company'::public."OwnerType") AND ("CompanyId" IN ( SELECT "CompanyMembers"."CompanyId"
   FROM public."CompanyMembers"
  WHERE (("CompanyMembers"."MemberId" IN ( SELECT "Members"."Id"
           FROM public."Members"
          WHERE (("Members"."UserId" = auth.uid()) AND ("Members"."IsDeleted" = false)))) AND ("CompanyMembers"."IsDeleted" = false)))))));


--
-- Name: VerificationCodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."VerificationCodes" ENABLE ROW LEVEL SECURITY;

--
-- Name: VerificationCodes VerificationCodes_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "VerificationCodes_admin_all" ON public."VerificationCodes" TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: VerificationCodes VerificationCodes_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "VerificationCodes_anon_select" ON public."VerificationCodes" FOR SELECT TO anon USING (true);


--
-- Name: VerificationCodes VerificationCodes_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "VerificationCodes_user_select" ON public."VerificationCodes" FOR SELECT TO authenticated USING (("UserId" = auth.uid()));


--
-- Name: WebhookEvents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."WebhookEvents" ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_events analytics_events_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_events_admin_all ON public.analytics_events TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: analytics_events analytics_events_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_events_user_select ON public.analytics_events FOR SELECT TO authenticated USING (true);


--
-- Name: booking_holds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_holds ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_holds booking_holds_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_holds_admin_all ON public.booking_holds TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: booking_holds booking_holds_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_holds_anon_insert ON public.booking_holds FOR INSERT TO anon WITH CHECK (true);


--
-- Name: booking_holds booking_holds_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_holds_anon_select ON public.booking_holds FOR SELECT TO anon USING (true);


--
-- Name: booking_holds booking_holds_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_holds_user_insert ON public.booking_holds FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: booking_holds booking_holds_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_holds_user_select ON public.booking_holds FOR SELECT TO authenticated USING (true);


--
-- Name: booking_manage_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_manage_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_manage_tokens booking_manage_tokens_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_manage_tokens_admin_all ON public.booking_manage_tokens TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: booking_manage_tokens booking_manage_tokens_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_manage_tokens_anon_insert ON public.booking_manage_tokens FOR INSERT TO anon WITH CHECK (true);


--
-- Name: booking_manage_tokens booking_manage_tokens_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_manage_tokens_anon_select ON public.booking_manage_tokens FOR SELECT TO anon USING (true);


--
-- Name: booking_manage_tokens booking_manage_tokens_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_manage_tokens_user_insert ON public.booking_manage_tokens FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: booking_manage_tokens booking_manage_tokens_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_manage_tokens_user_select ON public.booking_manage_tokens FOR SELECT TO authenticated USING (true);


--
-- Name: booking_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_rate_limits booking_rate_limits_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_rate_limits_admin_all ON public.booking_rate_limits TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: booking_rate_limits booking_rate_limits_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_rate_limits_anon_select ON public.booking_rate_limits FOR SELECT TO anon USING (true);


--
-- Name: booking_rate_limits booking_rate_limits_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_rate_limits_user_select ON public.booking_rate_limits FOR SELECT TO authenticated USING (true);


--
-- Name: Companies companies_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_delete_policy ON public."Companies" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public."CompanyMembers" cm
     JOIN public."Members" m ON (((m."Id" = cm."MemberId") AND (m."IsDeleted" = false))))
  WHERE ((cm."CompanyId" = "Companies"."Id") AND (cm."IsDeleted" = false) AND (cm."Role" = ANY (ARRAY['Admin'::text, 'Manager'::text])) AND (m."UserId" = auth.uid())))));


--
-- Name: Companies companies_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_select_policy ON public."Companies" FOR SELECT USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM (public."CompanyMembers" cm
     JOIN public."Members" m ON (((m."Id" = cm."MemberId") AND (m."IsDeleted" = false))))
  WHERE ((cm."CompanyId" = "Companies"."Id") AND (cm."IsDeleted" = false) AND (m."UserId" = auth.uid()))))));


--
-- Name: Companies companies_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_update_policy ON public."Companies" FOR UPDATE USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM (public."CompanyMembers" cm
     JOIN public."Members" m ON (((m."Id" = cm."MemberId") AND (m."IsDeleted" = false))))
  WHERE ((cm."CompanyId" = "Companies"."Id") AND (cm."IsDeleted" = false) AND (cm."Role" = ANY (ARRAY['Admin'::text, 'Manager'::text])) AND (m."UserId" = auth.uid())))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM (public."CompanyMembers" cm
     JOIN public."Members" m ON (((m."Id" = cm."MemberId") AND (m."IsDeleted" = false))))
  WHERE ((cm."CompanyId" = "Companies"."Id") AND (cm."IsDeleted" = false) AND (cm."Role" = ANY (ARRAY['Admin'::text, 'Manager'::text])) AND (m."UserId" = auth.uid()))))));


--
-- Name: CompanyMembers company_members_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_members_insert_policy ON public."CompanyMembers" FOR INSERT WITH CHECK ((public.is_admin() OR public.is_company_manager("CompanyId")));


--
-- Name: CompanyMembers company_members_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_members_select_policy ON public."CompanyMembers" FOR SELECT USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public."Members" m
  WHERE ((m."Id" = "CompanyMembers"."MemberId") AND (m."IsDeleted" = false) AND (m."UserId" = auth.uid())))) OR public.is_company_manager("CompanyId")));


--
-- Name: CompanyMembers company_members_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_members_update_policy ON public."CompanyMembers" FOR UPDATE USING ((public.is_admin() OR public.is_company_manager("CompanyId"))) WITH CHECK ((public.is_admin() OR public.is_company_manager("CompanyId")));


--
-- Name: otp_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: otp_rate_limits otp_rate_limits_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY otp_rate_limits_admin_all ON public.otp_rate_limits TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: otp_rate_limits otp_rate_limits_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY otp_rate_limits_anon_select ON public.otp_rate_limits FOR SELECT TO anon USING (true);


--
-- Name: otp_rate_limits otp_rate_limits_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY otp_rate_limits_user_select ON public.otp_rate_limits FOR SELECT TO authenticated USING (true);


--
-- Name: otp_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.otp_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: otp_requests otp_requests_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY otp_requests_admin_all ON public.otp_requests TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: otp_requests otp_requests_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY otp_requests_anon_insert ON public.otp_requests FOR INSERT TO anon WITH CHECK (true);


--
-- Name: otp_requests otp_requests_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY otp_requests_anon_select ON public.otp_requests FOR SELECT TO anon USING (true);


--
-- Name: otp_requests otp_requests_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY otp_requests_user_insert ON public.otp_requests FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: otp_requests otp_requests_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY otp_requests_user_select ON public.otp_requests FOR SELECT TO authenticated USING (true);


--
-- Name: propertydetailssection; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.propertydetailssection ENABLE ROW LEVEL SECURITY;

--
-- Name: propertydetailssection propertydetailssection_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY propertydetailssection_admin_all ON public.propertydetailssection TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: propertydetailssection propertydetailssection_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY propertydetailssection_anon_select ON public.propertydetailssection FOR SELECT TO anon USING (((isdeleted = false) AND public.is_public_estate_property(propertyid)));


--
-- Name: propertydetailssection propertydetailssection_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY propertydetailssection_user_delete ON public.propertydetailssection FOR DELETE TO authenticated USING (public.user_can_manage_estate_property(propertyid));


--
-- Name: propertydetailssection propertydetailssection_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY propertydetailssection_user_insert ON public.propertydetailssection FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_estate_property(propertyid));


--
-- Name: propertydetailssection propertydetailssection_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY propertydetailssection_user_select ON public.propertydetailssection FOR SELECT TO authenticated USING (((isdeleted = false) AND public.user_can_manage_estate_property(propertyid)));


--
-- Name: propertydetailssection propertydetailssection_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY propertydetailssection_user_update ON public.propertydetailssection FOR UPDATE TO authenticated USING (public.user_can_manage_estate_property(propertyid)) WITH CHECK (public.user_can_manage_estate_property(propertyid));


--
-- Name: propertysectionimages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.propertysectionimages ENABLE ROW LEVEL SECURITY;

--
-- Name: propertysectionimages propertysectionimages_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY propertysectionimages_admin_all ON public.propertysectionimages TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: propertysectionimages propertysectionimages_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY propertysectionimages_anon_select ON public.propertysectionimages FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public.propertydetailssection s
  WHERE ((s.id = propertysectionimages.sectionid) AND (s.isdeleted = false) AND public.is_public_estate_property(s.propertyid)))));


--
-- Name: propertysectionimages propertysectionimages_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY propertysectionimages_user_delete ON public.propertysectionimages FOR DELETE TO authenticated USING (public.user_can_manage_property_section(sectionid));


--
-- Name: propertysectionimages propertysectionimages_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY propertysectionimages_user_insert ON public.propertysectionimages FOR INSERT TO authenticated WITH CHECK (public.user_can_manage_property_section(sectionid));


--
-- Name: propertysectionimages propertysectionimages_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY propertysectionimages_user_select ON public.propertysectionimages FOR SELECT TO authenticated USING (public.user_can_manage_property_section(sectionid));


--
-- Name: propertysectionimages propertysectionimages_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY propertysectionimages_user_update ON public.propertysectionimages FOR UPDATE TO authenticated USING (public.user_can_manage_property_section(sectionid)) WITH CHECK (public.user_can_manage_property_section(sectionid));


--
-- PostgreSQL database dump complete
--


-- =============================================================================
-- Non-public appendix: auth.users -> Members sync
-- (from tasks/migrations_save/20260518120000_members_row_on_auth_user_insert.sql)
-- =============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Non-public appendix: storage buckets + RLS
-- (from tasks/migrations_save/20260611120200_storage_buckets_rls.sql)
-- =============================================================================

-- Local / hosted Supabase Storage buckets for property media and avatars.
-- Prod uploads may use Cloudflare R2 instead; these buckets support local dev (VITE_STORAGE_BACKEND=supabase).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'property-images',
    'property-images',
    true,
    52428800,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/svg+xml']::text[]
  ),
  ('property-documents', 'property-documents', true, 52428800, null),
  (
    'avatars',
    'avatars',
    true,
    8388608,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read (anon + authenticated) for public buckets
drop policy if exists "storage_property_images_select" on storage.objects;
create policy "storage_property_images_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'property-images');

drop policy if exists "storage_property_documents_select" on storage.objects;
create policy "storage_property_documents_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'property-documents');

drop policy if exists "storage_avatars_select" on storage.objects;
create policy "storage_avatars_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

-- Authenticated writes: property buckets under properties/*
drop policy if exists "storage_property_images_insert" on storage.objects;
create policy "storage_property_images_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'property-images'
    and name like 'properties/%'
    and position('..' in name) = 0
  );

drop policy if exists "storage_property_images_update" on storage.objects;
create policy "storage_property_images_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'property-images'
    and name like 'properties/%'
  )
  with check (
    bucket_id = 'property-images'
    and name like 'properties/%'
    and position('..' in name) = 0
  );

drop policy if exists "storage_property_images_delete" on storage.objects;
create policy "storage_property_images_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'property-images'
    and name like 'properties/%'
  );

drop policy if exists "storage_property_documents_insert" on storage.objects;
create policy "storage_property_documents_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'property-documents'
    and name like 'properties/%'
    and position('..' in name) = 0
  );

drop policy if exists "storage_property_documents_update" on storage.objects;
create policy "storage_property_documents_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'property-documents'
    and name like 'properties/%'
  )
  with check (
    bucket_id = 'property-documents'
    and name like 'properties/%'
    and position('..' in name) = 0
  );

drop policy if exists "storage_property_documents_delete" on storage.objects;
create policy "storage_property_documents_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'property-documents'
    and name like 'properties/%'
  );

-- Avatars: user-scoped prefix {auth.uid()}/
drop policy if exists "storage_avatars_insert" on storage.objects;
create policy "storage_avatars_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name like auth.uid()::text || '/%'
    and position('..' in name) = 0
  );

drop policy if exists "storage_avatars_update" on storage.objects;
create policy "storage_avatars_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and name like auth.uid()::text || '/%'
  )
  with check (
    bucket_id = 'avatars'
    and name like auth.uid()::text || '/%'
    and position('..' in name) = 0
  );

drop policy if exists "storage_avatars_delete" on storage.objects;
create policy "storage_avatars_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and name like auth.uid()::text || '/%'
  );
