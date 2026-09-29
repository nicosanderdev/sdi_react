-- Booking cancellation policies, partial payments ledger, cancel preview,
-- overdue auto-cancel helpers. Default policy backfill for all properties.

-- ---------------------------------------------------------------------------
-- 1) Property cancellation policy (one active row per estate property)
-- ---------------------------------------------------------------------------

CREATE TABLE public."EstatePropertyCancellationPolicy" (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "EstatePropertyId" uuid NOT NULL REFERENCES public."EstateProperties"("Id"),
  "FreeCancellationDays" integer NOT NULL DEFAULT 7
    CHECK ("FreeCancellationDays" >= 0),
  "RefundPercentBefore" numeric(5,2) NOT NULL DEFAULT 100
    CHECK ("RefundPercentBefore" >= 0 AND "RefundPercentBefore" <= 100),
  "RefundPercentAfter" numeric(5,2) NOT NULL DEFAULT 0
    CHECK ("RefundPercentAfter" >= 0 AND "RefundPercentAfter" <= 100),
  "DepositPercent" numeric(5,2) NOT NULL DEFAULT 100
    CHECK ("DepositPercent" > 0 AND "DepositPercent" <= 100),
  "BalanceDueDays" integer
    CHECK ("BalanceDueDays" IS NULL OR "BalanceDueDays" >= 0),
  "IsDeleted" boolean NOT NULL DEFAULT false,
  "Created" timestamptz NOT NULL DEFAULT timezone('utc', now()),
  "CreatedBy" text,
  "LastModified" timestamptz NOT NULL DEFAULT timezone('utc', now()),
  "LastModifiedBy" text,
  CONSTRAINT estate_property_cancellation_policy_balance_check CHECK (
    ("DepositPercent" = 100 AND "BalanceDueDays" IS NULL)
    OR ("DepositPercent" < 100 AND "BalanceDueDays" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX estate_property_cancellation_policy_one_active
  ON public."EstatePropertyCancellationPolicy" ("EstatePropertyId")
  WHERE "IsDeleted" = false;

COMMENT ON TABLE public."EstatePropertyCancellationPolicy" IS
  'One active cancellation/deposit policy per property; applies to all listing types.';

ALTER TABLE public."EstatePropertyCancellationPolicy" ENABLE ROW LEVEL SECURITY;

CREATE POLICY estate_property_cancellation_policy_select
  ON public."EstatePropertyCancellationPolicy" FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.user_can_manage_estate_property("EstatePropertyId")
  );

CREATE POLICY estate_property_cancellation_policy_write
  ON public."EstatePropertyCancellationPolicy" FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR public.user_can_manage_estate_property("EstatePropertyId")
  )
  WITH CHECK (
    public.is_admin()
    OR public.user_can_manage_estate_property("EstatePropertyId")
  );

CREATE POLICY estate_property_cancellation_policy_service
  ON public."EstatePropertyCancellationPolicy" FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2) Booking ledger + booking columns
-- ---------------------------------------------------------------------------

CREATE TABLE public."BookingPayments" (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "BookingId" uuid NOT NULL REFERENCES public."Bookings"("Id"),
  "EntryType" text NOT NULL
    CHECK ("EntryType" IN ('payment', 'refund', 'reversal')),
  "Amount" numeric(12,2) NOT NULL CHECK ("Amount" > 0),
  "Currency" integer NOT NULL DEFAULT 1,
  "Source" text NOT NULL
    CHECK ("Source" IN ('mercado_pago', 'owner', 'admin', 'system')),
  "Method" text
    CHECK ("Method" IS NULL OR "Method" IN ('mercado_pago', 'cash', 'transfer', 'other')),
  "RecordedBy" text NOT NULL,
  "Note" text,
  "MpPaymentId" text,
  "MpAttemptId" uuid,
  "ReversesPaymentId" uuid REFERENCES public."BookingPayments"("Id"),
  "Created" timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT booking_payments_reversal_requires_target CHECK (
    ("EntryType" <> 'reversal') OR ("ReversesPaymentId" IS NOT NULL)
  )
);

