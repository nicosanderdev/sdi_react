-- Guest reservation lookup: ReservationCode column, lookup RPCs, confirm_booking_from_hold fix.
-- Prerequisite: booking_holds, booking_manage_tokens, issue_booking_manage_token (guest booking flow).

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Canonical lookup column on Bookings
-- ---------------------------------------------------------------------------
alter table public."Bookings"
  add column if not exists "ReservationCode" text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'CHK_Bookings_ReservationCode_Format'
  ) then
    alter table public."Bookings"
      add constraint "CHK_Bookings_ReservationCode_Format"
      check (
        "ReservationCode" is null
        or "ReservationCode" ~ '^RSV-[A-Z0-9]{6}$'
      );
  end if;
end $$;

update public."Bookings" b
set "ReservationCode" = upper(substring(b."Notes" from '(RSV-[A-Za-z0-9]{6})'))
where b."ReservationCode" is null
  and b."Notes" ~* 'RSV-[A-Za-z0-9]{6}';

create unique index if not exists "UX_Bookings_ReservationCode_Active"
  on public."Bookings" ("ReservationCode")
  where "IsDeleted" = false
    and "ReservationCode" is not null;

create index if not exists "IX_Bookings_ReservationCode"
  on public."Bookings" ("ReservationCode")
  where "IsDeleted" = false;

-- ---------------------------------------------------------------------------
-- 2) confirm_booking_from_hold — persist ReservationCode on insert
-- ---------------------------------------------------------------------------
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
  v_manage_token jsonb;
  v_reservation_code text;
  v_estimated_guests integer;
  v_attempt integer := 0;
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

  v_estimated_guests := coalesce(
    (p_guest_payload->>'estimatedGuests')::integer,
    v_hold.estimated_guests
  );

  loop
    v_attempt := v_attempt + 1;
    v_reservation_code := 'RSV-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

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
    "ReservationCode"
  ) values (
    v_hold.property_id,
    null,
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
    v_reservation_code
  )
  returning "Id" into v_booking_id;

  update public.booking_holds
  set
    status = 'confirmed',
    full_name = p_guest_payload->>'fullName',
    email = p_guest_payload->>'email',
    phone = p_guest_payload->>'phone',
    document_id = p_guest_payload->>'documentId',
    estimated_guests = v_estimated_guests,
    updated_at = now()
  where id = p_hold_id;

  v_manage_token := public.issue_booking_manage_token(v_booking_id);

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'reservation_code', v_reservation_code,
    'manage_token', v_manage_token->>'token',
    'manage_expires_at', v_manage_token->>'expires_at'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) get_reservation_by_code — visitor lookup (sdi_trips bookingService contract)
-- ---------------------------------------------------------------------------
create or replace function public.get_reservation_by_code(reservation_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_booking record;
  v_status text;
  v_is_expired boolean := false;
begin
  v_code := upper(trim(coalesce(reservation_code, '')));

  if v_code = '' or v_code !~ '^RSV-[A-Z0-9]{6}$' then
    return jsonb_build_object('success', false, 'error', 'Invalid reservation code format');
  end if;

  select
    b."Id" as booking_id,
    b."ReservationCode" as reservation_code,
    b."EstatePropertyId" as property_id,
    l."Title" as property_title,
    b."CheckInDate" as check_in,
    b."CheckOutDate" as check_out,
    b."Status" as status_code,
    coalesce(
      nullif(trim(coalesce(m."FirstName", '') || ' ' || coalesce(m."LastName", '')), ''),
      h.full_name
    ) as guest_name,
    coalesce(m."Email", h.email) as guest_email,
    coalesce(m."Phone", h.phone) as guest_phone
  into v_booking
  from public."Bookings" b
  left join lateral (
    select l2."Title"
    from public."Listings" l2
    where l2."EstatePropertyId" = b."EstatePropertyId"
      and l2."IsDeleted" = false
    order by l2."IsActive" desc nulls last, l2."Created" desc nulls last
    limit 1
  ) l on true
  left join public."Members" m
    on m."Id" = b."GuestId"
   and m."IsDeleted" = false
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

  v_status := case v_booking.status_code
    when 0 then 'pending'
    when 1 then 'confirmed'
    when 2 then 'cancelled'
    when 3 then 'completed'
    else 'unknown'
  end;

  if v_booking.check_out < current_date then
    v_is_expired := true;
  end if;

  if v_is_expired and v_status not in ('cancelled', 'completed') then
    return jsonb_build_object('success', false, 'error', 'Reservation expired');
  end if;

  return jsonb_build_object(
    'success', true,
    'reservation', jsonb_build_object(
      'bookingId', v_booking.booking_id,
      'reservationCode', v_booking.reservation_code,
      'propertyId', v_booking.property_id,
      'propertyTitle', coalesce(v_booking.property_title, 'Property'),
      'checkIn', v_booking.check_in,
      'checkOut', v_booking.check_out,
      'status', v_status,
      'guestName', v_booking.guest_name,
      'guestEmail', v_booking.guest_email,
      'guestPhone', v_booking.guest_phone,
      'canCancel', (v_booking.status_code in (0, 1) and v_booking.check_in >= current_date),
      'isExpired', v_is_expired
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) cancel_reservation — cancel by booking id (code lookup flow)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_reservation(reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

-- ---------------------------------------------------------------------------
-- 5) Manage-token RPCs (replace stubs if present)
-- ---------------------------------------------------------------------------
create or replace function public.get_booking_by_manage_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_hash text;
  v_booking_id uuid;
  v_row record;
  v_status text;
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
      'canCancel', (v_row.status_code in (0, 1) and v_row.check_in >= current_date)
    )
  );
end;
$$;

create or replace function public.cancel_booking_by_manage_token(
  p_token text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function public.get_reservation_by_code(text) to anon, authenticated, service_role;
grant execute on function public.cancel_reservation(uuid) to anon, authenticated, service_role;
grant execute on function public.get_booking_by_manage_token(text) to anon, authenticated, service_role;
grant execute on function public.cancel_booking_by_manage_token(text, text) to anon, authenticated, service_role;

commit;
