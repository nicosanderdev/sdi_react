-- Reviews schema alignment + get_reservation_by_code fix.
-- Reviews uses CreatedAt (not Created); guest review lookup referenced the wrong column.
-- Prerequisite: 20260601120000_host_contact_for_guests.sql (already applied).
-- NOTE: Manual execution by project owner (idempotent).

begin;

alter table public."Reviews"
  add column if not exists "LastModified" timestamptz;

comment on column public."Reviews"."LastModified" is
  'Set when a guest or member updates an existing review; null until first edit.';

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
$$;

grant execute on function public.get_reservation_by_code(text, text)
  to anon, authenticated, service_role;

commit;
