-- Fix confirm_booking_from_hold: avoid pgcrypto gen_random_bytes (not on search_path=public).
-- Uses built-in gen_random_uuid() instead of extensions.gen_random_bytes().
-- Prerequisite: 20260525120000_guests_table_polymorphic_guest_id.sql (already applied).
-- NOTE: Manual execution by project owner (idempotent).

begin;

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
    "ReservationCode"
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
    v_reservation_code
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
    'manage_token', v_manage_token->>'token',
    'manage_expires_at', v_manage_token->>'expires_at'
  );
end;
$$;

grant execute on function public.confirm_booking_from_hold(uuid, jsonb)
  to anon, authenticated, service_role;

commit;
