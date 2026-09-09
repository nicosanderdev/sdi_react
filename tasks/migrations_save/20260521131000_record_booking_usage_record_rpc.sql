-- Record booking UsageRecords via security definer (bypasses RLS on insert).
-- Use when admin confirms a booking for another member's property.
-- Apply manually after 20260520120001.

begin;

create or replace function public.record_booking_usage_record(
  p_booking_id uuid,
  p_estate_property_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

comment on function public.record_booking_usage_record(uuid, uuid) is
  'Inserts booking UsageRecords row when subject plan is per_booking/hybrid. Idempotent on conflict.';

grant execute on function public.record_booking_usage_record(uuid, uuid)
  to authenticated, service_role;

-- Harden is_admin for Role stored as text with mixed case
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and lower(trim(m."Role"::text)) = 'admin'
  );
$$;

-- Booking usage reference: treat null IsDeleted as not deleted
create or replace function public.usage_reference_matches_billing_subject(
  p_subject_type text,
  p_subject_id uuid,
  p_type text,
  p_reference_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

commit;
