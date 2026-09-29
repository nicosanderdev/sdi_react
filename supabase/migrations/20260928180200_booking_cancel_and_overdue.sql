-- Part 3: cancel preview/execute, auto-confirm on deposit, public content,
-- overdue cancel batch, admin refund compliance list.

-- ---------------------------------------------------------------------------
-- Auto-confirm when deposit (or full payment) is met
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.try_auto_confirm_paid_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking record;
  v_seller jsonb;
  v_subject_type text;
  v_subject_id uuid;
  v_limit jsonb;
  v_now timestamptz := timezone('utc', now());
  v_net numeric;
  v_deposit numeric;
BEGIN
  IF p_booking_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing booking id');
  END IF;

  SELECT
    b."Id",
    b."Status",
    b."PaymentStatus",
    b."MercadoPagoApprovedAt",
    b."EstatePropertyId",
    b."IsDeleted",
    b."DepositAmount",
    b."TotalAmount",
    b."AmountPaid"
  INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id
  FOR UPDATE;

  IF NOT FOUND OR v_booking."IsDeleted" THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking."Status" = 1 THEN
    RETURN jsonb_build_object(
      'success', true,
      'confirmed', false,
      'already_confirmed', true,
      'booking_id', p_booking_id
    );
  END IF;

  IF v_booking."Status" <> 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'confirmed', false,
      'skipped_reason', 'not_pending',
      'booking_id', p_booking_id
    );
  END IF;

  v_net := public.booking_ledger_net_paid(p_booking_id);
  v_deposit := coalesce(v_booking."DepositAmount", v_booking."TotalAmount", 0);

  -- Confirm once deposit is covered (partial OK). Full pay still confirms.
  IF v_net + 0.009 < v_deposit THEN
    RETURN jsonb_build_object(
      'success', true,
      'confirmed', false,
      'skipped_reason', 'deposit_not_paid',
      'booking_id', p_booking_id
    );
  END IF;

  v_seller := public.resolve_mercado_pago_seller_for_property(v_booking."EstatePropertyId");
  IF coalesce(v_seller->>'success', 'false') <> 'true' THEN
    -- Manual/owner-recorded deposit without MP seller: still allow confirm
    IF coalesce(v_booking."MercadoPagoApprovedAt"::text, '') = ''
       AND NOT EXISTS (
         SELECT 1 FROM public."BookingPayments" bp
         WHERE bp."BookingId" = p_booking_id AND bp."EntryType" = 'payment'
       ) THEN
      RETURN jsonb_build_object(
        'success', true,
        'confirmed', false,
        'skipped_reason', 'seller_not_connected',
        'error_code', v_seller->>'error_code',
        'booking_id', p_booking_id
      );
    END IF;
  END IF;

  SELECT r.subject_type, r.member_or_company_id
  INTO v_subject_type, v_subject_id
  FROM public.resolve_property_billing_subject(v_booking."EstatePropertyId") r
  LIMIT 1;

  IF v_subject_id IS NOT NULL THEN
    v_limit := public.flexible_usage_limit_check(
      v_subject_type,
      v_subject_id,
      'booking',
      p_booking_id::text
    );
    IF coalesce((v_limit->>'allowed')::boolean, false) IS NOT TRUE THEN
      RETURN jsonb_build_object(
        'success', true,
        'confirmed', false,
        'skipped_reason', 'limit_exceeded',
        'limit', v_limit,
        'booking_id', p_booking_id
      );
    END IF;
  END IF;

  UPDATE public."Bookings"
  SET
    "Status" = 1,
    "LastModified" = v_now,
    "LastModifiedBy" = 'system-auto-confirm'
  WHERE "Id" = p_booking_id
    AND "Status" = 0;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'confirmed', false,
      'already_confirmed', true,
      'booking_id', p_booking_id
    );
  END IF;

  BEGIN
    PERFORM public.record_booking_usage_record(p_booking_id, v_booking."EstatePropertyId");
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'confirmed', true,
    'booking_id', p_booking_id,
    'estate_property_id', v_booking."EstatePropertyId"
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_auto_confirm_paid_booking(uuid) TO service_role;

