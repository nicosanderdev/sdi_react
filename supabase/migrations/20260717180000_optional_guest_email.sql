-- Allow Guests without email: nullable Email, phone-based upsert when email absent.
-- confirm_booking_from_hold keeps first/last name + phone required; email optional.

-- 1) Schema: Email optional
ALTER TABLE public."Guests"
  ALTER COLUMN "Email" DROP NOT NULL;

ALTER TABLE public."Guests"
  DROP CONSTRAINT IF EXISTS "CHK_Guests_Email";

-- Normalize blank emails to NULL so partial unique index stays clean
UPDATE public."Guests"
SET "Email" = NULL
WHERE "Email" IS NOT NULL
  AND length(TRIM(BOTH FROM "Email")) = 0;

DROP INDEX IF EXISTS public."UX_Guests_Email_Normalized";

CREATE UNIQUE INDEX "UX_Guests_Email_Normalized"
  ON public."Guests" USING btree (lower(TRIM(BOTH FROM "Email")))
  WHERE ("Email" IS NOT NULL AND length(TRIM(BOTH FROM "Email")) > 0);

COMMENT ON TABLE public."Guests" IS
  'Non-member guests for client-side bookings. Unique by normalized email when present; phone used to match when email is absent.';

-- 2) Upsert: email match when provided; otherwise phone match
CREATE OR REPLACE FUNCTION public.upsert_guest_by_email(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone_number text
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_first text := trim(coalesce(p_first_name, ''));
  v_last text := trim(coalesce(p_last_name, ''));
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_phone text := trim(coalesce(p_phone_number, ''));
  v_id uuid;
begin
  if v_first = '' then
    raise exception 'First name is required';
  end if;

  if v_last = '' then
    raise exception 'Last name is required';
  end if;

  if v_phone = '' then
    raise exception 'Phone number is required';
  end if;

  if v_email is not null then
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
    on conflict ((lower(TRIM(BOTH FROM "Email"))))
      where ("Email" is not null and length(TRIM(BOTH FROM "Email")) > 0)
    do update set
      "FirstName" = excluded."FirstName",
      "LastName" = excluded."LastName",
      "PhoneNumber" = excluded."PhoneNumber",
      "LastModified" = now()
    returning "Id" into v_id;

    return v_id;
  end if;

  select g."Id"
  into v_id
  from public."Guests" g
  where trim(g."PhoneNumber") = v_phone
    and (g."Email" is null or length(trim(g."Email")) = 0)
  order by g."LastModified" desc
  limit 1;

  if v_id is not null then
    update public."Guests" g
    set
      "FirstName" = v_first,
      "LastName" = v_last,
      "PhoneNumber" = v_phone,
      "LastModified" = now()
    where g."Id" = v_id;

    return v_id;
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
    null,
    v_phone,
    now(),
    now()
  )
  returning "Id" into v_id;

  return v_id;
end;
$$;

-- 3) Confirm hold: email optional
CREATE OR REPLACE FUNCTION public.confirm_booking_from_hold(
  p_hold_id uuid,
  p_guest_payload jsonb
) RETURNS jsonb
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
  v_email := nullif(trim(coalesce(p_guest_payload->>'email', '')), '');
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

  if v_first_name = '' or v_last_name = '' or v_phone = '' then
    return jsonb_build_object(
      'success', false,
      'error', 'Guest first name, last name, and phone are required'
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