CREATE INDEX booking_payments_booking_id_idx
  ON public."BookingPayments" ("BookingId", "Created");

CREATE UNIQUE INDEX booking_payments_mp_payment_unique
  ON public."BookingPayments" ("MpPaymentId", "EntryType")
  WHERE "MpPaymentId" IS NOT NULL AND "EntryType" = 'payment';

COMMENT ON TABLE public."BookingPayments" IS
  'Immutable ledger of booking payments, refunds, and reversals. Who marked paid lives in Source/RecordedBy.';

ALTER TABLE public."BookingPayments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY booking_payments_select
  ON public."BookingPayments" FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public."Bookings" b
      WHERE b."Id" = "BookingId"
        AND public.user_can_manage_estate_property(b."EstatePropertyId")
    )
  );

CREATE POLICY booking_payments_service
  ON public."BookingPayments" FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- PaymentStatus: 0 Unpaid, 1 Paid, 2 PartiallyPaid, 3 PartiallyRefunded, 4 Refunded
COMMENT ON COLUMN public."Bookings"."PaymentStatus" IS
  '0=Unpaid, 1=Paid, 2=PartiallyPaid, 3=PartiallyRefunded, 4=Refunded. Maintained from BookingPayments ledger.';

ALTER TABLE public."Bookings"
  ADD COLUMN IF NOT EXISTS "CancellationPolicySnapshot" jsonb,
  ADD COLUMN IF NOT EXISTS "CancellationInitiator" text
    CHECK (
      "CancellationInitiator" IS NULL
      OR "CancellationInitiator" IN ('guest', 'host', 'admin', 'system')
    ),
  ADD COLUMN IF NOT EXISTS "CancellationReason" text,
  ADD COLUMN IF NOT EXISTS "CancelledAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "RefundStatus" integer NOT NULL DEFAULT 0
    CHECK ("RefundStatus" BETWEEN 0 AND 4),
  ADD COLUMN IF NOT EXISTS "RefundDueAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "DepositAmount" numeric(12,2),
  ADD COLUMN IF NOT EXISTS "DepositDeadlineAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "BalanceDueAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "AmountPaid" numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "PolicyIsLegacy" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public."Bookings"."RefundStatus" IS
  '0=NotRequired, 1=Owed, 2=PartiallyRefunded, 3=Refunded, 4=Overdue';

ALTER TABLE public.booking_holds
  ADD COLUMN IF NOT EXISTS cancellation_policy_snapshot jsonb;

-- ---------------------------------------------------------------------------
-- 3) Defaults + helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.default_cancellation_policy_json()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'freeCancellationDays', 7,
    'refundPercentBefore', 100,
    'refundPercentAfter', 0,
    'depositPercent', 100,
    'balanceDueDays', null
  );
$$;

CREATE OR REPLACE FUNCTION public.cancellation_policy_row_to_json(
  p_row public."EstatePropertyCancellationPolicy"
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'freeCancellationDays', p_row."FreeCancellationDays",
    'refundPercentBefore', p_row."RefundPercentBefore",
    'refundPercentAfter', p_row."RefundPercentAfter",
    'depositPercent', p_row."DepositPercent",
    'balanceDueDays', p_row."BalanceDueDays"
  );
$$;

CREATE OR REPLACE FUNCTION public.get_property_cancellation_policy_json(
  p_property_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public."EstatePropertyCancellationPolicy"%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public."EstatePropertyCancellationPolicy" p
  WHERE p."EstatePropertyId" = p_property_id
    AND p."IsDeleted" = false
  LIMIT 1;

  IF FOUND THEN
    RETURN public.cancellation_policy_row_to_json(v_row);
  END IF;

  RETURN public.default_cancellation_policy_json();
END;
$$;

CREATE OR REPLACE FUNCTION public.montevideo_today()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (timezone('America/Montevideo', now()))::date;
$$;

CREATE OR REPLACE FUNCTION public.cancellation_cutoff_date(
  p_check_in date,
  p_free_days integer
)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_check_in - GREATEST(coalesce(p_free_days, 0), 0));
$$;