-- Also attempt auto-confirm after manual payment recording
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
  v_result jsonb;
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

  IF v_booking."Status" = 0 THEN
    PERFORM public.try_auto_confirm_paid_booking(p_booking_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'payment_id', v_id, 'already_recorded', false);
END;
$$;

-- ---------------------------------------------------------------------------
-- Cancel preview + execute
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.build_cancellation_preview(
  p_booking_id uuid,
  p_initiator text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_booking record;
  v_policy jsonb;
  v_paid numeric;
  v_percent numeric := 0;
  v_refund numeric := 0;
  v_tier text := 'n/a';
  v_today date := public.montevideo_today();
  v_can boolean := true;
  v_msg text := NULL;
  v_hash text;
  v_due timestamptz;
BEGIN
  SELECT * INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id AND b."IsDeleted" = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking."Status" NOT IN (0, 1) THEN
    v_can := false;
    v_msg := 'Reservation cannot be cancelled';
  ELSIF v_booking."CheckInDate" <= v_today THEN
    v_can := false;
    v_msg := 'Reservation expired';
  END IF;

  v_policy := coalesce(v_booking."CancellationPolicySnapshot", public.default_cancellation_policy_json());
  v_paid := public.booking_ledger_net_paid(p_booking_id);

  IF p_initiator IN ('host', 'admin') THEN
    v_percent := CASE WHEN v_paid > 0 THEN 100 ELSE 0 END;
    v_tier := 'host_full';
  ELSIF p_initiator IN ('guest', 'system') THEN
    v_percent := public.cancellation_refund_percent(v_policy, v_booking."CheckInDate", v_today);
    IF v_today < public.cancellation_cutoff_date(
      v_booking."CheckInDate",
      coalesce((v_policy->>'freeCancellationDays')::integer, 0)
    ) THEN
      v_tier := 'before';
    ELSE
      v_tier := 'after';
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid initiator');
  END IF;

  v_refund := round(v_paid * (v_percent / 100.0), 2);
  v_due := CASE WHEN v_refund > 0.009 THEN timezone('utc', now()) + interval '7 days' ELSE NULL END;

  v_hash := encode(
    digest(
      p_booking_id::text || '|' || p_initiator || '|' || v_refund::text || '|' || v_percent::text || '|' || v_paid::text,
      'sha256'
    ),
    'hex'
  );

  RETURN jsonb_build_object(
    'success', true,
    'bookingId', p_booking_id,
    'initiator', p_initiator,
    'canCancel', v_can,
    'policyTier', v_tier,
    'amountPaid', v_paid,
    'refundPercent', v_percent,
    'refundAmount', v_refund,
    'refundDueAt', v_due,
    'policySnapshot', v_policy,
    'previewHash', v_hash,
    'message', v_msg,
    'checkInDate', v_booking."CheckInDate",
    'status', v_booking."Status"
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.execute_booking_cancellation(
  p_booking_id uuid,
  p_initiator text,
  p_reason text DEFAULT NULL,
  p_preview_hash text DEFAULT NULL,
  p_actor text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking record;
  v_preview jsonb;
  v_now timestamptz := timezone('utc', now());
  v_actor text;
BEGIN
  SELECT * INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id AND b."IsDeleted" = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  v_preview := public.build_cancellation_preview(p_booking_id, p_initiator);

  IF NOT coalesce((v_preview->>'success')::boolean, false) THEN
    RETURN v_preview;
  END IF;

  IF NOT coalesce((v_preview->>'canCancel')::boolean, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', coalesce(v_preview->>'message', 'Cannot cancel'),
      'preview', v_preview
    );
  END IF;

  IF p_preview_hash IS NOT NULL AND p_preview_hash <> (v_preview->>'previewHash') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cancellation preview changed; refresh and try again',
      'error_code', 'PREVIEW_MISMATCH',
      'preview', v_preview
    );
  END IF;

  IF p_initiator IN ('host', 'admin') AND (p_reason IS NULL OR length(trim(p_reason)) = 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason required');
  END IF;

  v_actor := coalesce(p_actor, p_initiator);

  UPDATE public."Bookings"
  SET
    "Status" = 2,
    "CancellationInitiator" = p_initiator,
    "CancellationReason" = nullif(trim(p_reason), ''),
    "CancelledAt" = v_now,
    "RefundStatus" = CASE
      WHEN coalesce((v_preview->>'refundAmount')::numeric, 0) > 0.009 THEN 1
      ELSE 0
    END,
    "RefundDueAt" = CASE
      WHEN coalesce((v_preview->>'refundAmount')::numeric, 0) > 0.009
      THEN (v_preview->>'refundDueAt')::timestamptz
      ELSE NULL
    END,
    "LastModified" = v_now,
    "LastModifiedBy" = v_actor
  WHERE "Id" = p_booking_id;

  UPDATE public.booking_manage_tokens
  SET revoked_at = coalesce(revoked_at, v_now)
  WHERE booking_id = p_booking_id
    AND revoked_at IS NULL;

  PERFORM public.refresh_booking_payment_summary(p_booking_id);

  RETURN jsonb_build_object(
    'success', true,
    'status', 'cancelled',
    'preview', v_preview
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_booking_cancellation(p_booking_id uuid, p_initiator text DEFAULT 'host')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id AND b."IsDeleted" = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF p_initiator = 'admin' THEN
    IF NOT public.is_admin() THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
    END IF;
  ELSIF p_initiator = 'host' THEN
    IF NOT (
      public.is_admin()
      OR public.user_can_manage_estate_property(v_booking."EstatePropertyId")
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid initiator for dashboard preview');
  END IF;

  RETURN public.build_cancellation_preview(p_booking_id, p_initiator);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking_as_host(
  p_booking_id uuid,
  p_reason text,
  p_preview_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking record;
  v_member_id text;
  v_initiator text := 'host';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id AND b."IsDeleted" = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF public.is_admin() AND NOT public.user_can_manage_estate_property(v_booking."EstatePropertyId") THEN
    v_initiator := 'admin';
  ELSIF NOT (
    public.is_admin()
    OR public.user_can_manage_estate_property(v_booking."EstatePropertyId")
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  SELECT m."Id"::text INTO v_member_id
  FROM public."Members" m
  WHERE m."UserId" = auth.uid() AND m."IsDeleted" = false
  LIMIT 1;

  RETURN public.execute_booking_cancellation(
    p_booking_id,
    v_initiator,
    p_reason,
    p_preview_hash,
    coalesce(v_member_id, auth.uid()::text)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_booking_cancellation_by_manage_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_token_hash text;
  v_booking_id uuid;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing token');
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT t.booking_id INTO v_booking_id
  FROM public.booking_manage_tokens t
  WHERE t.token_hash = v_token_hash
    AND t.revoked_at IS NULL
    AND t.expires_at > now()
  LIMIT 1;

  IF v_booking_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired token');
  END IF;

  RETURN public.build_cancellation_preview(v_booking_id, 'guest');
END;
$$;

DROP FUNCTION IF EXISTS public.cancel_booking_by_manage_token(text, text);
DROP FUNCTION IF EXISTS public.cancel_booking_by_manage_token(text, text, text);

CREATE OR REPLACE FUNCTION public.cancel_booking_by_manage_token(
  p_token text,
  p_reason text DEFAULT NULL,
  p_preview_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_token_hash text;
  v_booking_id uuid;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing token');
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT t.booking_id INTO v_booking_id
  FROM public.booking_manage_tokens t
  WHERE t.token_hash = v_token_hash
    AND t.revoked_at IS NULL
    AND t.expires_at > now()
  LIMIT 1;

  IF v_booking_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired token');
  END IF;

  RETURN public.execute_booking_cancellation(
    v_booking_id,
    'guest',
    p_reason,
    p_preview_hash,
    'guest-manage-token'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_booking_cancellation(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_booking_as_host(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_booking_cancellation_by_manage_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_booking_by_manage_token(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.build_cancellation_preview(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_booking_cancellation(uuid, text, text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Overdue cancel batch (called by edge cron)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_overdue_bookings(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row record;
  v_count integer := 0;
  v_deposit_cancels integer := 0;
  v_balance_cancels integer := 0;
  v_now timestamptz := timezone('utc', now());
  v_net numeric;
  v_result jsonb;
  v_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  FOR v_row IN
    SELECT b.*
    FROM public."Bookings" b
    WHERE b."IsDeleted" = false
      AND b."Status" IN (0, 1)
      AND (
        -- Missed deposit
        (
          b."DepositDeadlineAt" IS NOT NULL
          AND b."DepositDeadlineAt" < v_now
          AND coalesce(b."AmountPaid", 0) < coalesce(b."DepositAmount", b."TotalAmount", 0)
        )
        OR
        -- Missed balance (deposit already paid, remaining unpaid)
        (
          b."BalanceDueAt" IS NOT NULL
          AND b."BalanceDueAt" < v_now
          AND coalesce(b."AmountPaid", 0) + 0.009 < coalesce(b."TotalAmount", 0)
          AND coalesce(b."AmountPaid", 0) + 0.009 >= coalesce(b."DepositAmount", 0)
        )
      )
    ORDER BY b."Created" ASC
    LIMIT GREATEST(coalesce(p_limit, 100), 1)
    FOR UPDATE SKIP LOCKED
  LOOP
    v_net := public.booking_ledger_net_paid(v_row."Id");

    IF v_row."DepositDeadlineAt" IS NOT NULL
       AND v_row."DepositDeadlineAt" < v_now
       AND v_net + 0.009 < coalesce(v_row."DepositAmount", v_row."TotalAmount", 0) THEN
      v_result := public.execute_booking_cancellation(
        v_row."Id", 'system', 'Deposit payment overdue', NULL, 'bookings-overdue-cancel'
      );
      IF coalesce((v_result->>'success')::boolean, false) THEN
        v_deposit_cancels := v_deposit_cancels + 1;
        v_count := v_count + 1;
        v_ids := array_append(v_ids, v_row."Id");
      END IF;
    ELSIF v_row."BalanceDueAt" IS NOT NULL
          AND v_row."BalanceDueAt" < v_now
          AND v_net + 0.009 < coalesce(v_row."TotalAmount", 0) THEN
      -- Treat as guest cancellation at this moment (policy applies to deposit)
      v_result := public.execute_booking_cancellation(
        v_row."Id", 'system', 'Balance payment overdue', NULL, 'bookings-overdue-cancel'
      );
      IF coalesce((v_result->>'success')::boolean, false) THEN
        v_balance_cancels := v_balance_cancels + 1;
        v_count := v_count + 1;
        v_ids := array_append(v_ids, v_row."Id");
      END IF;
    END IF;
  END LOOP;

  -- Mark overdue refunds
  UPDATE public."Bookings" b
  SET "RefundStatus" = 4, "LastModified" = v_now
  WHERE b."Status" = 2
    AND b."RefundStatus" IN (1, 2)
    AND b."RefundDueAt" IS NOT NULL
    AND b."RefundDueAt" < v_now
    AND coalesce(b."AmountPaid", 0) > 0.009;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled', v_count,
    'depositCancels', v_deposit_cancels,
    'balanceCancels', v_balance_cancels,
    'bookingIds', to_jsonb(v_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_overdue_bookings(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_overdue_bookings(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Public property content includes cancellationPolicy
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_property_content(
  p_property_id uuid,
  p_listing_type public."ListingType" DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_listing_type public."ListingType";
  v_property_type public."PropertyType";
BEGIN
  IF p_property_id IS NULL THEN
    RAISE EXCEPTION 'p_property_id is required';
  END IF;

  IF NOT public.is_public_estate_property(p_property_id) THEN
    RETURN jsonb_build_object(
      'policies', '[]'::jsonb,
      'contentSections', '[]'::jsonb,
      'amenities', '[]'::jsonb,
      'cancellationPolicy', NULL
    );
  END IF;

  v_listing_type := p_listing_type;
  IF v_listing_type IS NULL THEN
    SELECT l."ListingType"
      INTO v_listing_type
    FROM public."Listings" l
    WHERE l."EstatePropertyId" = p_property_id
      AND l."IsDeleted" = false
      AND l."IsActive" = true
      AND l."IsPropertyVisible" = true
    ORDER BY l."IsFeatured" DESC, l."Created" DESC
    LIMIT 1;
  END IF;

  IF v_listing_type IS NULL THEN
    RETURN jsonb_build_object(
      'policies', '[]'::jsonb,
      'contentSections', '[]'::jsonb,
      'amenities', '[]'::jsonb,
      'cancellationPolicy', public.get_property_cancellation_policy_json(p_property_id)
    );
  END IF;

  v_property_type := public.listing_type_to_section_property_type(v_listing_type);

  RETURN jsonb_build_object(
    'policies', public.build_property_policies_json(p_property_id, v_listing_type),
    'contentSections', public.build_property_content_sections_json(p_property_id, v_property_type),
    'amenities', public.build_property_amenities_json(p_property_id),
    'cancellationPolicy', public.get_property_cancellation_policy_json(p_property_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_property_content(uuid, public."ListingType")
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admin refund compliance list
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_booking_refunds(
  p_owner_search text DEFAULT NULL,
  p_refund_status integer DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_items jsonb;
  v_total integer;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin only');
  END IF;

  WITH filtered AS (
    SELECT
      b."Id" AS booking_id,
      b."ReservationCode" AS reservation_code,
      b."EstatePropertyId" AS property_id,
      coalesce(
        (
          SELECT l."Title"
          FROM public."Listings" l
          WHERE l."EstatePropertyId" = b."EstatePropertyId"
            AND l."IsDeleted" = false
          ORDER BY l."IsFeatured" DESC NULLS LAST, l."Created" DESC
          LIMIT 1
        ),
        b."ReservationCode"
      ) AS property_title,
      b."TotalAmount" AS total_amount,
      b."AmountPaid" AS amount_paid,
      b."Currency" AS currency,
      b."RefundStatus" AS refund_status,
      b."RefundDueAt" AS refund_due_at,
      b."CancellationInitiator" AS cancellation_initiator,
      b."CancelledAt" AS cancelled_at,
      b."CancellationPolicySnapshot" AS policy_snapshot,
      public.booking_ledger_refunded(b."Id") AS amount_refunded,
      coalesce(m."Email", c."BillingEmail") AS owner_email,
      coalesce(
        nullif(trim(coalesce(m."FirstName", '') || ' ' || coalesce(m."LastName", '')), ''),
        c."Name",
        coalesce(m."Email", c."BillingEmail")
      ) AS owner_name
    FROM public."Bookings" b
    JOIN public."EstateProperties" ep ON ep."Id" = b."EstatePropertyId"
    JOIN public."Owners" o ON o."Id" = ep."OwnerId" AND o."IsDeleted" = false
    LEFT JOIN public."Members" m ON m."Id" = o."MemberId"
    LEFT JOIN public."Companies" c ON c."Id" = o."CompanyId"
    WHERE b."IsDeleted" = false
      AND b."Status" = 2
      AND b."RefundStatus" IN (1, 2, 3, 4)
      AND (p_refund_status IS NULL OR b."RefundStatus" = p_refund_status)
      AND (
        p_owner_search IS NULL
        OR length(trim(p_owner_search)) = 0
        OR coalesce(m."Email", c."BillingEmail", '') ILIKE '%' || trim(p_owner_search) || '%'
        OR coalesce(m."FirstName", '') ILIKE '%' || trim(p_owner_search) || '%'
        OR coalesce(m."LastName", '') ILIKE '%' || trim(p_owner_search) || '%'
        OR coalesce(c."Name", '') ILIKE '%' || trim(p_owner_search) || '%'
      )
  )
  SELECT
    coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.cancelled_at DESC NULLS LAST), '[]'::jsonb),
    (SELECT count(*)::integer FROM filtered)
  INTO v_items, v_total
  FROM (
    SELECT * FROM filtered
    ORDER BY cancelled_at DESC NULLS LAST
    LIMIT GREATEST(coalesce(p_limit, 50), 1)
    OFFSET GREATEST(coalesce(p_offset, 0), 0)
  ) f;

  RETURN jsonb_build_object(
    'success', true,
    'items', coalesce(v_items, '[]'::jsonb),
    'total', coalesce(v_total, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_booking_refunds(text, integer, integer, integer)
  TO authenticated, service_role;
