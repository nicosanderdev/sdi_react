-- Part 2: confirm-from-hold snapshot, payment ledger RPCs, cancel preview/cancel,
-- MP payment info + approval rewrites, public content, overdue cancel batch.

-- ---------------------------------------------------------------------------
-- confirm_booking_from_hold: copy policy snapshot + deposit deadlines
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_booking_from_hold(p_hold_id uuid, p_guest_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hold public.booking_holds%ROWTYPE;
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
  v_booking_listing_type public."ListingType" := NULL;
  v_overlap_message text := 'You already have a reservation that overlaps these dates.';
  v_total_amount numeric;
  v_currency integer;
  v_payment_info jsonb;
  v_policy jsonb;
BEGIN
  SELECT * INTO v_hold
  FROM public.booking_holds
  WHERE id = p_hold_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hold not found');
  END IF;

  IF v_hold.status <> 'pending' OR v_hold.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hold expired');
  END IF;

  IF v_hold.otp_verified_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OTP verification required');
  END IF;

  IF coalesce(trim(v_hold.listing_type), '') <> '' THEN
    BEGIN
      v_booking_listing_type := public.validate_guest_site_listing_type(v_hold.listing_type);
    EXCEPTION
      WHEN others THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid listing type on booking hold');
    END;
  END IF;

  v_first_name := trim(coalesce(p_guest_payload->>'firstName', ''));
  v_last_name := trim(coalesce(p_guest_payload->>'lastName', ''));
  v_email := nullif(trim(coalesce(p_guest_payload->>'email', '')), '');
  v_phone := trim(coalesce(p_guest_payload->>'phone', ''));

  IF v_first_name = '' OR v_last_name = '' THEN
    v_full_name := trim(coalesce(p_guest_payload->>'fullName', ''));
    IF v_full_name <> '' THEN
      v_first_name := split_part(v_full_name, ' ', 1);
      v_last_name := nullif(trim(substring(v_full_name FROM position(' ' IN v_full_name) + 1)), '');
      IF v_last_name IS NULL THEN
        v_last_name := '-';
      END IF;
    END IF;
  END IF;

  IF v_first_name = '' OR v_last_name = '' OR v_phone = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Guest first name, last name, and phone are required'
    );
  END IF;

  BEGIN
    v_guest_id := public.upsert_guest_by_email(
      v_first_name,
      v_last_name,
      v_email,
      v_phone
    );
  EXCEPTION
    WHEN others THEN
      RETURN jsonb_build_object('success', false, 'error', sqlerrm);
  END;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_guest_id::text, 0));

  IF public.guest_has_overlapping_booking(
    v_guest_id,
    v_hold.check_in,
    v_hold.check_out
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'GUEST_BOOKING_OVERLAP',
      'error', v_overlap_message
    );
  END IF;

  v_estimated_guests := coalesce(
    (p_guest_payload->>'estimatedGuests')::integer,
    v_hold.estimated_guests
  );

  v_total_amount := coalesce(v_hold.quoted_total, 0);
  v_currency := coalesce(v_hold.quoted_currency, 0);
  v_policy := coalesce(v_hold.cancellation_policy_snapshot, public.get_property_cancellation_policy_json(v_hold.property_id));

  LOOP
    v_attempt := v_attempt + 1;
    v_reservation_code := 'RSV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public."Bookings" b
      WHERE b."ReservationCode" = v_reservation_code
        AND b."IsDeleted" = false
    );

    IF v_attempt >= 20 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Could not allocate reservation code');
    END IF;
  END LOOP;

  INSERT INTO public."Bookings" (
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
    "ListingType",
    "CancellationPolicySnapshot",
    "PolicyIsLegacy",
    "PaymentStatus",
    "AmountPaid",
    "RefundStatus"
  ) VALUES (
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
      CASE
        WHEN v_estimated_guests IS NOT NULL
        THEN concat(' | Estimated guests: ', v_estimated_guests)
        ELSE ''
      END
    ),
    v_reservation_code,
    v_booking_listing_type,
    v_policy,
    false,
    0,
    0,
    0
  )
  RETURNING "Id" INTO v_booking_id;

  PERFORM public.apply_booking_payment_deadlines(
    v_booking_id,
    v_policy,
    v_total_amount,
    v_hold.check_in,
    now()
  );

  UPDATE public.booking_holds
  SET
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
  WHERE id = p_hold_id;

  v_manage_token := public.issue_booking_manage_token(v_booking_id);
  v_payment_info := public.get_booking_mercado_pago_payment_info(v_booking_id);

  RETURN jsonb_build_object(
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
    'cancellation_policy', v_policy,
    'deposit_amount', (SELECT b."DepositAmount" FROM public."Bookings" b WHERE b."Id" = v_booking_id),
    'amount_due', public.compute_booking_amount_due(v_booking_id),
    'mercado_pago', jsonb_build_object(
      'can_pay_online', coalesce((v_payment_info->>'can_pay_online')::boolean, false),
      'seller_connected', coalesce((v_payment_info->>'seller_connected')::boolean, false),
      'mercado_pago_approved', coalesce((v_payment_info->>'mercado_pago_approved')::boolean, false)
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Payment info: amount due (deposit/balance), not always full total
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_booking_mercado_pago_payment_info(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking record;
  v_seller jsonb;
  v_can_pay boolean := false;
  v_approved boolean := false;
  v_amount_due numeric;
  v_now timestamptz := timezone('utc', now());
BEGIN
  SELECT
    b."Id" AS booking_id,
    b."EstatePropertyId" AS property_id,
    b."TotalAmount" AS total_amount,
    b."Currency" AS currency,
    b."Status" AS status_code,
    b."MercadoPagoApprovedAt" AS mp_approved_at,
    b."ReservationCode" AS reservation_code,
    b."IsDeleted" AS is_deleted,
    b."PaymentStatus" AS payment_status,
    b."AmountPaid" AS amount_paid,
    b."DepositAmount" AS deposit_amount,
    b."DepositDeadlineAt" AS deposit_deadline_at,
    b."BalanceDueAt" AS balance_due_at,
    b."CancellationPolicySnapshot" AS policy_snapshot,
    b."RefundStatus" AS refund_status
  INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id;

  IF NOT FOUND OR v_booking.is_deleted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found', 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  v_amount_due := public.compute_booking_amount_due(p_booking_id);
  v_approved := v_booking.payment_status = 1;
  v_seller := public.resolve_mercado_pago_seller_for_property(v_booking.property_id);

  v_can_pay :=
    v_amount_due > 0.009
    AND v_booking.status_code IN (0, 1)
    AND coalesce((v_seller->>'success')::boolean, false);

  -- Past deposit deadline with nothing paid → cannot pay (cron will cancel)
  IF v_booking.deposit_deadline_at IS NOT NULL
     AND v_booking.deposit_deadline_at < v_now
     AND coalesce(v_booking.amount_paid, 0) <= 0.009 THEN
    v_can_pay := false;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking.booking_id,
    'reservation_code', v_booking.reservation_code,
    'amount', v_amount_due,
    'total_amount', v_booking.total_amount,
    'amount_paid', coalesce(v_booking.amount_paid, 0),
    'amount_due', v_amount_due,
    'deposit_amount', v_booking.deposit_amount,
    'currency', v_booking.currency,
    'currency_code', public.currency_code_from_int(v_booking.currency),
    'payment_status', v_booking.payment_status,
    'refund_status', v_booking.refund_status,
    'mercado_pago_approved', v_approved,
    'mercado_pago_approved_at', v_booking.mp_approved_at,
    'can_pay_online', v_can_pay,
    'seller_connected', coalesce((v_seller->>'success')::boolean, false),
    'seller_error_code', v_seller->>'error_code',
    'seller_member_id', v_seller->>'member_id',
    'cancellation_policy', v_booking.policy_snapshot,
    'deposit_deadline_at', v_booking.deposit_deadline_at,
    'balance_due_at', v_booking.balance_due_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_mercado_pago_payment_info(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Record payment / refund / reversal
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_booking_payment(
  p_booking_id uuid,
  p_amount numeric,
  p_source text,
  p_method text DEFAULT 'other',
  p_note text DEFAULT NULL,
  p_mp_payment_id text DEFAULT NULL,
  p_mp_attempt_id uuid DEFAULT NULL,
  p_recorded_by text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking record;
  v_member_id text;
  v_actor text;
  v_source text;
  v_id uuid;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  SELECT * INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id AND b."IsDeleted" = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  -- Authz: service_role path uses p_recorded_by; otherwise owner/admin
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_admin()
      OR public.user_can_manage_estate_property(v_booking."EstatePropertyId")
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
    END IF;
    SELECT m."Id"::text INTO v_member_id
    FROM public."Members" m
    WHERE m."UserId" = auth.uid() AND m."IsDeleted" = false
    LIMIT 1;
    v_actor := coalesce(p_recorded_by, v_member_id, auth.uid()::text);
    IF public.is_admin() AND p_source = 'admin' THEN
      v_source := 'admin';
    ELSE
      v_source := 'owner';
    END IF;
  ELSE
    v_actor := coalesce(p_recorded_by, 'system');
    v_source := coalesce(p_source, 'system');
  END IF;

  IF v_source NOT IN ('mercado_pago', 'owner', 'admin', 'system') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid source');
  END IF;

  -- Idempotent MP payment by mp_payment_id
  IF p_mp_payment_id IS NOT NULL THEN
    SELECT "Id" INTO v_id
    FROM public."BookingPayments"
    WHERE "MpPaymentId" = p_mp_payment_id
      AND "EntryType" = 'payment'
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      PERFORM public.refresh_booking_payment_summary(p_booking_id);
      RETURN jsonb_build_object('success', true, 'payment_id', v_id, 'already_recorded', true);
    END IF;
  END IF;

  -- Late money on cancelled booking → still record + owe full refund
  INSERT INTO public."BookingPayments" (
    "BookingId", "EntryType", "Amount", "Currency", "Source", "Method",
    "RecordedBy", "Note", "MpPaymentId", "MpAttemptId"
  ) VALUES (
    p_booking_id, 'payment', round(p_amount, 2), coalesce(v_booking."Currency", 1),
    v_source, coalesce(p_method, 'other'), v_actor, p_note, p_mp_payment_id, p_mp_attempt_id
  )
  RETURNING "Id" INTO v_id;

  IF v_booking."Status" = 2 THEN
    UPDATE public."Bookings"
    SET
      "RefundStatus" = 1,
      "RefundDueAt" = coalesce("RefundDueAt", v_now + interval '7 days'),
      "LastModified" = v_now,
      "LastModifiedBy" = v_actor
    WHERE "Id" = p_booking_id;
  END IF;

  PERFORM public.refresh_booking_payment_summary(p_booking_id);

  RETURN jsonb_build_object('success', true, 'payment_id', v_id, 'already_recorded', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_booking_refund(
  p_booking_id uuid,
  p_amount numeric,
  p_source text DEFAULT 'owner',
  p_method text DEFAULT 'other',
  p_note text DEFAULT NULL,
  p_mp_payment_id text DEFAULT NULL,
  p_recorded_by text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking record;
  v_member_id text;
  v_actor text;
  v_source text;
  v_id uuid;
  v_net numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  SELECT * INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id AND b."IsDeleted" = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_admin()
      OR public.user_can_manage_estate_property(v_booking."EstatePropertyId")
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
    END IF;
    SELECT m."Id"::text INTO v_member_id
    FROM public."Members" m
    WHERE m."UserId" = auth.uid() AND m."IsDeleted" = false
    LIMIT 1;
    v_actor := coalesce(p_recorded_by, v_member_id, auth.uid()::text);
    v_source := CASE WHEN public.is_admin() AND p_source = 'admin' THEN 'admin' ELSE 'owner' END;
  ELSE
    v_actor := coalesce(p_recorded_by, 'system');
    v_source := coalesce(p_source, 'system');
  END IF;

  v_net := public.booking_ledger_net_paid(p_booking_id);
  IF p_amount > v_net + 0.01 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refund exceeds amount paid');
  END IF;

  INSERT INTO public."BookingPayments" (
    "BookingId", "EntryType", "Amount", "Currency", "Source", "Method",
    "RecordedBy", "Note", "MpPaymentId"
  ) VALUES (
    p_booking_id, 'refund', round(p_amount, 2), coalesce(v_booking."Currency", 1),
    v_source, coalesce(p_method, 'other'), v_actor, p_note, p_mp_payment_id
  )
  RETURNING "Id" INTO v_id;

  PERFORM public.refresh_booking_payment_summary(p_booking_id);

  RETURN jsonb_build_object('success', true, 'payment_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_booking_payment(
  p_payment_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public."BookingPayments"%ROWTYPE;
  v_booking record;
  v_member_id text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason required');
  END IF;

  SELECT * INTO v_row
  FROM public."BookingPayments"
  WHERE "Id" = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  IF v_row."EntryType" <> 'payment' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only payments can be reversed');
  END IF;

  SELECT * INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = v_row."BookingId"
  FOR UPDATE;

  IF NOT (
    public.is_admin()
    OR public.user_can_manage_estate_property(v_booking."EstatePropertyId")
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  -- Owners cannot reverse Mercado Pago entries
  IF v_row."Source" = 'mercado_pago' AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owners cannot reverse Mercado Pago payments');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public."BookingPayments" r
    WHERE r."ReversesPaymentId" = p_payment_id AND r."EntryType" = 'reversal'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already reversed');
  END IF;

  SELECT m."Id"::text INTO v_member_id
  FROM public."Members" m
  WHERE m."UserId" = auth.uid() AND m."IsDeleted" = false
  LIMIT 1;

  INSERT INTO public."BookingPayments" (
    "BookingId", "EntryType", "Amount", "Currency", "Source", "Method",
    "RecordedBy", "Note", "ReversesPaymentId"
  ) VALUES (
    v_row."BookingId", 'reversal', v_row."Amount", v_row."Currency",
    CASE WHEN public.is_admin() THEN 'admin' ELSE 'owner' END,
    v_row."Method",
    coalesce(v_member_id, auth.uid()::text),
    trim(p_reason),
    p_payment_id
  )
  RETURNING "Id" INTO v_id;

  PERFORM public.refresh_booking_payment_summary(v_row."BookingId");

  RETURN jsonb_build_object('success', true, 'payment_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_booking_payment(uuid, numeric, text, text, text, text, uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_booking_refund(uuid, numeric, text, text, text, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_booking_payment(uuid, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- MP approve / clear → ledger
-- ---------------------------------------------------------------------------

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
DECLARE
  v_attempt record;
  v_booking record;
  v_now timestamptz := timezone('utc', now());
  v_already boolean := false;
  v_amount numeric;
  v_currency text;
  v_label text;
  v_ledger jsonb;
BEGIN
  SELECT * INTO v_attempt
  FROM public.mercado_pago_payment_attempts a
  WHERE a.id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment attempt not found');
  END IF;

  IF v_attempt.booking_id <> p_booking_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attempt booking mismatch');
  END IF;

  SELECT * INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id AND b."IsDeleted" = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF p_amount IS NOT NULL AND abs(coalesce(v_attempt.expected_amount, 0) - p_amount) > 0.01 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount mismatch', 'error_code', 'AMOUNT_MISMATCH');
  END IF;

  IF p_currency_code IS NOT NULL
     AND upper(trim(p_currency_code)) <> upper(trim(v_attempt.expected_currency_code)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Currency mismatch', 'error_code', 'CURRENCY_MISMATCH');
  END IF;

  v_amount := coalesce(p_amount, v_attempt.expected_amount);
  v_currency := coalesce(nullif(trim(p_currency_code), ''), v_attempt.expected_currency_code);

  UPDATE public.mercado_pago_payment_attempts
  SET
    mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id),
    status = 'approved',
    provider_status = p_provider_status,
    provider_status_detail = p_provider_status_detail,
    payer_email = coalesce(p_payer_email, payer_email),
    approved_at = coalesce(approved_at, v_now),
    updated_at = v_now
  WHERE id = p_attempt_id;

  v_ledger := public.record_booking_payment(
    p_booking_id,
    v_amount,
    'mercado_pago',
    'mercado_pago',
    'Mercado Pago webhook approval',
    p_mp_payment_id,
    p_attempt_id,
    'mercado-pago-webhook'
  );

  v_already := coalesce((v_ledger->>'already_recorded')::boolean, false);

  UPDATE public."Bookings"
  SET
    "MercadoPagoApprovedAt" = coalesce("MercadoPagoApprovedAt", v_now),
    "LastModified" = v_now,
    "LastModifiedBy" = 'mercado-pago-webhook'
  WHERE "Id" = p_booking_id;

  IF NOT v_already THEN
    v_label := coalesce(public.admin_booking_log_label(p_booking_id), 'Booking ' || p_booking_id::text);
    IF v_amount IS NOT NULL THEN
      v_label := v_label || ' — ' || trim(to_char(v_amount, 'FM999999990.00'))
        || coalesce(' ' || nullif(trim(v_currency), ''), '');
    END IF;

    PERFORM public.log_admin_activity(
      'booking',
      'payment',
      p_booking_id,
      v_label,
      NULL,
      'Mercado Pago',
      jsonb_build_object(
        'attemptId', p_attempt_id,
        'mpPaymentId', p_mp_payment_id,
        'amount', v_amount,
        'currency', v_currency
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'attempt_id', p_attempt_id,
    'already_approved', v_already,
    'ledger', v_ledger
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_booking_mercado_pago_approval(
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
DECLARE
  v_attempt record;
  v_booking record;
  v_now timestamptz := timezone('utc', now());
  v_status text;
  v_refund_amount numeric;
  v_ledger jsonb;
BEGIN
  v_status := CASE
    WHEN p_provider_status = 'charged_back' THEN 'charged_back'
    ELSE 'refunded'
  END;

  SELECT * INTO v_attempt
  FROM public.mercado_pago_payment_attempts a
  WHERE a.id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment attempt not found');
  END IF;

  IF v_attempt.booking_id <> p_booking_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attempt booking mismatch');
  END IF;

  SELECT * INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id AND b."IsDeleted" = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  UPDATE public.mercado_pago_payment_attempts
  SET
    mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id),
    status = v_status,
    provider_status = p_provider_status,
    provider_status_detail = p_provider_status_detail,
    payer_email = coalesce(p_payer_email, payer_email),
    updated_at = v_now
  WHERE id = p_attempt_id;

  -- Partial refunds: use p_amount when provided and less than attempt; else full attempt amount
  v_refund_amount := coalesce(p_amount, v_attempt.expected_amount);
  IF v_refund_amount IS NULL OR v_refund_amount <= 0 THEN
    v_refund_amount := public.booking_ledger_net_paid(p_booking_id);
  END IF;

  IF v_refund_amount > 0.009 THEN
    v_ledger := public.record_booking_refund(
      p_booking_id,
      v_refund_amount,
      'mercado_pago',
      'mercado_pago',
      'Mercado Pago ' || v_status,
      p_mp_payment_id,
      'mercado-pago-webhook'
    );
  END IF;

  UPDATE public."Bookings"
  SET
    "LastModified" = v_now,
    "LastModifiedBy" = 'mercado-pago-webhook'
  WHERE "Id" = p_booking_id;

  PERFORM public.refresh_booking_payment_summary(p_booking_id);

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'attempt_id', p_attempt_id,
    'status', v_status,
    'ledger', v_ledger
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_booking_mercado_pago_approved(uuid, uuid, text, text, text, text, numeric, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_booking_mercado_pago_approval(uuid, uuid, text, text, text, text, numeric, text)
  TO service_role;
