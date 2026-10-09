-- Guest booking payment/refund fields + policy-aware cancel by reservation code.
-- Extends manage-token and code-lookup RPCs for guest sites.

-- ---------------------------------------------------------------------------
-- Payment info: pay_block_code + balance deadline blocks can_pay_online
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
  v_pay_block text := NULL;
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
    b."RefundStatus" AS refund_status,
    b."RefundDueAt" AS refund_due_at,
    b."CancellationInitiator" AS cancellation_initiator
  INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id;

  IF NOT FOUND OR v_booking.is_deleted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found', 'error_code', 'BOOKING_NOT_FOUND');
  END IF;

  v_amount_due := public.compute_booking_amount_due(p_booking_id);
  v_approved := v_booking.payment_status = 1;
  v_seller := public.resolve_mercado_pago_seller_for_property(v_booking.property_id);

  IF v_booking.status_code = 2 THEN
    v_pay_block := 'BOOKING_CANCELLED';
  ELSIF v_booking.deposit_deadline_at IS NOT NULL
        AND v_booking.deposit_deadline_at < v_now
        AND coalesce(v_booking.amount_paid, 0) <= 0.009
        AND v_amount_due > 0.009 THEN
    v_pay_block := 'PAYMENT_DEADLINE_PASSED';
  ELSIF v_booking.balance_due_at IS NOT NULL
        AND v_booking.balance_due_at < v_now
        AND v_amount_due > 0.009 THEN
    v_pay_block := 'PAYMENT_DEADLINE_PASSED';
  END IF;

  v_can_pay :=
    v_amount_due > 0.009
    AND v_booking.status_code IN (0, 1)
    AND coalesce((v_seller->>'success')::boolean, false)
    AND v_pay_block IS NULL;

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
    'refund_due_at', v_booking.refund_due_at,
    'mercado_pago_approved', v_approved,
    'mercado_pago_approved_at', v_booking.mp_approved_at,
    'can_pay_online', v_can_pay,
    'seller_connected', coalesce((v_seller->>'success')::boolean, false),
    'seller_error_code', v_seller->>'error_code',
    'seller_member_id', v_seller->>'member_id',
    'cancellation_policy', v_booking.policy_snapshot,
    'deposit_deadline_at', v_booking.deposit_deadline_at,
    'balance_due_at', v_booking.balance_due_at,
    'cancellation_initiator', v_booking.cancellation_initiator,
    'pay_block_code', v_pay_block
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Resolve guest booking by reservation code (shared by preview/cancel by code)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_guest_booking_by_code(
  p_reservation_code text,
  p_listing_type text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
  v_listing_type public."ListingType";
  v_booking record;
BEGIN
  v_code := upper(trim(coalesce(p_reservation_code, '')));

  IF v_code = '' OR v_code !~ '^RSV-[A-Z0-9]{6}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid reservation code format');
  END IF;

  BEGIN
    v_listing_type := public.validate_guest_site_listing_type(p_listing_type);
  EXCEPTION
    WHEN others THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid listing type');
  END;

  SELECT
    b."Id" AS booking_id,
    b."EstatePropertyId" AS property_id,
    b."ListingType" AS booking_listing_type,
    b."CheckInDate" AS check_in,
    b."CheckOutDate" AS check_out,
    b."IsDeleted" AS is_deleted
  INTO v_booking
  FROM public."Bookings" b
  WHERE b."ReservationCode" = v_code
    AND b."IsDeleted" = false
  ORDER BY b."Created" DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reservation not found');
  END IF;

  IF NOT public.booking_matches_guest_site_listing_type(
    v_booking.booking_listing_type,
    v_booking.property_id,
    v_booking.check_in::timestamptz,
    v_booking.check_out::timestamptz,
    v_listing_type
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reservation not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking.booking_id,
    'listing_type', v_listing_type::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_guest_booking_by_code(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_guest_booking_by_code(text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Preview / cancel by reservation code (guest, policy-aware)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.preview_booking_cancellation_by_code(
  p_reservation_code text,
  p_listing_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_resolved jsonb;
BEGIN
  v_resolved := public.resolve_guest_booking_by_code(p_reservation_code, p_listing_type);
  IF NOT coalesce((v_resolved->>'success')::boolean, false) THEN
    RETURN v_resolved;
  END IF;

  RETURN public.build_cancellation_preview((v_resolved->>'booking_id')::uuid, 'guest');
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking_by_code(
  p_reservation_code text,
  p_listing_type text,
  p_reason text DEFAULT NULL,
  p_preview_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_resolved jsonb;
BEGIN
  v_resolved := public.resolve_guest_booking_by_code(p_reservation_code, p_listing_type);
  IF NOT coalesce((v_resolved->>'success')::boolean, false) THEN
    RETURN v_resolved;
  END IF;

  RETURN public.execute_booking_cancellation(
    (v_resolved->>'booking_id')::uuid,
    'guest',
    p_reason,
    p_preview_hash,
    'guest-reservation-code'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_booking_cancellation_by_code(text, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_booking_by_code(text, text, text, text)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Legacy cancel_reservation: delegate to policy-aware cancel
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_reservation(reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF reservation_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing reservation id');
  END IF;

  RETURN public.execute_booking_cancellation(
    reservation_id,
    'guest',
    NULL,
    NULL,
    'guest-cancel-reservation'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- get_booking_by_manage_token: payment/refund fields + read-only after cancel
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_booking_by_manage_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_token_hash text;
  v_booking_id uuid;
  v_row record;
  v_status text;
  v_host_contact jsonb := jsonb_build_object('name', null, 'email', null, 'phone', null);
  v_payment jsonb;
  v_preview jsonb;
  v_can_cancel boolean := false;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing token');
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  -- Active token first
  SELECT t.booking_id
  INTO v_booking_id
  FROM public.booking_manage_tokens t
  WHERE t.token_hash = v_token_hash
    AND t.revoked_at IS NULL
    AND t.expires_at > now()
  LIMIT 1;

  -- Revoked but unexpired token: only when booking is cancelled (read-only)
  IF v_booking_id IS NULL THEN
    SELECT t.booking_id
    INTO v_booking_id
    FROM public.booking_manage_tokens t
    JOIN public."Bookings" b ON b."Id" = t.booking_id
    WHERE t.token_hash = v_token_hash
      AND t.revoked_at IS NOT NULL
      AND t.expires_at > now()
      AND b."IsDeleted" = false
      AND b."Status" = 2
    LIMIT 1;
  END IF;

  IF v_booking_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired token');
  END IF;

  UPDATE public.booking_manage_tokens
  SET last_used_at = now()
  WHERE token_hash = v_token_hash;

  SELECT
    b."Id" AS booking_id,
    b."ReservationCode" AS reservation_code,
    b."EstatePropertyId" AS property_id,
    b."ListingType" AS listing_type,
    l."Title" AS property_title,
    b."CheckInDate" AS check_in,
    b."CheckOutDate" AS check_out,
    b."GuestCount" AS guests,
    b."Status" AS status_code,
    b."TotalAmount" AS total_amount,
    b."Currency" AS currency,
    b."MercadoPagoApprovedAt" AS mp_approved_at,
    b."RefundDueAt" AS refund_due_at,
    b."CancellationInitiator" AS cancellation_initiator
  INTO v_row
  FROM public."Bookings" b
  LEFT JOIN LATERAL (
    SELECT l2."Title"
    FROM public."Listings" l2
    WHERE l2."EstatePropertyId" = b."EstatePropertyId"
      AND l2."IsDeleted" = false
    ORDER BY l2."IsActive" DESC NULLS LAST, l2."Created" DESC NULLS LAST
    LIMIT 1
  ) l ON true
  WHERE b."Id" = v_booking_id
    AND b."IsDeleted" = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reservation not found');
  END IF;

  v_status := CASE v_row.status_code
    WHEN 0 THEN 'pending'
    WHEN 1 THEN 'confirmed'
    WHEN 2 THEN 'cancelled'
    WHEN 3 THEN 'completed'
    ELSE 'unknown'
  END;

  IF v_row.status_code IN (1, 3) THEN
    v_host_contact := public.resolve_host_contact_for_property(v_row.property_id);
  END IF;

  v_payment := public.get_booking_mercado_pago_payment_info(v_row.booking_id);
  v_preview := public.build_cancellation_preview(v_row.booking_id, 'guest');
  v_can_cancel := coalesce((v_preview->>'canCancel')::boolean, false);

  RETURN jsonb_build_object(
    'success', true,
    'booking', jsonb_build_object(
      'bookingId', v_row.booking_id,
      'reservationCode', coalesce(v_row.reservation_code, ''),
      'propertyTitle', coalesce(v_row.property_title, 'Property'),
      'checkIn', v_row.check_in,
      'checkOut', v_row.check_out,
      'guests', v_row.guests,
      'status', v_status,
      'listingType', v_row.listing_type::text,
      'hostName', v_host_contact->>'name',
      'hostEmail', v_host_contact->>'email',
      'hostPhone', v_host_contact->>'phone',
      'hostContact', v_host_contact,
      'canCancel', v_can_cancel,
      'totalAmount', v_row.total_amount,
      'currency', v_row.currency,
      'currencyCode', public.currency_code_from_int(v_row.currency),
      'amountPaid', coalesce((v_payment->>'amount_paid')::numeric, 0),
      'amountDue', coalesce((v_payment->>'amount_due')::numeric, 0),
      'depositAmount', (v_payment->>'deposit_amount')::numeric,
      'paymentStatus', (v_payment->>'payment_status')::integer,
      'refundStatus', (v_payment->>'refund_status')::integer,
      'refundDueAt', coalesce(v_payment->>'refund_due_at', v_row.refund_due_at::text),
      'cancellationPolicy', v_payment->'cancellation_policy',
      'depositDeadlineAt', v_payment->>'deposit_deadline_at',
      'balanceDueAt', v_payment->>'balance_due_at',
      'cancellationInitiator', coalesce(
        v_payment->>'cancellation_initiator',
        v_row.cancellation_initiator
      ),
      'mercadoPagoApproved', coalesce((v_payment->>'mercado_pago_approved')::boolean, false),
      'mercadoPagoApprovedAt', v_payment->>'mercado_pago_approved_at',
      'canPayOnline', coalesce((v_payment->>'can_pay_online')::boolean, false),
      'sellerConnected', coalesce((v_payment->>'seller_connected')::boolean, false)
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- get_booking_payment_status_by_manage_token: allow revoked when cancelled
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_booking_payment_status_by_manage_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_token_hash text;
  v_booking_id uuid;
  v_info jsonb;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing token');
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT t.booking_id
  INTO v_booking_id
  FROM public.booking_manage_tokens t
  WHERE t.token_hash = v_token_hash
    AND t.revoked_at IS NULL
    AND t.expires_at > now()
  LIMIT 1;

  IF v_booking_id IS NULL THEN
    SELECT t.booking_id
    INTO v_booking_id
    FROM public.booking_manage_tokens t
    JOIN public."Bookings" b ON b."Id" = t.booking_id
    WHERE t.token_hash = v_token_hash
      AND t.revoked_at IS NOT NULL
      AND t.expires_at > now()
      AND b."IsDeleted" = false
      AND b."Status" = 2
    LIMIT 1;
  END IF;

  IF v_booking_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired token');
  END IF;

  v_info := public.get_booking_mercado_pago_payment_info(v_booking_id);
  IF v_info IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unable to load payment info');
  END IF;

  RETURN v_info - 'seller_member_id';
END;
$$;

-- ---------------------------------------------------------------------------
-- get_reservation_by_code: payment/refund fields + policy canCancel
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_reservation_by_code(
  reservation_code text,
  p_listing_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
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
  v_preview jsonb;
  v_can_cancel boolean := false;
BEGIN
  v_code := upper(trim(coalesce(reservation_code, '')));

  IF v_code = '' OR v_code !~ '^RSV-[A-Z0-9]{6}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid reservation code format');
  END IF;

  BEGIN
    v_listing_type := public.validate_guest_site_listing_type(p_listing_type);
  EXCEPTION
    WHEN others THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid listing type');
  END;

  SELECT
    b."Id" AS booking_id,
    b."GuestId" AS guest_id,
    b."ReservationCode" AS reservation_code,
    b."EstatePropertyId" AS property_id,
    b."ListingType" AS booking_listing_type,
    l."Title" AS property_title,
    b."CheckInDate"::timestamptz AS check_in,
    b."CheckOutDate"::timestamptz AS check_out,
    b."Status" AS status_code,
    b."IsDeleted" AS is_deleted,
    b."TotalAmount" AS total_amount,
    b."Currency" AS currency,
    b."MercadoPagoApprovedAt" AS mp_approved_at,
    b."RefundDueAt" AS refund_due_at,
    b."CancellationInitiator" AS cancellation_initiator,
    h.full_name AS hold_full_name,
    h.email AS hold_email,
    h.phone AS hold_phone
  INTO v_booking
  FROM public."Bookings" b
  LEFT JOIN LATERAL (
    SELECT l2."Title"
    FROM public."Listings" l2
    WHERE l2."EstatePropertyId" = b."EstatePropertyId"
      AND l2."IsDeleted" = false
      AND l2."ListingType" = v_listing_type
    ORDER BY l2."IsActive" DESC NULLS LAST, l2."Created" DESC NULLS LAST
    LIMIT 1
  ) l ON true
  LEFT JOIN LATERAL (
    SELECT
      bh.full_name,
      bh.email,
      bh.phone
    FROM public.booking_holds bh
    WHERE bh.property_id = b."EstatePropertyId"
      AND bh.check_in = b."CheckInDate"
      AND bh.check_out = b."CheckOutDate"
      AND bh.status = 'confirmed'
    ORDER BY bh.updated_at DESC NULLS LAST
    LIMIT 1
  ) h ON true
  WHERE b."ReservationCode" = v_code
    AND b."IsDeleted" = false
  ORDER BY b."Created" DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reservation not found');
  END IF;

  IF NOT public.booking_matches_guest_site_listing_type(
    v_booking.booking_listing_type,
    v_booking.property_id,
    v_booking.check_in,
    v_booking.check_out,
    v_listing_type
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reservation not found');
  END IF;

  v_profile := public.resolve_guest_profile(v_booking.guest_id);

  IF v_profile IS NOT NULL THEN
    v_guest_name := nullif(
      trim(coalesce(v_profile->>'firstName', '') || ' ' || coalesce(v_profile->>'lastName', '')),
      ''
    );
    v_guest_email := v_profile->>'email';
    v_guest_phone := v_profile->>'phone';
  ELSE
    v_guest_name := v_booking.hold_full_name;
    v_guest_email := v_booking.hold_email;
    v_guest_phone := v_booking.hold_phone;
  END IF;

  v_status := CASE v_booking.status_code
    WHEN 0 THEN 'pending'
    WHEN 1 THEN 'confirmed'
    WHEN 2 THEN 'cancelled'
    WHEN 3 THEN 'completed'
    ELSE 'unknown'
  END;

  IF v_booking.status_code IN (1, 3) THEN
    v_host_contact := public.resolve_host_contact_for_property(v_booking.property_id);
  END IF;

  IF v_booking.check_out < current_date THEN
    v_is_expired := true;
  END IF;

  IF v_is_expired AND v_status NOT IN ('cancelled', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reservation expired');
  END IF;

  v_window := public.compute_guest_review_window(v_booking.check_out::timestamptz);
  v_window_end := (v_window->>'windowEnd')::timestamptz;
  v_eligible_now := public.guest_review_is_eligible_now(v_booking.check_out::timestamptz);

  SELECT
    r."Id" AS review_id,
    r."Rating" AS rating,
    r."Comment" AS comment,
    coalesce(r."LastModified", r."CreatedAt") AS updated_at
  INTO v_review
  FROM public."Reviews" r
  WHERE r."BookingId" = v_booking.booking_id
  LIMIT 1;

  v_has_existing_review := FOUND;

  IF v_has_existing_review THEN
    v_existing_guest_review := jsonb_build_object(
      'reviewId', v_review.review_id,
      'rating', v_review.rating,
      'comment', v_review.comment,
      'updatedAt', v_review.updated_at
    );
  END IF;

  v_review_base_eligible :=
    NOT coalesce(v_booking.is_deleted, false)
    AND v_booking.status_code IN (1, 3)
    AND v_booking.guest_id IS NOT NULL;

  v_can_submit_guest_review :=
    v_review_base_eligible
    AND v_eligible_now
    AND NOT v_has_existing_review;

  v_can_edit_guest_review :=
    v_review_base_eligible
    AND v_eligible_now
    AND v_has_existing_review;

  v_payment := public.get_booking_mercado_pago_payment_info(v_booking.booking_id);
  v_preview := public.build_cancellation_preview(v_booking.booking_id, 'guest');
  v_can_cancel := coalesce((v_preview->>'canCancel')::boolean, false);

  RETURN jsonb_build_object(
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
      'canCancel', v_can_cancel,
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
      'amountPaid', coalesce((v_payment->>'amount_paid')::numeric, 0),
      'amountDue', coalesce((v_payment->>'amount_due')::numeric, 0),
      'depositAmount', (v_payment->>'deposit_amount')::numeric,
      'paymentStatus', (v_payment->>'payment_status')::integer,
      'refundStatus', (v_payment->>'refund_status')::integer,
      'refundDueAt', coalesce(v_payment->>'refund_due_at', v_booking.refund_due_at::text),
      'cancellationPolicy', v_payment->'cancellation_policy',
      'depositDeadlineAt', v_payment->>'deposit_deadline_at',
      'balanceDueAt', v_payment->>'balance_due_at',
      'cancellationInitiator', coalesce(
        v_payment->>'cancellation_initiator',
        v_booking.cancellation_initiator
      ),
      'mercadoPagoApproved', coalesce((v_payment->>'mercado_pago_approved')::boolean, false),
      'mercadoPagoApprovedAt', v_payment->>'mercado_pago_approved_at',
      'canPayOnline', coalesce((v_payment->>'can_pay_online')::boolean, false),
      'sellerConnected', coalesce((v_payment->>'seller_connected')::boolean, false)
    )
  );
END;
$fn$;
