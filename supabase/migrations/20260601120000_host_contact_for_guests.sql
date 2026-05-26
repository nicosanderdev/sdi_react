-- Host contact gating for guest reservation lookup RPCs.
-- Host PII is returned only when Bookings.Status is confirmed (1) or completed (3).
-- Prerequisite: 20260530120000_create_booking_hold_listing_type.sql (already applied).
-- NOTE: Manual execution by project owner (idempotent).

begin;

-- ---------------------------------------------------------------------------
-- 1) resolve_host_contact_for_property — owner member or company contact
-- ---------------------------------------------------------------------------
create or replace function public.resolve_host_contact_for_property(p_estate_property_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

comment on function public.resolve_host_contact_for_property(uuid) is
  'Resolve host display name, email, and phone for an estate property owner (member or company).';

-- ---------------------------------------------------------------------------
-- 2) get_reservation_by_code — add host contact when Status in (1, 3)
-- ---------------------------------------------------------------------------
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
    coalesce(r."LastModified", r."Created") as updated_at
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

-- ---------------------------------------------------------------------------
-- 3) get_booking_by_manage_token — add host contact when Status in (1, 3)
-- ---------------------------------------------------------------------------
create or replace function public.get_booking_by_manage_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
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

-- ---------------------------------------------------------------------------
-- 4) Grants
-- ---------------------------------------------------------------------------
grant execute on function public.resolve_host_contact_for_property(uuid)
  to anon, authenticated, service_role;

grant execute on function public.get_reservation_by_code(text, text)
  to anon, authenticated, service_role;

grant execute on function public.get_booking_by_manage_token(text)
  to anon, authenticated, service_role;

commit;
