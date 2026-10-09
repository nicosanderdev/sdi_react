-- Admin activity log for the dashboard Logs page.
-- Append-only store unioned into get_admin_logs_for_date; existing sources kept.

CREATE TABLE public."AdminActivityLog" (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "EventType" text NOT NULL,
  "Action" text NOT NULL,
  "At" timestamptz NOT NULL DEFAULT timezone('utc', now()),
  "TargetId" uuid,
  "TargetDisplay" text NOT NULL DEFAULT '',
  "PerformedBy" uuid REFERENCES public."Members"("Id") ON DELETE SET NULL,
  "PerformedByDisplay" text NOT NULL DEFAULT '',
  "Details" jsonb,
  CONSTRAINT "AdminActivityLog_EventType_check" CHECK (
    ("EventType") = ANY (ARRAY['user'::text, 'property'::text, 'booking'::text, 'company'::text, 'system'::text])
  )
);

CREATE INDEX "IX_AdminActivityLog_At" ON public."AdminActivityLog" USING btree ("At" DESC);
CREATE INDEX "IX_AdminActivityLog_Action" ON public."AdminActivityLog" USING btree ("Action");
CREATE INDEX "IX_AdminActivityLog_TargetId" ON public."AdminActivityLog" USING btree ("TargetId");

-- At most one payment log per booking (webhook retries).
CREATE UNIQUE INDEX "UX_AdminActivityLog_payment_booking"
  ON public."AdminActivityLog" ("TargetId")
  WHERE ("Action" = 'payment' AND "TargetId" IS NOT NULL);

COMMENT ON TABLE public."AdminActivityLog" IS
  'Append-only admin audit events for Logs page (property/listing/company/registration/payment/cron, etc.).';

ALTER TABLE public."AdminActivityLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AdminActivityLog_admin_select"
  ON public."AdminActivityLog"
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No UPDATE/DELETE policies (append-only from app). Inserts via SECURITY DEFINER / service_role.

GRANT SELECT ON public."AdminActivityLog" TO authenticated;
GRANT ALL ON public."AdminActivityLog" TO service_role;