-- Refund % for guest/system-as-guest at a given moment (Montevideo today).
CREATE OR REPLACE FUNCTION public.cancellation_refund_percent(
  p_policy jsonb,
  p_check_in date,
  p_as_of date DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_as_of date := coalesce(p_as_of, p_check_in);
  v_cutoff date;
BEGIN
  IF p_policy IS NULL THEN
    RETURN 0;
  END IF;
  v_cutoff := public.cancellation_cutoff_date(
    p_check_in,
    coalesce((p_policy->>'freeCancellationDays')::integer, 0)
  );
  -- Exactly on cutoff → lower tier
  IF v_as_of < v_cutoff THEN
    RETURN coalesce((p_policy->>'refundPercentBefore')::numeric, 0);
  END IF;
  RETURN coalesce((p_policy->>'refundPercentAfter')::numeric, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.booking_ledger_net_paid(p_booking_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(sum(
    CASE
      WHEN "EntryType" = 'payment' THEN "Amount"
      WHEN "EntryType" IN ('refund', 'reversal') THEN -"Amount"
      ELSE 0
    END
  ), 0)
  FROM public."BookingPayments"
  WHERE "BookingId" = p_booking_id;
$$;

CREATE OR REPLACE FUNCTION public.booking_ledger_gross_paid(p_booking_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(sum("Amount"), 0)
  FROM public."BookingPayments"
  WHERE "BookingId" = p_booking_id
    AND "EntryType" = 'payment';
$$;

CREATE OR REPLACE FUNCTION public.booking_ledger_refunded(p_booking_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(sum("Amount"), 0)
  FROM public."BookingPayments"
  WHERE "BookingId" = p_booking_id
    AND "EntryType" = 'refund';
$$;

CREATE OR REPLACE FUNCTION public.refresh_booking_payment_summary(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking record;
  v_net numeric;
  v_gross numeric;
  v_refunded numeric;
  v_total numeric;
  v_payment_status integer;
  v_refund_status integer;
  v_now timestamptz := timezone('utc', now());
BEGIN
  SELECT *
  INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_net := public.booking_ledger_net_paid(p_booking_id);
  v_gross := public.booking_ledger_gross_paid(p_booking_id);
  v_refunded := public.booking_ledger_refunded(p_booking_id);
  v_total := coalesce(v_booking."TotalAmount", 0);

  IF v_net <= 0.009 AND v_refunded <= 0.009 THEN
    v_payment_status := 0; -- Unpaid
  ELSIF v_refunded > 0.009 AND v_net <= 0.009 THEN
    v_payment_status := 4; -- Refunded
  ELSIF v_refunded > 0.009 AND v_net > 0.009 THEN
    v_payment_status := 3; -- PartiallyRefunded
  ELSIF v_net + 0.009 >= v_total THEN
    v_payment_status := 1; -- Paid
  ELSE
    v_payment_status := 2; -- PartiallyPaid
  END IF;

  -- RefundStatus when cancelled (or money on cancelled booking)
  IF v_booking."Status" = 2 THEN
    IF coalesce(v_booking."RefundStatus", 0) = 0 AND v_net <= 0.009 THEN
      v_refund_status := 0;
    ELSIF v_net <= 0.009 AND v_refunded > 0.009 THEN
      v_refund_status := 3; -- Refunded
    ELSIF v_refunded > 0.009 AND v_net > 0.009 THEN
      v_refund_status := 2; -- PartiallyRefunded
    ELSIF v_booking."RefundDueAt" IS NOT NULL
          AND v_booking."RefundDueAt" < v_now
          AND v_net > 0.009 THEN
      v_refund_status := 4; -- Overdue
    ELSIF v_net > 0.009 THEN
      v_refund_status := 1; -- Owed
    ELSE
      v_refund_status := coalesce(v_booking."RefundStatus", 0);
    END IF;
  ELSE
    v_refund_status := 0;
  END IF;

  UPDATE public."Bookings"
  SET
    "AmountPaid" = round(v_net, 2),
    "PaymentStatus" = v_payment_status,
    "RefundStatus" = v_refund_status,
    "MercadoPagoApprovedAt" = CASE
      WHEN v_payment_status IN (1, 2, 3) THEN coalesce("MercadoPagoApprovedAt", v_now)
      WHEN v_payment_status IN (0, 4) THEN NULL
      ELSE "MercadoPagoApprovedAt"
    END,
    "LastModified" = v_now
  WHERE "Id" = p_booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_booking_amount_due(p_booking_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking record;
  v_net numeric;
  v_deposit numeric;
  v_total numeric;
BEGIN
  SELECT * INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id
    AND b."IsDeleted" = false;

  IF NOT FOUND OR v_booking."Status" NOT IN (0, 1) THEN
    RETURN 0;
  END IF;

  v_total := coalesce(v_booking."TotalAmount", 0);
  v_deposit := coalesce(v_booking."DepositAmount", v_total);
  v_net := public.booking_ledger_net_paid(p_booking_id);

  IF v_net + 0.009 >= v_total THEN
    RETURN 0;
  END IF;

  -- Deposit first
  IF v_net + 0.009 < v_deposit THEN
    RETURN round(v_deposit - v_net, 2);
  END IF;

  RETURN round(v_total - v_net, 2);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Backfill default policies + legacy snapshots on existing bookings
-- ---------------------------------------------------------------------------

INSERT INTO public."EstatePropertyCancellationPolicy" (
  "EstatePropertyId",
  "FreeCancellationDays",
  "RefundPercentBefore",
  "RefundPercentAfter",
  "DepositPercent",
  "BalanceDueDays",
  "CreatedBy",
  "LastModifiedBy"
)
SELECT
  ep."Id",
  7, 100, 0, 100, NULL,
  'migration:cancellation-policy-default',
  'migration:cancellation-policy-default'
FROM public."EstateProperties" ep
WHERE ep."IsDeleted" = false
  AND NOT EXISTS (
    SELECT 1
    FROM public."EstatePropertyCancellationPolicy" p
    WHERE p."EstatePropertyId" = ep."Id"
      AND p."IsDeleted" = false
  );

UPDATE public."Bookings" b
SET
  "CancellationPolicySnapshot" = public.default_cancellation_policy_json(),
  "PolicyIsLegacy" = true,
  "DepositAmount" = coalesce(b."TotalAmount", 0),
  "AmountPaid" = CASE WHEN b."PaymentStatus" = 1 THEN coalesce(b."TotalAmount", 0) ELSE 0 END
WHERE b."CancellationPolicySnapshot" IS NULL
  AND b."IsDeleted" = false;

-- Seed ledger rows for already-paid bookings (actor unknown → system backfill)
INSERT INTO public."BookingPayments" (
  "BookingId", "EntryType", "Amount", "Currency", "Source", "Method", "RecordedBy", "Note"
)
SELECT
  b."Id",
  'payment',
  coalesce(b."TotalAmount", 0),
  coalesce(b."Currency", 1),
  'system',
  'other',
  'migration:paid-backfill',
  'Backfill for bookings already marked Paid before BookingPayments ledger'
FROM public."Bookings" b
WHERE b."IsDeleted" = false
  AND b."PaymentStatus" = 1
  AND coalesce(b."TotalAmount", 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public."BookingPayments" bp WHERE bp."BookingId" = b."Id"
  );

-- ---------------------------------------------------------------------------
-- 5) Policy CRUD RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_property_cancellation_policy(
  p_property_id uuid,
  p_free_cancellation_days integer,
  p_refund_percent_before numeric,
  p_refund_percent_after numeric,
  p_deposit_percent numeric,
  p_balance_due_days integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id text;
  v_balance integer;
  v_row public."EstatePropertyCancellationPolicy"%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT (public.is_admin() OR public.user_can_manage_estate_property(p_property_id)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  IF p_deposit_percent IS NULL OR p_deposit_percent <= 0 OR p_deposit_percent > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid deposit percent');
  END IF;

  IF p_deposit_percent < 100 AND p_balance_due_days IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Balance due days required when deposit < 100%');
  END IF;

  v_balance := CASE WHEN p_deposit_percent = 100 THEN NULL ELSE p_balance_due_days END;

  SELECT m."Id"::text INTO v_member_id
  FROM public."Members" m
  WHERE m."UserId" = auth.uid() AND m."IsDeleted" = false
  LIMIT 1;

  UPDATE public."EstatePropertyCancellationPolicy"
  SET
    "FreeCancellationDays" = GREATEST(coalesce(p_free_cancellation_days, 0), 0),
    "RefundPercentBefore" = GREATEST(LEAST(coalesce(p_refund_percent_before, 100), 100), 0),
    "RefundPercentAfter" = GREATEST(LEAST(coalesce(p_refund_percent_after, 0), 100), 0),
    "DepositPercent" = p_deposit_percent,
    "BalanceDueDays" = v_balance,
    "LastModified" = timezone('utc', now()),
    "LastModifiedBy" = coalesce(v_member_id, auth.uid()::text)
  WHERE "EstatePropertyId" = p_property_id
    AND "IsDeleted" = false
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    INSERT INTO public."EstatePropertyCancellationPolicy" (
      "EstatePropertyId",
      "FreeCancellationDays",
      "RefundPercentBefore",
      "RefundPercentAfter",
      "DepositPercent",
      "BalanceDueDays",
      "CreatedBy",
      "LastModifiedBy"
    ) VALUES (
      p_property_id,
      GREATEST(coalesce(p_free_cancellation_days, 0), 0),
      GREATEST(LEAST(coalesce(p_refund_percent_before, 100), 100), 0),
      GREATEST(LEAST(coalesce(p_refund_percent_after, 0), 100), 0),
      p_deposit_percent,
      v_balance,
      coalesce(v_member_id, auth.uid()::text),
      coalesce(v_member_id, auth.uid()::text)
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'policy', public.cancellation_policy_row_to_json(v_row)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_property_cancellation_policy(p_property_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT (
    public.is_admin()
    OR public.user_can_manage_estate_property(p_property_id)
    OR public.is_public_estate_property(p_property_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'policy', public.get_property_cancellation_policy_json(p_property_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_property_cancellation_policy(uuid, integer, numeric, numeric, numeric, integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_property_cancellation_policy(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_property_cancellation_policy_json(uuid)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) Snapshot on hold + confirm
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
DECLARE
  v_validation jsonb;
  v_hold_id uuid;
  v_listing_type text := NULL;
  v_scope text := NULL;
  v_quoted_total numeric := NULL;
  v_quoted_currency integer := 0;
  v_policy jsonb;
BEGIN
  IF coalesce(trim(p_listing_type), '') <> '' THEN
    BEGIN
      v_listing_type := public.validate_guest_site_listing_type(p_listing_type)::text;
      v_scope := v_listing_type;
    EXCEPTION
      WHEN others THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid listing type');
    END;
  END IF;

  v_validation := public.validate_booking_selection(
    p_property_id,
    p_check_in,
    coalesce(p_visible_check_out, p_check_out),
    p_guests,
    v_listing_type,
    p_client_total,
    v_scope
  );

  IF NOT coalesce((v_validation->>'is_valid')::boolean, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', coalesce(v_validation->'errors'->>0, 'Validation failed'),
      'error_code', v_validation->>'error_code',
      'validation', v_validation
    );
  END IF;

  IF v_validation->'pricing' IS NOT NULL AND jsonb_typeof(v_validation->'pricing') = 'object' THEN
    v_quoted_total := (v_validation->'pricing'->>'total_price')::numeric;
  END IF;

  SELECT coalesce(l."Currency", 0)
  INTO v_quoted_currency
  FROM public."Listings" l
  WHERE l."EstatePropertyId" = p_property_id
    AND l."IsDeleted" = false
    AND (v_listing_type IS NULL OR l."ListingType"::text = v_listing_type)
  ORDER BY l."IsFeatured" DESC NULLS LAST, l."IsActive" DESC NULLS LAST, l."Created" DESC NULLS LAST
  LIMIT 1;

  IF EXISTS (
    SELECT 1
    FROM public.booking_holds h
    WHERE h.property_id = p_property_id
      AND h.status = 'pending'
      AND h.expires_at > now()
      AND daterange(h.check_in, h.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected dates are temporarily held by another guest');
  END IF;

  v_policy := public.get_property_cancellation_policy_json(p_property_id);

  INSERT INTO public.booking_holds (
    property_id, check_in, check_out, guests, estimated_guests, ip_hash, idempotency_key, listing_type,
    quoted_total, quoted_currency, cancellation_policy_snapshot
  ) VALUES (
    p_property_id, p_check_in, p_check_out, p_guests, p_estimated_guests, p_ip_hash, p_idempotency_key, v_listing_type,
    v_quoted_total, coalesce(v_quoted_currency, 0), v_policy
  )
  RETURNING id INTO v_hold_id;

  RETURN jsonb_build_object(
    'success', true,
    'hold', jsonb_build_object(
      'id', v_hold_id,
      'expires_at', (SELECT expires_at FROM public.booking_holds WHERE id = v_hold_id),
      'listing_type', v_listing_type,
      'quoted_total', v_quoted_total,
      'quoted_currency', coalesce(v_quoted_currency, 0),
      'cancellation_policy', v_policy
    ),
    'validation', v_validation
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_booking_payment_deadlines(
  p_booking_id uuid,
  p_policy jsonb,
  p_total numeric,
  p_check_in date,
  p_created_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deposit_pct numeric := coalesce((p_policy->>'depositPercent')::numeric, 100);
  v_deposit numeric;
  v_created timestamptz := coalesce(p_created_at, timezone('utc', now()));
  v_deposit_deadline timestamptz;
  v_balance_due timestamptz;
  v_balance_days integer := (p_policy->>'balanceDueDays')::integer;
  v_hours_to_checkin numeric;
BEGIN
  v_deposit := round(coalesce(p_total, 0) * (v_deposit_pct / 100.0), 2);
  IF v_deposit <= 0 THEN
    v_deposit := coalesce(p_total, 0);
  END IF;

  -- Platform deposit deadline: 24h, or sooner if check-in is closer
  v_hours_to_checkin := EXTRACT(EPOCH FROM (
    (p_check_in::timestamp AT TIME ZONE 'America/Montevideo') - v_created
  )) / 3600.0;

  IF v_hours_to_checkin IS NULL OR v_hours_to_checkin > 24 THEN
    v_deposit_deadline := v_created + interval '24 hours';
  ELSE
    v_deposit_deadline := v_created + (GREATEST(v_hours_to_checkin, 1) || ' hours')::interval;
  END IF;

  IF v_deposit_pct < 100 AND v_balance_days IS NOT NULL THEN
    v_balance_due := (
      (public.cancellation_cutoff_date(p_check_in, v_balance_days))::timestamp
      AT TIME ZONE 'America/Montevideo'
    );
  ELSE
    v_balance_due := NULL;
  END IF;

  UPDATE public."Bookings"
  SET
    "DepositAmount" = v_deposit,
    "DepositDeadlineAt" = v_deposit_deadline,
    "BalanceDueAt" = v_balance_due
  WHERE "Id" = p_booking_id;
END;
$$;
