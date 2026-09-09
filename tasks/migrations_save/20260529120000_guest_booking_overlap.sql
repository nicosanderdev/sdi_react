-- Guest cross-property booking overlap (half-open date ranges; adjacent stays allowed).
-- Prerequisite: 20260528120000_guest_review_48h_window.sql (already applied).
-- NOTE: Manual execution by project owner (idempotent).

begin;

-- ---------------------------------------------------------------------------
-- 1) guest_has_overlapping_booking
-- ---------------------------------------------------------------------------
create or replace function public.guest_has_overlapping_booking(
  p_guest_id uuid,
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_exclude_booking_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

comment on function public.guest_has_overlapping_booking(uuid, timestamptz, timestamptz, uuid) is
  'True when the guest has a non-cancelled booking overlapping [check_in, check_out) (half-open; same-day checkout/check-in allowed).';

-- ---------------------------------------------------------------------------
-- 2) validate_guest_booking_overlap — pre-check by email before hold/OTP
-- ---------------------------------------------------------------------------
create or replace function public.validate_guest_booking_overlap(
  p_email text,
  p_check_in timestamptz,
  p_check_out timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

comment on function public.validate_guest_booking_overlap(text, timestamptz, timestamptz) is
  'Pre-check whether a guest email already has overlapping non-cancelled bookings for the date range.';

-- ---------------------------------------------------------------------------
-- 3) confirm_booking_from_hold — enforce overlap after guest upsert
-- ---------------------------------------------------------------------------
drop function if exists public.confirm_booking_from_hold(uuid, jsonb);

create or replace function public.confirm_booking_from_hold(
  p_hold_id uuid,
  p_guest_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

-- ---------------------------------------------------------------------------
-- 4) Grants
-- ---------------------------------------------------------------------------
grant execute on function public.guest_has_overlapping_booking(
  uuid, timestamptz, timestamptz, uuid
) to anon, authenticated, service_role;

grant execute on function public.validate_guest_booking_overlap(
  text, timestamptz, timestamptz
) to anon, authenticated, service_role;

grant execute on function public.confirm_booking_from_hold(uuid, jsonb)
  to anon, authenticated, service_role;

commit;