-- ---------------------------------------------------------------------------
-- Helper: insert one activity row (resolves performer display when needed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_admin_activity(
  p_event_type text,
  p_action text,
  p_target_id uuid DEFAULT NULL,
  p_target_display text DEFAULT NULL,
  p_performed_by uuid DEFAULT NULL,
  p_performed_by_display text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_display text;
  v_actor_display text;
BEGIN
  v_display := coalesce(nullif(trim(p_target_display), ''), coalesce(p_target_id::text, ''));

  v_actor_display := nullif(trim(coalesce(p_performed_by_display, '')), '');
  IF v_actor_display IS NULL AND p_performed_by IS NOT NULL THEN
    SELECT coalesce(
      nullif(trim(coalesce(m."FirstName", '') || ' ' || coalesce(m."LastName", '')), ''),
      nullif(trim(m."Email"), ''),
      p_performed_by::text
    )
    INTO v_actor_display
    FROM public."Members" m
    WHERE m."Id" = p_performed_by
      AND m."IsDeleted" = false;
  END IF;
  v_actor_display := coalesce(v_actor_display, 'Sistema');

  BEGIN
    INSERT INTO public."AdminActivityLog" (
      "EventType",
      "Action",
      "TargetId",
      "TargetDisplay",
      "PerformedBy",
      "PerformedByDisplay",
      "Details"
    ) VALUES (
      p_event_type,
      p_action,
      p_target_id,
      v_display,
      p_performed_by,
      v_actor_display,
      p_details
    );
  EXCEPTION
    WHEN unique_violation THEN
      NULL; -- e.g. payment retry for same booking
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_activity(text, text, uuid, text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_activity(text, text, uuid, text, uuid, text, jsonb)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Booking label helper (reservation code + guest email)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_booking_log_label(p_booking_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(
    nullif(trim(b."ReservationCode"), ''),
    'Booking ' || b."Id"::text
  ) || coalesce(' <' || nullif(trim(g."Email"), '') || '>', '')
  FROM public."Bookings" b
  LEFT JOIN public."Guests" g
    ON g."Id" = b."GuestId"
  WHERE b."Id" = p_booking_id;
$$;

-- ---------------------------------------------------------------------------
-- get_admin_logs_for_date: keep existing sources + AdminActivityLog;
-- improve booking display; suppress updated when typed event / MP webhook.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_logs_for_date(p_date date)
RETURNS TABLE(
  event_type text,
  action text,
  at timestamp with time zone,
  target_id uuid,
  target_display text,
  performed_by_display text,
  details jsonb
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT event_type, action, at, target_id, target_display, performed_by_display, details
  FROM (
    SELECT
      'user'::text AS event_type,
      mah."ActionType"::text AS action,
      mah."PerformedAt" AS at,
      mah."MemberId" AS target_id,
      trim(coalesce(t."FirstName", '') || ' ' || coalesce(t."LastName", ''))
        || coalesce(' <' || nullif(trim(t."Email"), '') || '>', '') AS target_display,
      coalesce(
        nullif(trim(coalesce(p."FirstName", '') || ' ' || coalesce(p."LastName", '')), ''),
        nullif(trim(p."Email"), ''),
        mah."PerformedBy"::text,
        'Unknown User'
      ) AS performed_by_display,
      mah."ActionDetails" AS details
    FROM public."MemberActionHistory" mah
    JOIN public."Members" t ON t."Id" = mah."MemberId" AND t."IsDeleted" = false
    LEFT JOIN public."Members" p ON p."Id" = mah."PerformedBy" AND p."IsDeleted" = false
    WHERE mah."IsDeleted" = false
      AND mah."PerformedAt" >= p_date::timestamptz
      AND mah."PerformedAt" < (p_date + interval '1 day')::timestamptz

    UNION ALL

    SELECT
      'property'::text AS event_type,
      pma."ActionType"::text AS action,
      pma."PerformedAt" AS at,
      pma."PropertyId" AS target_id,
      coalesce(ll."Title", '') AS target_display,
      coalesce(
        nullif(trim(coalesce(m."FirstName", '') || ' ' || coalesce(m."LastName", '')), ''),
        nullif(trim(m."Email"), ''),
        pma."PerformedBy"::text,
        'Unknown User'
      ) AS performed_by_display,
      jsonb_build_object('reason', pma."Reason") AS details
    FROM public."PropertyModerationActions" pma
    JOIN public."EstateProperties" ep
      ON ep."Id" = pma."PropertyId" AND ep."IsDeleted" = false
    LEFT JOIN LATERAL (
      SELECT l."Title"
      FROM public."Listings" l
      WHERE l."EstatePropertyId" = pma."PropertyId" AND l."IsDeleted" = false
      ORDER BY l."Created" DESC
      LIMIT 1
    ) ll ON true
    LEFT JOIN public."Members" m
      ON m."UserId" = pma."PerformedBy" AND m."IsDeleted" = false
    WHERE pma."IsDeleted" = false
      AND pma."PerformedAt" >= p_date::timestamptz
      AND pma."PerformedAt" < (p_date + interval '1 day')::timestamptz

    UNION ALL

    SELECT
      'booking'::text AS event_type,
      'created'::text AS action,
      b."Created" AS at,
      b."Id" AS target_id,
      coalesce(
        public.admin_booking_log_label(b."Id"),
        'Booking ' || b."Id"::text
      ) AS target_display,
      CASE
        WHEN nullif(trim(coalesce(b."CreatedBy", '')), '') IS NULL THEN
          coalesce(nullif(trim(g."Email"), ''), 'Huésped')
        ELSE
          coalesce(
            nullif(trim(coalesce(mc_id."FirstName", '') || ' ' || coalesce(mc_id."LastName", '')), ''),
            nullif(trim(mc_id."Email"), ''),
            nullif(trim(coalesce(mc_user."FirstName", '') || ' ' || coalesce(mc_user."LastName", '')), ''),
            nullif(trim(mc_user."Email"), ''),
            nullif(b."CreatedBy", ''),
            'Unknown User'
          )
      END AS performed_by_display,
      jsonb_build_object(
        'estatePropertyId', b."EstatePropertyId",
        'checkIn', b."CheckInDate",
        'checkOut', b."CheckOutDate"
      ) AS details
    FROM public."Bookings" b
    LEFT JOIN public."Guests" g
      ON g."Id" = b."GuestId"
    LEFT JOIN public."Members" mc_id
      ON mc_id."Id"::text = b."CreatedBy" AND mc_id."IsDeleted" = false
    LEFT JOIN public."Members" mc_user
      ON mc_user."UserId"::text = b."CreatedBy" AND mc_user."IsDeleted" = false
    WHERE b."IsDeleted" = false
      AND b."Created" >= p_date::timestamptz
      AND b."Created" < (p_date + interval '1 day')::timestamptz

    UNION ALL

    SELECT
      'booking'::text AS event_type,
      'updated'::text AS action,
      b."LastModified" AS at,
      b."Id" AS target_id,
      coalesce(
        public.admin_booking_log_label(b."Id"),
        'Booking ' || b."Id"::text
      ) AS target_display,
      coalesce(
        nullif(trim(coalesce(mu_id."FirstName", '') || ' ' || coalesce(mu_id."LastName", '')), ''),
        nullif(trim(mu_id."Email"), ''),
        nullif(trim(coalesce(mu_user."FirstName", '') || ' ' || coalesce(mu_user."LastName", '')), ''),
        nullif(trim(mu_user."Email"), ''),
        nullif(b."LastModifiedBy", ''),
        'Unknown User'
      ) AS performed_by_display,
      jsonb_build_object(
        'estatePropertyId', b."EstatePropertyId",
        'checkIn', b."CheckInDate",
        'checkOut', b."CheckOutDate"
      ) AS details
    FROM public."Bookings" b
    LEFT JOIN public."Members" mu_id
      ON mu_id."Id"::text = b."LastModifiedBy" AND mu_id."IsDeleted" = false
    LEFT JOIN public."Members" mu_user
      ON mu_user."UserId"::text = b."LastModifiedBy" AND mu_user."IsDeleted" = false
    WHERE b."IsDeleted" = false
      AND b."LastModified" >= p_date::timestamptz
      AND b."LastModified" < (p_date + interval '1 day')::timestamptz
      AND b."LastModified" <> b."Created"
      AND coalesce(b."LastModifiedBy", '') NOT IN (
        'mercado-pago-webhook',
        'mercado-pago-auto-confirm'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public."AdminActivityLog" a
        WHERE a."TargetId" = b."Id"
          AND a."Action" IN ('confirm', 'cancel', 'payment')
          AND a."At" >= b."LastModified" - interval '2 seconds'
          AND a."At" <= b."LastModified" + interval '2 seconds'
      )

    UNION ALL

    SELECT
      aal."EventType" AS event_type,
      aal."Action" AS action,
      aal."At" AS at,
      aal."TargetId" AS target_id,
      aal."TargetDisplay" AS target_display,
      aal."PerformedByDisplay" AS performed_by_display,
      aal."Details" AS details
    FROM public."AdminActivityLog" aal
    WHERE aal."At" >= p_date::timestamptz
      AND aal."At" < (p_date + interval '1 day')::timestamptz
  ) logs
  ORDER BY at DESC;
$$;

COMMENT ON FUNCTION public.get_admin_logs_for_date(p_date date) IS
  'Admin audit events for a date: MemberActionHistory, PropertyModerationActions, booking created/updated, AdminActivityLog. Admin RLS on underlying tables.';

-- ---------------------------------------------------------------------------
-- Trigger: create_property on EstateProperties insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_estate_properties_log_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_display text;
  v_actor uuid;
BEGIN
  v_display := nullif(
    trim(
      concat_ws(
        ', ',
        nullif(trim(concat_ws(' ', NEW."StreetName", NEW."HouseNumber")), ''),
        nullif(trim(NEW."City"), ''),
        nullif(trim(NEW."State"), '')
      )
    ),
    ''
  );
  v_actor := public.current_member_id();

  PERFORM public.log_admin_activity(
    'property',
    'create_property',
    NEW."Id",
    coalesce(v_display, NEW."Id"::text),
    v_actor,
    NULL,
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_estate_properties_log_create ON public."EstateProperties";
CREATE TRIGGER trg_estate_properties_log_create
  AFTER INSERT ON public."EstateProperties"
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_estate_properties_log_create();

-- ---------------------------------------------------------------------------
-- Trigger: create_company on Companies insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_companies_log_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
BEGIN
  SELECT m."Id"
  INTO v_actor
  FROM public."Members" m
  WHERE m."IsDeleted" = false
    AND (
      m."Id" = public.current_member_id()
      OR m."UserId"::text = nullif(trim(coalesce(NEW."CreatedBy", '')), '')
      OR m."UserId" = NEW."BillingContactUserId"
    )
  ORDER BY CASE WHEN m."Id" = public.current_member_id() THEN 0 ELSE 1 END
  LIMIT 1;

  PERFORM public.log_admin_activity(
    'company',
    'create_company',
    NEW."Id",
    coalesce(nullif(trim(NEW."Name"), ''), NEW."Id"::text),
    v_actor,
    NULL,
    jsonb_build_object('billingEmail', NEW."BillingEmail")
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_log_create ON public."Companies";
CREATE TRIGGER trg_companies_log_create
  AFTER INSERT ON public."Companies"
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_companies_log_create();

-- ---------------------------------------------------------------------------
-- Trigger: confirm / cancel on Bookings status change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_bookings_log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action text;
  v_actor uuid;
  v_actor_display text;
  v_label text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF OLD."Status" IS NOT DISTINCT FROM NEW."Status" THEN
    RETURN NEW;
  END IF;

  IF NEW."Status" = 1 THEN
    v_action := 'confirm';
  ELSIF NEW."Status" = 2 THEN
    v_action := 'cancel';
  ELSE
    RETURN NEW;
  END IF;

  v_label := coalesce(public.admin_booking_log_label(NEW."Id"), 'Booking ' || NEW."Id"::text);

  IF coalesce(NEW."LastModifiedBy", '') IN ('mercado-pago-webhook', 'mercado-pago-auto-confirm') THEN
    v_actor := NULL;
    v_actor_display := 'Mercado Pago';
  ELSE
    SELECT m."Id"
    INTO v_actor
    FROM public."Members" m
    WHERE m."IsDeleted" = false
      AND (
        m."Id"::text = nullif(trim(coalesce(NEW."LastModifiedBy", '')), '')
        OR m."UserId"::text = nullif(trim(coalesce(NEW."LastModifiedBy", '')), '')
        OR m."Id" = public.current_member_id()
      )
    LIMIT 1;
    v_actor_display := NULL;
  END IF;

  PERFORM public.log_admin_activity(
    'booking',
    v_action,
    NEW."Id",
    v_label,
    v_actor,
    v_actor_display,
    jsonb_build_object('fromStatus', OLD."Status", 'toStatus', NEW."Status")
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_log_status_change ON public."Bookings";
CREATE TRIGGER trg_bookings_log_status_change
  AFTER UPDATE OF "Status" ON public."Bookings"
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bookings_log_status_change();

-- ---------------------------------------------------------------------------
-- insert_listing → create_listing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_listing(
  p_estate_property_id uuid,
  p_listing_type text,
  p_title text,
  p_description text DEFAULT NULL::text,
  p_available_from timestamp with time zone DEFAULT now(),
  p_capacity integer DEFAULT NULL::integer,
  p_currency integer DEFAULT 0,
  p_sale_price numeric DEFAULT NULL::numeric,
  p_rent_price numeric DEFAULT NULL::numeric,
  p_rent_price_period text DEFAULT NULL::text,
  p_has_common_expenses boolean DEFAULT NULL::boolean,
  p_common_expenses_value numeric DEFAULT NULL::numeric,
  p_is_electricity_included boolean DEFAULT NULL::boolean,
  p_is_water_included boolean DEFAULT NULL::boolean,
  p_is_price_visible boolean DEFAULT true,
  p_status integer DEFAULT NULL::integer,
  p_is_active boolean DEFAULT true,
  p_is_property_visible boolean DEFAULT true,
  p_is_featured boolean DEFAULT false,
  p_blocked_for_booking boolean DEFAULT false,
  p_base_price numeric DEFAULT NULL::numeric,
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_long_stay_discount_enabled boolean DEFAULT false,
  p_long_stay_min_days integer DEFAULT NULL::integer,
  p_long_stay_discount_percentage numeric DEFAULT NULL::numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_period public."RentPricePeriod" := NULL;
  v_rent numeric := p_rent_price;
  v_base numeric := p_base_price;
BEGIN
  IF p_rent_price_period IS NOT NULL AND p_rent_price_period NOT IN ('PerNight', 'PerMonth') THEN
    RAISE EXCEPTION 'Invalid rent price period: %', p_rent_price_period;
  END IF;

  IF p_rent_price_period IS NOT NULL THEN
    v_period := p_rent_price_period::public."RentPricePeriod";
  END IF;

  IF v_base IS NOT NULL AND v_rent IS NULL THEN
    v_rent := v_base;
  ELSIF v_rent IS NOT NULL AND v_base IS NULL THEN
    v_base := v_rent;
  END IF;

  INSERT INTO public."Listings" (
    "Id", "EstatePropertyId", "ListingType", "Title", "Description", "AvailableFrom",
    "Capacity", "Currency", "SalePrice", "RentPrice", "RentPricePeriod",
    "HasCommonExpenses", "CommonExpensesValue", "IsElectricityIncluded", "IsWaterIncluded",
    "IsPriceVisible", "Status", "IsActive", "IsPropertyVisible", "IsFeatured",
    "BlockedForBooking", "BasePrice", "MinPrice", "MaxPrice",
    "LongStayDiscountEnabled", "LongStayMinDays", "LongStayDiscountPercentage",
    "IsDeleted", "Created", "LastModified"
  ) VALUES (
    v_id, p_estate_property_id, p_listing_type::public."ListingType", p_title, p_description,
    coalesce(p_available_from, now()), p_capacity, p_currency, p_sale_price, v_rent, v_period,
    p_has_common_expenses, p_common_expenses_value, p_is_electricity_included, p_is_water_included,
    p_is_price_visible, p_status, p_is_active, p_is_property_visible, p_is_featured,
    p_blocked_for_booking, v_base, p_min_price, p_max_price,
    coalesce(p_long_stay_discount_enabled, false), p_long_stay_min_days, p_long_stay_discount_percentage,
    false, now(), now()
  );

  PERFORM public.log_admin_activity(
    'property',
    'create_listing',
    v_id,
    coalesce(nullif(trim(p_title), ''), v_id::text),
    public.current_member_id(),
    NULL,
    jsonb_build_object('estatePropertyId', p_estate_property_id)
  );

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- add_company_member_by_email → add_company_member
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_company_member_by_email(
  p_company_id uuid,
  p_email text,
  p_role text DEFAULT 'Member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid := public.current_member_id();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := trim(coalesce(p_role, 'Member'));
  v_target public."Members"%ROWTYPE;
  v_row public."CompanyMembers"%ROWTYPE;
  v_company_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company is required.';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'Por favor, ingresa un correo electrónico';
  END IF;

  IF v_role NOT IN ('Admin', 'Manager', 'Member') THEN
    RAISE EXCEPTION 'Rol de compañía inválido.';
  END IF;

  IF NOT public.is_admin() AND NOT public.is_company_admin(p_company_id) THEN
    RAISE EXCEPTION 'Only company Admins can manage company members.';
  END IF;

  SELECT *
    INTO v_target
  FROM public."Members" m
  WHERE lower(trim(coalesce(m."Email", ''))) = v_email
    AND m."IsDeleted" = false
  LIMIT 1;

  IF v_target."Id" IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario registrado con ese correo.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."CompanyMembers" cm
    WHERE cm."CompanyId" = p_company_id
      AND cm."MemberId" = v_target."Id"
      AND cm."IsDeleted" = false
  ) THEN
    RAISE EXCEPTION 'User is already linked to this company';
  END IF;

  SELECT c."Name" INTO v_company_name
  FROM public."Companies" c
  WHERE c."Id" = p_company_id;

  INSERT INTO public."CompanyMembers" (
    "MemberId",
    "CompanyId",
    "Role",
    "AddedBy",
    "JoinedAt",
    "IsDeleted"
  ) VALUES (
    v_target."Id",
    p_company_id,
    v_role,
    coalesce(v_actor_id, v_target."Id"),
    timezone('utc', now()),
    false
  )
  RETURNING * INTO v_row;

  PERFORM public.log_admin_activity(
    'company',
    'add_company_member',
    v_target."Id",
    format('%s → %s', coalesce(v_target."Email", v_email), coalesce(v_company_name, p_company_id::text)),
    v_actor_id,
    NULL,
    jsonb_build_object(
      'companyId', p_company_id,
      'role', v_role,
      'companyMemberId', v_row."Id"
    )
  );

  RETURN jsonb_build_object(
    'Id', v_row."Id",
    'MemberId', v_row."MemberId",
    'CompanyId', v_row."CompanyId",
    'Role', v_row."Role",
    'AddedBy', v_row."AddedBy",
    'JoinedAt', v_row."JoinedAt",
    'IsDeleted', v_row."IsDeleted",
    'Members', jsonb_build_object(
      'Id', v_target."Id",
      'FirstName', v_target."FirstName",
      'LastName', v_target."LastName",
      'Email', v_target."Email",
      'AvatarUrl', v_target."AvatarUrl"
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- mark_booking_mercado_pago_approved → payment (idempotent)
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
  v_already_approved boolean;
  v_amount numeric;
  v_currency text;
  v_label text;
BEGIN
  SELECT *
  INTO v_attempt
  FROM public.mercado_pago_payment_attempts a
  WHERE a.id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment attempt not found');
  END IF;

  IF v_attempt.booking_id <> p_booking_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attempt booking mismatch');
  END IF;

  SELECT *
  INTO v_booking
  FROM public."Bookings" b
  WHERE b."Id" = p_booking_id
    AND b."IsDeleted" = false
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

  v_already_approved := v_booking."MercadoPagoApprovedAt" IS NOT NULL;
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

  UPDATE public."Bookings"
  SET
    "MercadoPagoApprovedAt" = coalesce("MercadoPagoApprovedAt", v_now),
    "PaymentStatus" = 1,
    "LastModified" = v_now,
    "LastModifiedBy" = 'mercado-pago-webhook'
  WHERE "Id" = p_booking_id;

  IF NOT v_already_approved THEN
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
    'already_approved', v_already_approved
  );
END;
$$;

-- duplicate_estate_property: also log create_listing when a listing is copied
CREATE OR REPLACE FUNCTION public.duplicate_estate_property(
  p_original_property_id text,
  p_user_id text,
  p_new_title text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_original_property record;
  v_new_property_id uuid;
  v_member_id uuid;
  v_owner_id uuid;
  v_new_title text;
  v_old_section_id uuid;
  v_new_section_id uuid;
  v_existing_property_count integer;
  v_subscription_plan_max_properties integer;
  v_source_listing record;
  v_photo_count integer;
  v_photo_cap integer;
  v_plan_photo_cap integer;
begin
  if p_original_property_id is null or p_user_id is null then
    raise exception 'Property id and user id are required to duplicate.';
  end if;

  if not public.is_property_owner(p_user_id::uuid, p_original_property_id::uuid)
     and not public.is_admin() then
    raise exception 'You do not have permission to duplicate this property.';
  end if;

  select
    ep."StreetName", ep."HouseNumber", ep."Neighborhood", ep."City", ep."State", ep."ZipCode", ep."Country",
    ep."LocationLatitude", ep."LocationLongitude", ep."Title", ep."Type", ep."AreaValue", ep."AreaUnit",
    ep."Bedrooms", ep."Bathrooms", ep."HasGarage", ep."GarageSpaces", ep."OwnerId",
    ep."HasLaundryRoom", ep."HasPool", ep."HasBalcony", ep."IsFurnished", ep."Capacity",
    ep."LocationCategory", ep."ViewType"
  into v_original_property
  from public."EstateProperties" ep
  where ep."Id" = p_original_property_id::uuid
    and ep."IsDeleted" = false;

  if not found then
    raise exception 'Property not found.';
  end if;

  select m."Id"
    into v_member_id
  from public."Members" m
  where m."UserId" = p_user_id::uuid
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    raise exception 'Member not found for user.';
  end if;

  select count(*) into v_existing_property_count
  from public."EstateProperties" ep
  inner join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
  where ep."IsDeleted" = false
    and (
      (o."OwnerType" = 'member' and o."MemberId" = v_member_id) or
      (o."OwnerType" = 'company' and o."CompanyId" in (
        select cm."CompanyId"
        from public."CompanyMembers" cm
        where cm."MemberId" = v_member_id and cm."IsDeleted" = false
      ))
    );

  select coalesce(p."ListingLimit", p."MaxProperties")
    into v_subscription_plan_max_properties
  from public."Members" m
  left join lateral (
    select bpa."PlanId"
    from public."BillingPlanAssignments" bpa
    where bpa."SubjectType" = 'member'
      and bpa."MemberOrCompanyId" = v_member_id
      and bpa."IsActive" = true
      and bpa."StartDate" <= now()
      and (bpa."EndDate" is null or bpa."EndDate" >= now())
    order by bpa."StartDate" desc
    limit 1
  ) active_plan on true
  left join public."Plans" p
    on p."Id" = active_plan."PlanId"
    and p."IsDeleted" = false
  where m."Id" = v_member_id
    and m."IsDeleted" = false;

  if v_subscription_plan_max_properties is not null
     and v_existing_property_count >= v_subscription_plan_max_properties then
    raise exception 'Property limit exceeded. You have % properties but your plan allows maximum %.',
      v_existing_property_count, v_subscription_plan_max_properties;
  end if;

  select l.*
    into v_source_listing
  from public."Listings" l
  where l."EstatePropertyId" = p_original_property_id::uuid
    and l."IsDeleted" = false
  order by l."IsFeatured" desc, l."Created" desc
  limit 1;

  if v_source_listing."Id" is not null
     and coalesce(v_source_listing."IsActive", false)
     and coalesce(v_source_listing."IsPropertyVisible", false) then
    perform public.assert_published_property_within_plan('member', v_member_id, null);
  end if;

  select count(*)::integer into v_photo_count
  from public."PropertyImages" pi
  where pi."EstatePropertyId" = p_original_property_id::uuid
    and pi."IsDeleted" = false;

  select p."MaxPhotosPerProperty"
    into v_plan_photo_cap
  from public."BillingPlanAssignments" bpa
  join public."Plans" p
    on p."Id" = bpa."PlanId"
   and p."IsDeleted" = false
  where bpa."SubjectType" = 'member'
    and bpa."MemberOrCompanyId" = v_member_id
    and bpa."IsActive" = true
    and bpa."StartDate" <= now()
    and (bpa."EndDate" is null or bpa."EndDate" >= now())
  order by bpa."StartDate" desc
  limit 1;

  v_photo_cap := least(coalesce(v_plan_photo_cap, 30), 30);
  if v_photo_count > v_photo_cap then
    raise exception 'Photo limit exceeded. Source has % photos but your plan allows a maximum of % per property.',
      v_photo_count, v_photo_cap;
  end if;

  v_owner_id := public.get_or_create_owner(v_member_id, null, null);

  v_new_title := coalesce(p_new_title, v_original_property."Title" || ' (Copy)');
  v_new_property_id := gen_random_uuid();

  insert into public."EstateProperties" (
    "Id",
    "StreetName",
    "HouseNumber",
    "Neighborhood",
    "City",
    "State",
    "ZipCode",
    "Country",
    "LocationLatitude",
    "LocationLongitude",
    "Title",
    "Type",
    "AreaValue",
    "AreaUnit",
    "Bedrooms",
    "Bathrooms",
    "HasGarage",
    "GarageSpaces",
    "OwnerId",
    "HasLaundryRoom",
    "HasPool",
    "HasBalcony",
    "IsFurnished",
    "Capacity",
    "LocationCategory",
    "ViewType",
    "IsDeleted",
    "Created",
    "LastModified"
  ) values (
    v_new_property_id,
    v_original_property."StreetName",
    v_original_property."HouseNumber",
    v_original_property."Neighborhood",
    v_original_property."City",
    v_original_property."State",
    v_original_property."ZipCode",
    v_original_property."Country",
    v_original_property."LocationLatitude",
    v_original_property."LocationLongitude",
    v_new_title,
    v_original_property."Type",
    v_original_property."AreaValue",
    v_original_property."AreaUnit",
    v_original_property."Bedrooms",
    v_original_property."Bathrooms",
    v_original_property."HasGarage",
    v_original_property."GarageSpaces",
    v_owner_id,
    v_original_property."HasLaundryRoom",
    v_original_property."HasPool",
    v_original_property."HasBalcony",
    v_original_property."IsFurnished",
    v_original_property."Capacity",
    v_original_property."LocationCategory",
    v_original_property."ViewType",
    false,
    now(),
    now()
  );

  if v_source_listing."Id" is not null then
    insert into public."Listings" (
      "Id",
      "EstatePropertyId",
      "ListingType",
      "Title",
      "Description",
      "AvailableFrom",
      "Capacity",
      "Currency",
      "SalePrice",
      "RentPrice",
      "RentPricePeriod",
      "IsPriceVisible",
      "Status",
      "IsActive",
      "IsPropertyVisible",
      "IsFeatured",
      "BlockedForBooking",
      "BasePrice",
      "MinPrice",
      "MaxPrice",
      "LongStayDiscountEnabled",
      "LongStayMinDays",
      "LongStayDiscountPercentage",
      "IsDeleted",
      "Created",
      "CreatedBy",
      "LastModified",
      "LastModifiedBy"
    )
    values (
      gen_random_uuid(),
      v_new_property_id,
      v_source_listing."ListingType",
      coalesce(v_source_listing."Title", v_new_title),
      v_source_listing."Description",
      v_source_listing."AvailableFrom",
      v_source_listing."Capacity",
      v_source_listing."Currency",
      v_source_listing."SalePrice",
      v_source_listing."RentPrice",
      v_source_listing."RentPricePeriod",
      coalesce(v_source_listing."IsPriceVisible", true),
      v_source_listing."Status",
      coalesce(v_source_listing."IsActive", false),
      coalesce(v_source_listing."IsPropertyVisible", false),
      true,
      coalesce(v_source_listing."BlockedForBooking", false),
      v_source_listing."BasePrice",
      v_source_listing."MinPrice",
      v_source_listing."MaxPrice",
      coalesce(v_source_listing."LongStayDiscountEnabled", false),
      v_source_listing."LongStayMinDays",
      v_source_listing."LongStayDiscountPercentage",
      false,
      now(),
      p_user_id,
      now(),
      p_user_id
    );
  end if;

  if v_source_listing."Id" is not null then
    perform public.log_admin_activity(
      'property',
      'create_listing',
      (select l."Id" from public."Listings" l
        where l."EstatePropertyId" = v_new_property_id and l."IsDeleted" = false
        order by l."Created" desc limit 1),
      coalesce(v_new_title, coalesce(v_source_listing."Title", 'Listing')),
      v_member_id,
      null,
      jsonb_build_object('estatePropertyId', v_new_property_id, 'duplicated', true)
    );
  end if;

  insert into public."PropertyImages" (
    "Id", "EstatePropertyId", "Url", "AltText", "IsMain", "IsDeleted",
    "Created", "CreatedBy", "LastModified", "LastModifiedBy", "DisplayOrder"
  )
  select
    gen_random_uuid(),
    v_new_property_id,
    pi."Url",
    pi."AltText",
    pi."IsMain",
    false,
    now(),
    p_user_id,
    now(),
    p_user_id,
    pi."DisplayOrder"
  from public."PropertyImages" pi
  where pi."EstatePropertyId" = p_original_property_id::uuid
    and pi."IsDeleted" = false;

  insert into public."PropertyDocuments" (
    "Id", "EstatePropertyId", "Url", "Name", "FileType", "IsPublic", "IsDeleted",
    "Created", "CreatedBy", "LastModified", "LastModifiedBy"
  )
  select
    gen_random_uuid(),
    v_new_property_id,
    pd."Url",
    pd."Name",
    pd."FileType",
    coalesce(pd."IsPublic", true),
    false,
    now(),
    p_user_id,
    now(),
    p_user_id
  from public."PropertyDocuments" pd
  where pd."EstatePropertyId" = p_original_property_id::uuid
    and pd."IsDeleted" = false;

  insert into public."PropertyVideos" (
    "Id", "EstatePropertyId", "Url", "Title", "Description", "IsDeleted",
    "Created", "CreatedBy", "LastModified", "LastModifiedBy"
  )
  select
    gen_random_uuid(),
    v_new_property_id,
    pv."Url",
    pv."Title",
    pv."Description",
    false,
    now(),
    p_user_id,
    now(),
    p_user_id
  from public."PropertyVideos" pv
  where pv."EstatePropertyId" = p_original_property_id::uuid
    and pv."IsDeleted" = false;

  insert into public."EstatePropertyAmenity" (
    "EstatePropertyId",
    "AmenityId",
    "LocalizedDescriptions",
    "CreatedAtUtc",
    "DeletedAtUtc"
  )
  select
    v_new_property_id,
    epa."AmenityId",
    epa."LocalizedDescriptions",
    now(),
    null
  from public."EstatePropertyAmenity" epa
  where epa."EstatePropertyId" = p_original_property_id::uuid
    and epa."DeletedAtUtc" is null;

  insert into public."EstatePropertyPolicy" (
    "EstatePropertyId",
    "ListingType",
    "LocalizedTitle",
    "LocalizedDescription",
    "TemplateKey",
    "SlotValues",
    "DisplayOrder",
    "IsDeleted",
    "Created",
    "LastModified"
  )
  select
    v_new_property_id,
    epp."ListingType",
    epp."LocalizedTitle",
    epp."LocalizedDescription",
    epp."TemplateKey",
    epp."SlotValues",
    epp."DisplayOrder",
    false,
    now(),
    now()
  from public."EstatePropertyPolicy" epp
  where epp."EstatePropertyId" = p_original_property_id::uuid
    and epp."IsDeleted" = false;

  for v_old_section_id in
    select s.id
    from public.propertydetailssection s
    where s.propertyid = p_original_property_id::uuid
      and s.isdeleted = false
    order by s.displayorder, s.createdat
  loop
    v_new_section_id := gen_random_uuid();

    insert into public.propertydetailssection (
      id, propertyid, name, description, localizedname, localizeddescription,
      propertytype, layouttype, layoutconfig, displayorder, isdeleted, createdat, updatedat,
      templatekey
    )
    select
      v_new_section_id,
      v_new_property_id,
      src.name,
      src.description,
      src.localizedname,
      src.localizeddescription,
      src.propertytype,
      src.layouttype,
      src.layoutconfig,
      src.displayorder,
      false,
      now(),
      now(),
      src.templatekey
    from public.propertydetailssection src
    where src.id = v_old_section_id;

    insert into public.propertysectionimages (
      id, sectionid, propertyimageid, displayorder, createdat, updatedat
    )
    select
      gen_random_uuid(),
      v_new_section_id,
      psi.propertyimageid,
      psi.displayorder,
      now(),
      now()
    from public.propertysectionimages psi
    where psi.sectionid = v_old_section_id;
  end loop;

  return jsonb_build_object(
    'newPropertyId', v_new_property_id,
    'title', v_new_title
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- handle_new_user -> user_registration (skip when created_by_admin metadata)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_plan_id uuid;
  v_phone text;
  v_phone_prefix text;
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_space_pos int;
  v_provider text;
  v_is_oauth boolean;
  v_email_verified_at timestamptz;
  v_now timestamptz := timezone('utc', now());
  v_created_by_admin boolean;
  v_display text;
BEGIN
  v_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  v_phone_prefix := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phonePrefix', '')), '');

  v_first_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'firstName', '')), '');
  v_last_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'lastName', '')), '');

  IF v_first_name IS NULL AND v_last_name IS NULL THEN
    v_full_name := nullif(
      trim(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          ''
        )
      ),
      ''
    );

    IF v_full_name IS NOT NULL THEN
      v_space_pos := position(' ' IN v_full_name);
      IF v_space_pos > 0 THEN
        v_first_name := nullif(trim(substring(v_full_name FROM 1 FOR v_space_pos - 1)), '');
        v_last_name := nullif(trim(substring(v_full_name FROM v_space_pos + 1)), '');
      ELSE
        v_first_name := v_full_name;
        v_last_name := NULL;
      END IF;
    END IF;
  END IF;

  v_provider := lower(coalesce(new.raw_app_meta_data ->> 'provider', ''));
  v_is_oauth := v_provider NOT IN ('', 'email');
  IF NOT v_is_oauth
     AND jsonb_typeof(new.raw_app_meta_data -> 'providers') = 'array' THEN
    v_is_oauth := EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(new.raw_app_meta_data -> 'providers') AS p(value)
      WHERE p.value IS DISTINCT FROM 'email'
    );
  END IF;
  IF v_is_oauth AND new.email IS NOT NULL THEN
    v_email_verified_at := v_now;
  ELSE
    v_email_verified_at := NULL;
  END IF;

  v_created_by_admin := coalesce((new.raw_user_meta_data ->> 'created_by_admin')::boolean, false);

  INSERT INTO public."Members" (
    "Id",
    "UserId",
    "Email",
    "FirstName",
    "LastName",
    "Phone",
    "PhonePrefix",
    "EmailVerifiedAt",
    "Role",
    "IsDeleted",
    "Created",
    "LastModified"
  )
  VALUES (
    gen_random_uuid(),
    new.id,
    new.email,
    v_first_name,
    v_last_name,
    v_phone,
    v_phone_prefix,
    v_email_verified_at,
    'user',
    false,
    v_now,
    v_now
  )
  ON CONFLICT ("UserId") DO UPDATE
  SET
    "Email" = excluded."Email",
    "FirstName" = coalesce(excluded."FirstName", public."Members"."FirstName"),
    "LastName" = coalesce(excluded."LastName", public."Members"."LastName"),
    "Phone" = coalesce(excluded."Phone", public."Members"."Phone"),
    "PhonePrefix" = coalesce(excluded."PhonePrefix", public."Members"."PhonePrefix"),
    "EmailVerifiedAt" = coalesce(public."Members"."EmailVerifiedAt", excluded."EmailVerifiedAt"),
    "LastModified" = v_now
  RETURNING "Id" INTO v_member_id;

  SELECT p."Id"
  INTO v_plan_id
  FROM public."Plans" p
  WHERE p."Name" = 'Plan BASE-Inicial'
    AND p."IsDeleted" = false
    AND coalesce(p."IsActiveV2", p."IsActive", true) = true
  ORDER BY p."Key"
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Default signup plan "Plan BASE-Inicial" not found or inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public."BillingPlanAssignments" bpa
    WHERE bpa."SubjectType" = 'member'
      AND bpa."MemberOrCompanyId" = v_member_id
      AND bpa."IsActive" = true
  ) THEN
    INSERT INTO public."BillingPlanAssignments" (
      "SubjectType",
      "MemberOrCompanyId",
      "PlanId",
      "StartDate",
      "IsActive",
      "Created",
      "LastModified"
    ) VALUES (
      'member',
      v_member_id,
      v_plan_id,
      v_now,
      true,
      v_now,
      v_now
    );
  END IF;

  IF NOT v_created_by_admin THEN
    v_display := trim(coalesce(v_first_name, '') || ' ' || coalesce(v_last_name, ''));
    v_display := nullif(v_display, '');
    v_display := coalesce(v_display, '') || coalesce(' <' || nullif(trim(new.email), '') || '>', '');
    v_display := nullif(trim(v_display), '');

    PERFORM public.log_admin_activity(
      'user',
      'user_registration',
      v_member_id,
      coalesce(v_display, coalesce(new.email, v_member_id::text)),
      v_member_id,
      NULL,
      jsonb_build_object('authUserId', new.id, 'oauth', v_is_oauth)
    );
  END IF;

  RETURN new;
END;
$$;
