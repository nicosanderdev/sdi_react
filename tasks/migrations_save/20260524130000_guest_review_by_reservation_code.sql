-- Guest review by reservation code: Reviews guest columns, extended lookup, submit RPC.
-- Prerequisite: 20260524120000_guest_reservation_code_lookup.sql (ReservationCode + get_reservation_by_code).
-- NOTE: Manual execution by project owner (idempotent).

begin;

-- ---------------------------------------------------------------------------
-- 1) Reviews — guest-submitted rows (nullable UserId, GuestName, GuestEmail)
-- ---------------------------------------------------------------------------
alter table public."Reviews"
  add column if not exists "GuestName" text,
  add column if not exists "GuestEmail" text;

alter table public."Reviews"
  alter column "UserId" drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'CHK_Reviews_MemberOrGuest'
  ) then
    alter table public."Reviews"
      add constraint "CHK_Reviews_MemberOrGuest"
      check (
        (
          "UserId" is not null
        )
        or (
          "UserId" is null
          and "GuestName" is not null
          and length(trim("GuestName")) > 0
          and "GuestEmail" is not null
          and length(trim("GuestEmail")) > 0
        )
      );
  end if;
end $$;

comment on table public."Reviews" is
  'One review per booking. Member reviews (UserId set) require completed paid stay via create_review. Guest reviews (UserId null, GuestName/GuestEmail) via reservation code lookup after checkout.';

-- ---------------------------------------------------------------------------
-- 2) get_reservation_by_code — add review eligibility fields
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
  v_has_existing_review boolean := false;
  v_can_submit_guest_review boolean := false;
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
    b."IsDeleted" as is_deleted,
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

  select exists (
    select 1
    from public."Reviews" r
    where r."BookingId" = v_booking.booking_id
  )
  into v_has_existing_review;

  v_can_submit_guest_review :=
    not coalesce(v_booking.is_deleted, false)
    and v_booking.status_code in (1, 3)
    and v_booking.check_out::date <= current_date
    and not v_has_existing_review;

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
      'isExpired', v_is_expired,
      'isDeleted', coalesce(v_booking.is_deleted, false),
      'hasExistingReview', v_has_existing_review,
      'canSubmitGuestReview', v_can_submit_guest_review
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) create_guest_review_by_reservation_code — anon-safe guest submit
-- ---------------------------------------------------------------------------
create or replace function public.create_guest_review_by_reservation_code(
  p_reservation_code text,
  p_guest_email text,
  p_guest_name text,
  p_rating integer,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_booking record;
  v_guest_email text;
  v_review_id uuid;
begin
  v_code := upper(trim(coalesce(p_reservation_code, '')));

  if v_code = '' or v_code !~ '^RSV-[A-Z0-9]{6}$' then
    return jsonb_build_object('success', false, 'error', 'Invalid reservation code format');
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('success', false, 'error', 'Rating must be between 1 and 5');
  end if;

  if coalesce(trim(p_guest_name), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Guest name is required');
  end if;

  if coalesce(trim(p_comment), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Comment is required');
  end if;

  if coalesce(trim(p_guest_email), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Guest email does not match');
  end if;

  select
    b."Id" as booking_id,
    b."EstatePropertyId" as estate_property_id,
    b."Status" as status_code,
    b."CheckOutDate" as check_out,
    b."IsDeleted" as is_deleted,
    lower(trim(coalesce(m."Email", h.email))) as guest_email
  into v_booking
  from public."Bookings" b
  left join public."Members" m
    on m."Id" = b."GuestId"
   and m."IsDeleted" = false
  left join lateral (
    select bh.email
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

  if coalesce(v_booking.is_deleted, false) then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if v_booking.status_code not in (1, 3) then
    return jsonb_build_object('success', false, 'error', 'Booking not eligible for review');
  end if;

  if v_booking.check_out::date > current_date then
    return jsonb_build_object('success', false, 'error', 'Checkout has not passed');
  end if;

  v_guest_email := lower(trim(p_guest_email));

  if v_guest_email = ''
     or v_booking.guest_email is null
     or v_guest_email <> v_booking.guest_email then
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
      "UserId",
      "EstatePropertyId",
      "Rating",
      "Comment",
      "GuestName",
      "GuestEmail"
    ) values (
      v_booking.booking_id,
      null,
      v_booking.estate_property_id,
      p_rating,
      trim(p_comment),
      trim(p_guest_name),
      v_guest_email
    )
    returning "Id" into v_review_id;
  exception
    when unique_violation then
      return jsonb_build_object('success', false, 'error', 'Review already exists');
  end;

  return jsonb_build_object(
    'success', true,
    'reviewId', v_review_id
  );
end;
$$;

grant execute on function public.get_reservation_by_code(text)
  to anon, authenticated, service_role;

grant execute on function public.create_guest_review_by_reservation_code(
  text, text, text, integer, text
) to anon, authenticated, service_role;

commit;
