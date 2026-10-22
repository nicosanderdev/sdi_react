-- Reservation codes stay a public lookup: view, reviews, and offline help.
-- Pay and guest cancel require a manage token. Reissue revokes every active token.

-- ---------------------------------------------------------------------------
-- Code lookup never advertises pay or cancel
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
      'canCancel', false,
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
      'canPayOnline', false,
      'sellerConnected', coalesce((v_payment->>'seller_connected')::boolean, false)
    )
  );
END;
$fn$;

COMMENT ON FUNCTION public.get_reservation_by_code(text, text) IS
  'Public reservation lookup. canCancel and canPayOnline are always false. Reviews and booking facts stay on this code.';

-- ---------------------------------------------------------------------------
-- Anonymous cancel-by-code and cancel-by-booking-id refuse
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
BEGIN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Use the manage link to cancel this booking'
  );
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
BEGIN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Use the manage link to cancel this booking'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_reservation(reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Use the manage link to cancel this booking'
  );
END;
$$;

-- Minting a token is a service-role action. confirm_booking_from_hold calls it as definer.
REVOKE ALL ON FUNCTION public.issue_booking_manage_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_booking_manage_token(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Reissue rate limit: 3 / code / hour, 10 / IP / hour
-- ---------------------------------------------------------------------------

CREATE TABLE public.manage_link_request_rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    key text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    hits integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT manage_link_request_rate_limits_pkey PRIMARY KEY (id),
    CONSTRAINT manage_link_request_rate_limits_hits_check CHECK (hits >= 0),
    CONSTRAINT manage_link_request_rate_limits_scope_check CHECK (
      scope = ANY (ARRAY['code'::text, 'ip'::text])
    ),
    CONSTRAINT manage_link_request_rate_limits_scope_key_window_key UNIQUE (scope, key, window_start)
);

COMMENT ON TABLE public.manage_link_request_rate_limits IS
  'Fixed-hour counters for request-booking-manage-link. Service role only.';

ALTER TABLE public.manage_link_request_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.manage_link_request_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.manage_link_request_rate_limits TO service_role;

CREATE FUNCTION public.check_and_increment_manage_link_rate_limit(
  p_code text,
  p_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := now();
  v_window_start timestamptz := date_trunc('hour', v_now);
  v_code text := upper(trim(coalesce(p_code, '')));
  v_ip text := nullif(trim(coalesce(p_ip, '')), '');
  v_code_hits integer;
  v_ip_hits integer;
BEGIN
  IF v_code <> '' THEN
    INSERT INTO public.manage_link_request_rate_limits (scope, key, window_start, hits)
    VALUES ('code', v_code, v_window_start, 1)
    ON CONFLICT (scope, key, window_start)
    DO UPDATE SET
      hits = public.manage_link_request_rate_limits.hits + 1,
      updated_at = now()
    RETURNING hits INTO v_code_hits;

    IF v_code_hits > 3 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'code_rate_limited');
    END IF;
  END IF;

  IF v_ip IS NOT NULL THEN
    INSERT INTO public.manage_link_request_rate_limits (scope, key, window_start, hits)
    VALUES ('ip', v_ip, v_window_start, 1)
    ON CONFLICT (scope, key, window_start)
    DO UPDATE SET
      hits = public.manage_link_request_rate_limits.hits + 1,
      updated_at = now()
    RETURNING hits INTO v_ip_hits;

    IF v_ip_hits > 10 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'ip_rate_limited');
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

COMMENT ON FUNCTION public.check_and_increment_manage_link_rate_limit(text, text) IS
  '3 requests per reservation code per clock hour, then 10 per IP. Stops before the IP bucket when the code bucket is already over.';

REVOKE ALL ON FUNCTION public.check_and_increment_manage_link_rate_limit(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_manage_link_rate_limit(text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Match code + email, revoke active tokens, issue one new token
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.reissue_booking_manage_link(
  p_reservation_code text,
  p_listing_type text,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_resolved jsonb;
  v_booking_id uuid;
  v_booking record;
  v_profile jsonb;
  v_stored_email text;
  v_given_email text := lower(trim(coalesce(p_email, '')));
  v_issued jsonb;
  v_property_title text;
BEGIN
  v_resolved := public.resolve_guest_booking_by_code(p_reservation_code, p_listing_type);
  IF NOT coalesce((v_resolved->>'success')::boolean, false) THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  v_booking_id := (v_resolved->>'booking_id')::uuid;

  SELECT
    b."Id" AS booking_id,
    b."GuestId" AS guest_id,
    b."ReservationCode" AS reservation_code,
    b."EstatePropertyId" AS property_id,
    b."CheckInDate" AS check_in,
    b."CheckOutDate" AS check_out,
    b."ListingType" AS listing_type
  INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = v_booking_id
    AND b."IsDeleted" = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  v_profile := public.resolve_guest_profile(v_booking.guest_id);
  IF v_profile IS NOT NULL THEN
    v_stored_email := v_profile->>'email';
  ELSE
    SELECT bh.email
      INTO v_stored_email
    FROM public.booking_holds bh
    WHERE bh.property_id = v_booking.property_id
      AND bh.check_in = v_booking.check_in
      AND bh.check_out = v_booking.check_out
      AND bh.status = 'confirmed'
    ORDER BY bh.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_given_email = ''
     OR lower(trim(coalesce(v_stored_email, ''))) = ''
     OR lower(trim(v_stored_email)) <> v_given_email THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  UPDATE public.booking_manage_tokens
  SET revoked_at = now()
  WHERE booking_id = v_booking_id
    AND revoked_at IS NULL;

  v_issued := public.issue_booking_manage_token(v_booking_id);
  IF NOT coalesce((v_issued->>'success')::boolean, false)
     OR nullif(trim(coalesce(v_issued->>'token', '')), '') IS NULL THEN
    RAISE EXCEPTION 'manage token issue failed';
  END IF;

  SELECT l."Title"
    INTO v_property_title
  FROM public."Listings" l
  WHERE l."EstatePropertyId" = v_booking.property_id
    AND l."IsDeleted" = false
    AND l."ListingType" = v_booking.listing_type
  ORDER BY l."IsActive" DESC NULLS LAST, l."Created" DESC NULLS LAST
  LIMIT 1;

  RETURN jsonb_build_object(
    'matched', true,
    'token', v_issued->>'token',
    'expires_at', v_issued->>'expires_at',
    'email', trim(v_stored_email),
    'reservation_code', v_booking.reservation_code,
    'listing_type', v_booking.listing_type::text,
    'property_title', v_property_title
  );
END;
$$;

COMMENT ON FUNCTION public.reissue_booking_manage_link(text, text, text) IS
  'When the reservation code and guest email match, revoke active manage tokens and return one new token. Mismatches return matched=false with no other detail.';

REVOKE ALL ON FUNCTION public.reissue_booking_manage_link(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reissue_booking_manage_link(text, text, text) TO service_role;
