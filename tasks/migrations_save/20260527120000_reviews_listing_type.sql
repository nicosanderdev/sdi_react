-- Reviews and guest reservation flows scoped by listing type (RealEstate, SummerRent, EventVenue).
-- Prerequisite: 20260526130000_fix_issue_booking_manage_token_pgcrypto.sql (and prior guest migrations).
-- Trips/client app must set booking_holds.listing_type when creating holds.
-- NOTE: Manual execution by project owner (idempotent).

begin;

-- ---------------------------------------------------------------------------
-- 1) Schema — Reviews, Bookings, booking_holds
-- ---------------------------------------------------------------------------
alter table public."Reviews"
  add column if not exists "ListingType" public."ListingType";

create index if not exists "IX_Reviews_EstatePropertyId_ListingType"
  on public."Reviews" using btree ("EstatePropertyId", "ListingType")
  where "ListingType" is not null;

comment on table public."Reviews" is
  'One review per booking. GuestId references Members.Id or Guests.Id. ListingType scopes reviews per property modality (guest sites: RealEstate, SummerRent, EventVenue).';

alter table public."Bookings"
  add column if not exists "ListingType" public."ListingType";

do $$
begin
  if to_regclass('public.booking_holds') is not null then
    alter table public.booking_holds
      add column if not exists listing_type text;

    comment on column public.booking_holds.listing_type is
      'Site listing modality when the hold was created (RealEstate, SummerRent, or EventVenue). Required for guest review lookup when Bookings.ListingType is unset.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Helpers
-- ---------------------------------------------------------------------------
create or replace function public.validate_guest_site_listing_type(p_listing_type text)
returns public."ListingType"
language plpgsql
immutable
as $$
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

create or replace function public.booking_matches_guest_site_listing_type(
  p_booking_listing_type public."ListingType",
  p_property_id uuid,
  p_check_in timestamp with time zone,
  p_check_out timestamp with time zone,
  p_requested_listing_type public."ListingType"
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
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

-- ---------------------------------------------------------------------------
-- 3) confirm_booking_from_hold — snapshot ListingType from hold
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
-- 4) get_reservation_by_code — requires site listing type
-- ---------------------------------------------------------------------------
drop function if exists public.get_reservation_by_code(text);

create or replace function public.get_reservation_by_code(
  reservation_code text,
  p_listing_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_listing_type public."ListingType";
  v_booking record;
  v_status text;
  v_is_expired boolean := false;
  v_has_existing_review boolean := false;
  v_can_submit_guest_review boolean := false;
  v_profile jsonb;
  v_guest_name text;
  v_guest_email text;
  v_guest_phone text;
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
    b."CheckInDate" as check_in,
    b."CheckOutDate" as check_out,
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
    and not v_has_existing_review
    and v_booking.guest_id is not null;

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
-- 5) create_guest_review_by_reservation_code — persist ListingType
-- ---------------------------------------------------------------------------
drop function if exists public.create_guest_review_by_reservation_code(
  text, text, integer, text
);

create or replace function public.create_guest_review_by_reservation_code(
  p_reservation_code text,
  p_guest_email text,
  p_rating integer,
  p_comment text,
  p_listing_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_listing_type public."ListingType";
  v_booking record;
  v_guest_email text;
  v_profile_email text;
  v_review_id uuid;
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

  if v_booking.check_out::date > current_date then
    return jsonb_build_object('success', false, 'error', 'Checkout has not passed');
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
$$;

-- ---------------------------------------------------------------------------
-- 6) Grants
-- ---------------------------------------------------------------------------
grant execute on function public.validate_guest_site_listing_type(text)
  to anon, authenticated, service_role;

grant execute on function public.booking_matches_guest_site_listing_type(
  public."ListingType", uuid, timestamp with time zone, timestamp with time zone, public."ListingType"
)
  to anon, authenticated, service_role;

grant execute on function public.confirm_booking_from_hold(uuid, jsonb)
  to anon, authenticated, service_role;

grant execute on function public.get_reservation_by_code(text, text)
  to anon, authenticated, service_role;

grant execute on function public.create_guest_review_by_reservation_code(
  text, text, integer, text, text
)
  to anon, authenticated, service_role;

commit;
