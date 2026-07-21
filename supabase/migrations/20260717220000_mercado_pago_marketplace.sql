-- Mercado Pago marketplace: seller OAuth accounts, expiring link invites,
-- payment attempts / webhook audit, authoritative booking quotes, and RPCs.
-- Apply manually. Do not rely on automated db push from this change set.

-- ---------------------------------------------------------------------------
-- 1) Booking audit column + authoritative hold quote
-- ---------------------------------------------------------------------------

ALTER TABLE public."Bookings"
  ADD COLUMN IF NOT EXISTS "MercadoPagoApprovedAt" timestamp with time zone;

COMMENT ON COLUMN public."Bookings"."MercadoPagoApprovedAt" IS
  'Set only after a verified Mercado Pago webhook + GET /v1/payments approval. Does not change PaymentStatus or Status.';

ALTER TABLE public.booking_holds
  ADD COLUMN IF NOT EXISTS quoted_total numeric,
  ADD COLUMN IF NOT EXISTS quoted_currency integer;

COMMENT ON COLUMN public.booking_holds.quoted_total IS
  'Server-computed stay total captured at hold creation; copied into Bookings.TotalAmount on confirm.';
COMMENT ON COLUMN public.booking_holds.quoted_currency IS
  'Listing currency integer (0=USD, 1=UYU, ...) captured at hold creation.';

-- ---------------------------------------------------------------------------
-- 2) Secure Mercado Pago tables (service-role / SECURITY DEFINER only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.mercado_pago_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public."Members"("Id") ON DELETE CASCADE,
  mp_user_id text NOT NULL,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scope text,
  public_key text,
  live_mode boolean,
  connected_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_refreshed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT uq_mercado_pago_accounts_member UNIQUE (member_id),
  CONSTRAINT uq_mercado_pago_accounts_mp_user UNIQUE (mp_user_id)
);

CREATE TABLE IF NOT EXISTS public.mercado_pago_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public."Members"("Id") ON DELETE CASCADE,
  token_hash text NOT NULL,
  oauth_state_hash text,
  pkce_verifier_encrypted text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  requested_by_member_id uuid REFERENCES public."Members"("Id"),
  whatsapp_message_id text,
  whatsapp_status text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT uq_mercado_pago_link_requests_token_hash UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS ix_mp_link_requests_member_active
  ON public.mercado_pago_link_requests (member_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.mercado_pago_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public."Bookings"("Id") ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public."Members"("Id"),
  preference_id text,
  init_point text,
  sandbox_init_point text,
  mp_payment_id text,
  external_reference text NOT NULL,
  idempotency_key text NOT NULL,
  expected_amount numeric NOT NULL,
  expected_currency integer NOT NULL,
  expected_currency_code text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  provider_status text,
  provider_status_detail text,
  payer_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  approved_at timestamptz,
  CONSTRAINT chk_mp_payment_attempts_status CHECK (
    status = ANY (ARRAY[
      'created'::text,
      'preference_created'::text,
      'pending'::text,
      'approved'::text,
      'rejected'::text,
      'cancelled'::text,
      'refunded'::text,
      'charged_back'::text,
      'expired'::text
    ])
  ),
  CONSTRAINT uq_mp_payment_attempts_idempotency UNIQUE (idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mp_payment_attempts_preference
  ON public.mercado_pago_payment_attempts (preference_id)
  WHERE preference_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mp_payment_attempts_payment
  ON public.mercado_pago_payment_attempts (mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_mp_payment_attempts_booking
  ON public.mercado_pago_payment_attempts (booking_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mercado_pago_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id text NOT NULL,
  topic text,
  resource_id text,
  request_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  processing_result text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT uq_mp_webhook_events_provider UNIQUE (provider_event_id)
);

ALTER TABLE public.mercado_pago_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercado_pago_link_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercado_pago_payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercado_pago_webhook_events ENABLE ROW LEVEL SECURITY;

-- No client policies: access only via service role / SECURITY DEFINER functions.
REVOKE ALL ON TABLE public.mercado_pago_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mercado_pago_link_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mercado_pago_payment_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mercado_pago_webhook_events FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.mercado_pago_accounts TO service_role;
GRANT ALL ON TABLE public.mercado_pago_link_requests TO service_role;
GRANT ALL ON TABLE public.mercado_pago_payment_attempts TO service_role;
GRANT ALL ON TABLE public.mercado_pago_webhook_events TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.currency_code_from_int(p_currency integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE coalesce(p_currency, 0)
    WHEN 0 THEN 'USD'
    WHEN 1 THEN 'UYU'
    WHEN 2 THEN 'BRL'
    WHEN 3 THEN 'EUR'
    WHEN 4 THEN 'GBP'
    ELSE 'USD'
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_mercado_pago_status(p_member_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_connected boolean := false;
  v_pending boolean := false;
begin
  select exists (
    select 1
    from public.mercado_pago_accounts a
    where a.member_id = p_member_id
  ) into v_connected;

  if v_connected then
    return 'connected';
  end if;

  select exists (
    select 1
    from public.mercado_pago_link_requests r
    where r.member_id = p_member_id
      and r.used_at is null
      and r.revoked_at is null
      and r.expires_at > timezone('utc', now())
  ) into v_pending;

  if v_pending then
    return 'invite_sent';
  end if;

  return 'not_connected';
end;
$$;

CREATE OR REPLACE FUNCTION public.resolve_mercado_pago_seller_for_property(p_property_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_owner record;
  v_member_id uuid;
  v_account record;
  v_member record;
begin
  select
    o."OwnerType" as owner_type,
    o."MemberId" as member_id,
    o."CompanyId" as company_id
  into v_owner
  from public."EstateProperties" ep
  join public."Owners" o
    on o."Id" = ep."OwnerId"
   and o."IsDeleted" = false
  where ep."Id" = p_property_id
    and ep."IsDeleted" = false;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Property not found',
      'error_code', 'PROPERTY_NOT_FOUND'
    );
  end if;

  if v_owner.owner_type = 'member' then
    v_member_id := v_owner.member_id;
  elsif v_owner.owner_type = 'company' then
    select m."Id"
    into v_member_id
    from public."Companies" c
    join public."Members" m
      on m."UserId" = c."BillingContactUserId"
     and m."IsDeleted" = false
    join public."CompanyMembers" cm
      on cm."CompanyId" = c."Id"
     and cm."MemberId" = m."Id"
     and cm."IsDeleted" = false
    where c."Id" = v_owner.company_id
      and c."IsDeleted" = false
    limit 1;

    if v_member_id is null then
      return jsonb_build_object(
        'success', false,
        'error', 'Company has no designated billing contact linked to Mercado Pago',
        'error_code', 'NO_DESIGNATED_SELLER'
      );
    end if;
  else
    return jsonb_build_object(
      'success', false,
      'error', 'Unsupported owner type',
      'error_code', 'UNSUPPORTED_OWNER'
    );
  end if;

  select m."Id", m."FirstName", m."LastName", m."Email"
  into v_member
  from public."Members" m
  where m."Id" = v_member_id
    and m."IsDeleted" = false;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Seller member not found',
      'error_code', 'SELLER_NOT_FOUND'
    );
  end if;

  select
    a.id,
    a.member_id,
    a.mp_user_id,
    a.public_key,
    a.live_mode,
    a.token_expires_at
  into v_account
  from public.mercado_pago_accounts a
  where a.member_id = v_member_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Seller is not connected to Mercado Pago',
      'error_code', 'SELLER_NOT_CONNECTED',
      'member_id', v_member_id
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'member_id', v_member_id,
    'mp_user_id', v_account.mp_user_id,
    'account_id', v_account.id,
    'public_key', v_account.public_key,
    'live_mode', v_account.live_mode,
    'token_expires_at', v_account.token_expires_at,
    'seller_name', trim(coalesce(v_member."FirstName", '') || ' ' || coalesce(v_member."LastName", ''))
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.get_booking_mercado_pago_payment_info(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_booking record;
  v_seller jsonb;
  v_can_pay boolean := false;
  v_approved boolean := false;
begin
  select
    b."Id" as booking_id,
    b."EstatePropertyId" as property_id,
    b."TotalAmount" as total_amount,
    b."Currency" as currency,
    b."Status" as status_code,
    b."MercadoPagoApprovedAt" as mp_approved_at,
    b."ReservationCode" as reservation_code,
    b."IsDeleted" as is_deleted
  into v_booking
  from public."Bookings" b
  where b."Id" = p_booking_id;

  if not found or v_booking.is_deleted then
    return jsonb_build_object('success', false, 'error', 'Booking not found', 'error_code', 'BOOKING_NOT_FOUND');
  end if;

  v_approved := v_booking.mp_approved_at is not null;
  v_seller := public.resolve_mercado_pago_seller_for_property(v_booking.property_id);

  v_can_pay :=
    not v_approved
    and v_booking.status_code in (0, 1)
    and coalesce(v_booking.total_amount, 0) > 0
    and coalesce((v_seller->>'success')::boolean, false);

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking.booking_id,
    'reservation_code', v_booking.reservation_code,
    'amount', v_booking.total_amount,
    'currency', v_booking.currency,
    'currency_code', public.currency_code_from_int(v_booking.currency),
    'mercado_pago_approved', v_approved,
    'mercado_pago_approved_at', v_booking.mp_approved_at,
    'can_pay_online', v_can_pay,
    'seller_connected', coalesce((v_seller->>'success')::boolean, false),
    'seller_error_code', v_seller->>'error_code',
    'seller_member_id', v_seller->>'member_id'
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.mark_booking_mercado_pago_approved(
  p_booking_id uuid,
  p_attempt_id uuid,
  p_mp_payment_id text,
  p_provider_status text,
  p_provider_status_detail text DEFAULT NULL,
  p_payer_email text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_currency_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_attempt record;
  v_booking record;
  v_now timestamptz := timezone('utc', now());
begin
  select *
  into v_attempt
  from public.mercado_pago_payment_attempts a
  where a.id = p_attempt_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Payment attempt not found');
  end if;

  if v_attempt.booking_id <> p_booking_id then
    return jsonb_build_object('success', false, 'error', 'Attempt booking mismatch');
  end if;

  select *
  into v_booking
  from public."Bookings" b
  where b."Id" = p_booking_id
    and b."IsDeleted" = false
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Booking not found');
  end if;

  if p_amount is not null and abs(coalesce(v_attempt.expected_amount, 0) - p_amount) > 0.01 then
    return jsonb_build_object('success', false, 'error', 'Amount mismatch', 'error_code', 'AMOUNT_MISMATCH');
  end if;

  if p_currency_code is not null
     and upper(trim(p_currency_code)) <> upper(trim(v_attempt.expected_currency_code)) then
    return jsonb_build_object('success', false, 'error', 'Currency mismatch', 'error_code', 'CURRENCY_MISMATCH');
  end if;

  update public.mercado_pago_payment_attempts
  set
    mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id),
    status = 'approved',
    provider_status = p_provider_status,
    provider_status_detail = p_provider_status_detail,
    payer_email = coalesce(p_payer_email, payer_email),
    approved_at = coalesce(approved_at, v_now),
    updated_at = v_now
  where id = p_attempt_id;

  update public."Bookings"
  set
    "MercadoPagoApprovedAt" = coalesce("MercadoPagoApprovedAt", v_now),
    "LastModified" = v_now,
    "LastModifiedBy" = 'mercado-pago-webhook'
  where "Id" = p_booking_id;

  return jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'attempt_id', p_attempt_id,
    'already_approved', v_booking."MercadoPagoApprovedAt" is not null
  );
end;
$$;

REVOKE ALL ON FUNCTION public.get_member_mercado_pago_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_mercado_pago_seller_for_property(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_booking_mercado_pago_payment_info(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_booking_mercado_pago_approved(uuid, uuid, text, text, text, text, numeric, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_member_mercado_pago_status(uuid) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_mercado_pago_seller_for_property(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_booking_mercado_pago_payment_info(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_booking_mercado_pago_approved(uuid, uuid, text, text, text, text, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.currency_code_from_int(integer) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Authoritative hold quote + confirm copy
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_property_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer,
  p_ip_hash text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_visible_check_out date DEFAULT NULL::date,
  p_estimated_guests integer DEFAULT NULL::integer,
  p_listing_type text DEFAULT NULL::text,
  p_client_total numeric DEFAULT NULL::numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_validation jsonb;
  v_hold_id uuid;
  v_listing_type text := null;
  v_scope text := null;
  v_quoted_total numeric := null;
  v_quoted_currency integer := 0;
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

  if v_validation->'pricing' is not null and jsonb_typeof(v_validation->'pricing') = 'object' then
    v_quoted_total := (v_validation->'pricing'->>'total_price')::numeric;
  end if;

  select coalesce(l."Currency", 0)
  into v_quoted_currency
  from public."Listings" l
  where l."EstatePropertyId" = p_property_id
    and l."IsDeleted" = false
    and (v_listing_type is null or l."ListingType"::text = v_listing_type)
  order by l."IsFeatured" desc nulls last, l."IsActive" desc nulls last, l."Created" desc nulls last
  limit 1;

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
    property_id, check_in, check_out, guests, estimated_guests, ip_hash, idempotency_key, listing_type,
    quoted_total, quoted_currency
  ) values (
    p_property_id, p_check_in, p_check_out, p_guests, p_estimated_guests, p_ip_hash, p_idempotency_key, v_listing_type,
    v_quoted_total, coalesce(v_quoted_currency, 0)
  )
  returning id into v_hold_id;

  return jsonb_build_object(
    'success', true,
    'hold', jsonb_build_object(
      'id', v_hold_id,
      'expires_at', (select expires_at from public.booking_holds where id = v_hold_id),
      'listing_type', v_listing_type,
      'quoted_total', v_quoted_total,
      'quoted_currency', coalesce(v_quoted_currency, 0)
    ),
    'validation', v_validation
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.confirm_booking_from_hold(p_hold_id uuid, p_guest_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_total_amount numeric;
  v_currency integer;
  v_payment_info jsonb;
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

  v_total_amount := coalesce(v_hold.quoted_total, 0);
  v_currency := coalesce(v_hold.quoted_currency, 0);

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
    "Currency",
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
    v_total_amount,
    v_currency,
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
  v_payment_info := public.get_booking_mercado_pago_payment_info(v_booking_id);

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'guest_id', v_guest_id,
    'reservation_code', v_reservation_code,
    'listing_type', v_booking_listing_type,
    'manage_token', v_manage_token->>'token',
    'manage_expires_at', v_manage_token->>'expires_at',
    'total_amount', v_total_amount,
    'currency', v_currency,
    'currency_code', public.currency_code_from_int(v_currency),
    'mercado_pago', jsonb_build_object(
      'can_pay_online', coalesce((v_payment_info->>'can_pay_online')::boolean, false),
      'seller_connected', coalesce((v_payment_info->>'seller_connected')::boolean, false),
      'mercado_pago_approved', coalesce((v_payment_info->>'mercado_pago_approved')::boolean, false)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Admin list / detail: Mercado Pago status
-- ---------------------------------------------------------------------------
-- DROP required: Postgres cannot change RETURNS TABLE via CREATE OR REPLACE (42P13).

DROP FUNCTION IF EXISTS public.get_admin_users_list(
  integer, integer, text, integer, text, date, date, text
);

CREATE OR REPLACE FUNCTION public.get_admin_users_list(
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 20,
  p_subscription_status text DEFAULT NULL::text,
  p_subscription_tier integer DEFAULT NULL::integer,
  p_account_status text DEFAULT NULL::text,
  p_registration_date_from date DEFAULT NULL::date,
  p_registration_date_to date DEFAULT NULL::date,
  p_search text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  avatar_url text,
  role text,
  subscription_status text,
  subscription_tier integer,
  subscription_expires_at timestamp with time zone,
  account_status text,
  registration_date timestamp with time zone,
  last_login timestamp with time zone,
  properties_count bigint,
  payment_status text,
  mercado_pago_status text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
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
      ) as inv_status,
      public.get_member_mercado_pago_status(m."Id") as mp_status
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
    f.fn::text as first_name,
    f.ln::text as last_name,
    f.em::text as email,
    f.av::text as avatar_url,
    f.rrole as role,
    f.sub_stat as subscription_status,
    f.plan_tier_code as subscription_tier,
    f.latest_mp_end as subscription_expires_at,
    f.acct_stat as account_status,
    f.reg as registration_date,
    f.llogin as last_login,
    f.pcnt as properties_count,
    f.pay_stat as payment_status,
    f.mp_status as mercado_pago_status,
    (select cnt from counted) as total_count
  from filtered f
  order by f.reg desc nulls last
  offset v_offset
  limit v_lim;
end;
$$;

DROP FUNCTION IF EXISTS public.get_admin_user_detail(uuid);

CREATE OR REPLACE FUNCTION public.get_admin_user_detail(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  avatar_url text,
  phone text,
  street text,
  street2 text,
  city text,
  state text,
  postal_code text,
  country text,
  role text,
  subscription_status text,
  subscription_tier integer,
  subscription_expires_at timestamp with time zone,
  account_status text,
  registration_date timestamp with time zone,
  last_login timestamp with time zone,
  properties_count bigint,
  payment_status text,
  onboarding_step integer,
  onboarding_complete boolean,
  action_history jsonb,
  mercado_pago_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

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
    '[]'::jsonb as action_history,
    public.get_member_mercado_pago_status(m."Id") as mercado_pago_status
  from public."Members" m
  join auth.users u on u.id = m."UserId"
  where m."Id" = p_user_id
  limit 1;
end;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_users_list(
  integer, integer, text, integer, text, date, date, text
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_admin_user_detail(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) Guest lookup / manage token: payment eligibility fields
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_booking_by_manage_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
declare
  v_token_hash text;
  v_booking_id uuid;
  v_row record;
  v_status text;
  v_host_contact jsonb := jsonb_build_object('name', null, 'email', null, 'phone', null);
  v_payment jsonb;
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
    b."Status" as status_code,
    b."TotalAmount" as total_amount,
    b."Currency" as currency,
    b."MercadoPagoApprovedAt" as mp_approved_at
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

  v_payment := public.get_booking_mercado_pago_payment_info(v_row.booking_id);

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
      'canCancel', (v_row.status_code in (0, 1) and v_row.check_in >= current_date),
      'totalAmount', v_row.total_amount,
      'currency', v_row.currency,
      'currencyCode', public.currency_code_from_int(v_row.currency),
      'mercadoPagoApproved', coalesce((v_payment->>'mercado_pago_approved')::boolean, false),
      'mercadoPagoApprovedAt', v_payment->>'mercado_pago_approved_at',
      'canPayOnline', coalesce((v_payment->>'can_pay_online')::boolean, false),
      'sellerConnected', coalesce((v_payment->>'seller_connected')::boolean, false)
    )
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.get_reservation_by_code(reservation_code text, p_listing_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
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
  v_payment jsonb;
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
    b."TotalAmount" as total_amount,
    b."Currency" as currency,
    b."MercadoPagoApprovedAt" as mp_approved_at,
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

  v_payment := public.get_booking_mercado_pago_payment_info(v_booking.booking_id);

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
      'hostContact', v_host_contact,
      'canCancel', (v_booking.status_code in (0, 1) and v_booking.check_in >= current_date),
      'isExpired', v_is_expired,
      'isDeleted', coalesce(v_booking.is_deleted, false),
      'hasExistingReview', v_has_existing_review,
      'canSubmitGuestReview', v_can_submit_guest_review,
      'canEditGuestReview', v_can_edit_guest_review,
      'existingGuestReview', v_existing_guest_review,
      'guestReviewWindowEnd', v_window_end,
      'totalAmount', v_booking.total_amount,
      'currency', v_booking.currency,
      'currencyCode', public.currency_code_from_int(v_booking.currency),
      'mercadoPagoApproved', coalesce((v_payment->>'mercado_pago_approved')::boolean, false),
      'mercadoPagoApprovedAt', v_payment->>'mercado_pago_approved_at',
      'canPayOnline', coalesce((v_payment->>'can_pay_online')::boolean, false),
      'sellerConnected', coalesce((v_payment->>'seller_connected')::boolean, false)
    )
  );
end;
$fn$;

-- Guest-callable payment status helper (no secrets).
CREATE OR REPLACE FUNCTION public.get_booking_payment_status_by_manage_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
declare
  v_token_hash text;
  v_booking_id uuid;
  v_info jsonb;
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

  v_info := public.get_booking_mercado_pago_payment_info(v_booking_id);
  return v_info;
end;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_payment_status_by_manage_token(text) TO anon, authenticated, service_role;
