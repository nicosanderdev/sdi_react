-- Admin Payment Management RPCs
-- Artifact file (not auto-applied in this task).

ALTER TABLE public."BookingReceipts"
  ALTER COLUMN "SubscriptionId" DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_generate_booking_receipt(
  p_booking_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user uuid;
  v_is_admin boolean := false;
  v_booking_count int := 0;
  v_principal_count int := 0;
  v_member_owner_count int := 0;
  v_company_owner_count int := 0;
  v_owner_type public."OwnerType";
  v_member_id uuid;
  v_company_id uuid;
  v_owner_debug text;
  v_currency_code text;
  v_receipt_id uuid;
  v_total_amount numeric := 0;
BEGIN
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public."Members" m
    WHERE m."UserId" = v_current_user
      AND m."IsDeleted" = false
      AND m."Role" = 'admin'
  )
  INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF p_booking_ids IS NULL OR cardinality(p_booking_ids) = 0 THEN
    RAISE EXCEPTION 'No booking IDs provided';
  END IF;

  SELECT COUNT(*)
  INTO v_booking_count
  FROM public."Bookings" b
  WHERE b."Id" = ANY(p_booking_ids)
    AND b."IsDeleted" = false;

  IF v_booking_count <> cardinality(p_booking_ids) THEN
    RAISE EXCEPTION 'Some bookings do not exist or are deleted';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."Bookings" b
    WHERE b."Id" = ANY(p_booking_ids)
      AND b."IsDeleted" = false
      AND b."PaymentStatus" <> 0
  ) THEN
    RAISE EXCEPTION 'All selected bookings must be unpaid';
  END IF;

  WITH owner_principals AS (
    SELECT DISTINCT
      CASE
        WHEN o."MemberId" IS NOT NULL THEN 'member'::public."OwnerType"
        WHEN o."CompanyId" IS NOT NULL THEN 'company'::public."OwnerType"
        ELSE NULL
      END AS principal_kind,
      COALESCE(o."MemberId", o."CompanyId") AS principal_id,
      o."MemberId",
      o."CompanyId"
    FROM public."Bookings" b
    JOIN public."EstateProperties" ep ON ep."Id" = b."EstatePropertyId"
    JOIN public."Owners" o ON o."Id" = ep."OwnerId"
    WHERE b."Id" = ANY(p_booking_ids)
      AND o."IsDeleted" = false
  )
  SELECT
    COUNT(*) FILTER (WHERE principal_kind IS NOT NULL AND principal_id IS NOT NULL),
    COUNT(*) FILTER (WHERE principal_kind = 'member'::public."OwnerType"),
    COUNT(*) FILTER (WHERE principal_kind = 'company'::public."OwnerType"),
    (ARRAY_AGG(principal_id) FILTER (WHERE principal_kind = 'member'::public."OwnerType"))[1],
    (ARRAY_AGG(principal_id) FILTER (WHERE principal_kind = 'company'::public."OwnerType"))[1],
    COALESCE(
      STRING_AGG(
        principal_kind::text || ':' || principal_id::text,
        ', '
        ORDER BY principal_kind::text, principal_id::text
      ),
      '<none>'
    )
  INTO v_principal_count, v_member_owner_count, v_company_owner_count, v_member_id, v_company_id, v_owner_debug
  FROM owner_principals;

  IF v_principal_count <> 1 THEN
    RAISE EXCEPTION 'Selected bookings must belong to the same member or company. principals=%, member_principals=%, company_principals=%',
      v_owner_debug, v_member_owner_count, v_company_owner_count;
  END IF;

  IF v_member_owner_count = 1 THEN
    v_owner_type := 'member'::public."OwnerType";
    v_company_id := NULL;
  ELSIF v_company_owner_count = 1 THEN
    v_owner_type := 'company'::public."OwnerType";
    v_member_id := NULL;
  ELSE
    RAISE EXCEPTION 'Selected bookings contain invalid owner principal mapping. principals=%', v_owner_debug;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."Bookings" b
    WHERE b."Id" = ANY(p_booking_ids)
      AND b."Currency" <> (SELECT b2."Currency" FROM public."Bookings" b2 WHERE b2."Id" = p_booking_ids[1])
  ) THEN
    RAISE EXCEPTION 'All selected bookings must use the same currency';
  END IF;

  SELECT
    CASE b."Currency"
      WHEN 0 THEN 'USD'
      WHEN 1 THEN 'UYU'
      WHEN 2 THEN 'BRL'
      WHEN 3 THEN 'EUR'
      WHEN 4 THEN 'GBP'
      ELSE 'USD'
    END,
    COALESCE(SUM(COALESCE(b."TotalAmount", 0)), 0)
  INTO v_currency_code, v_total_amount
  FROM public."Bookings" b
  WHERE b."Id" = ANY(p_booking_ids)
  GROUP BY b."Currency";

  INSERT INTO public."BookingReceipts" (
    "SubscriptionId",
    "Amount",
    "Currency",
    "DueDate",
    "Status",
    "IsDeleted",
    "CreatedBy",
    "LastModifiedBy"
  )
  VALUES (
    NULL,
    v_total_amount,
    v_currency_code,
    now() + interval '7 days',
    0,
    false,
    v_current_user::text,
    v_current_user::text
  )
  RETURNING "Id" INTO v_receipt_id;

  INSERT INTO public."BookingReceiptItems" (
    "BookingReceiptId",
    "BookingId",
    "Amount"
  )
  SELECT
    v_receipt_id,
    b."Id",
    COALESCE(b."TotalAmount", 0)
  FROM public."Bookings" b
  WHERE b."Id" = ANY(p_booking_ids);

  RETURN v_receipt_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_booking_receipts(
  p_owner_name text DEFAULT NULL,
  p_owner_email text DEFAULT NULL,
  p_due_date_from date DEFAULT NULL,
  p_due_date_to date DEFAULT NULL,
  p_status int DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  user_name text,
  user_email text,
  amount numeric,
  currency text,
  item_count int,
  created timestamptz,
  due_date timestamptz,
  status int,
  paid_at timestamptz,
  items jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user uuid;
  v_is_admin boolean := false;
BEGIN
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public."Members" m
    WHERE m."UserId" = v_current_user
      AND m."IsDeleted" = false
      AND m."Role" = 'admin'
  )
  INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  RETURN QUERY
  WITH receipt_base AS (
    SELECT
      br."Id" AS id,
      br."Amount" AS amount,
      br."Currency" AS currency,
      br."Status" AS status,
      br."Created" AS created,
      br."DueDate" AS due_date,
      br."PaidAt" AS paid_at
    FROM public."BookingReceipts" br
    WHERE br."IsDeleted" = false
      AND (p_status IS NULL OR br."Status" = p_status)
      AND (p_due_date_from IS NULL OR br."DueDate"::date >= p_due_date_from)
      AND (p_due_date_to IS NULL OR br."DueDate"::date <= p_due_date_to)
  ),
  receipt_owner AS (
    SELECT DISTINCT ON (rb.id)
      rb.id,
      CASE
        WHEN o."OwnerType" = 'member' THEN CONCAT_WS(' ', m."FirstName", m."LastName")
        WHEN o."OwnerType" = 'company' THEN c."Name"
        ELSE NULL
      END AS user_name,
      CASE
        WHEN o."OwnerType" = 'member' THEN m."Email"
        WHEN o."OwnerType" = 'company' THEN c."BillingEmail"
        ELSE NULL
      END AS user_email
    FROM receipt_base rb
    LEFT JOIN public."BookingReceiptItems" bri
      ON bri."BookingReceiptId" = rb.id
    LEFT JOIN public."Bookings" b
      ON b."Id" = bri."BookingId"
    LEFT JOIN public."EstateProperties" ep
      ON ep."Id" = b."EstatePropertyId"
    LEFT JOIN public."Owners" o
      ON o."Id" = ep."OwnerId"
      AND o."IsDeleted" = false
    LEFT JOIN public."Members" m
      ON m."Id" = o."MemberId"
      AND m."IsDeleted" = false
    LEFT JOIN public."Companies" c
      ON c."Id" = o."CompanyId"
      AND c."IsDeleted" = false
    ORDER BY rb.id, bri."Id" ASC
  ),
  filtered_receipts AS (
    SELECT rb.*
    FROM receipt_base rb
    JOIN receipt_owner ro ON ro.id = rb.id
    WHERE (p_owner_name IS NULL OR COALESCE(ro.user_name, '') ILIKE ('%' || p_owner_name || '%'))
      AND (p_owner_email IS NULL OR COALESCE(ro.user_email, '') ILIKE ('%' || p_owner_email || '%'))
  )
  SELECT
    fr.id,
    COALESCE(ro.user_name, 'Sin propietario')::text AS user_name,
    COALESCE(ro.user_email, '')::text AS user_email,
    COALESCE(fr.amount, 0)::numeric AS amount,
    COALESCE(fr.currency, 'USD')::text AS currency,
    (
      SELECT COUNT(*)
      FROM public."BookingReceiptItems" bri
      WHERE bri."BookingReceiptId" = fr.id
    )::int AS item_count,
    fr.created::timestamptz,
    fr.due_date::timestamptz,
    COALESCE(fr.status, 0)::int AS status,
    fr.paid_at::timestamptz,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', bri."Id",
            'bookingId', bri."BookingId",
            'amount', COALESCE(bri."Amount", 0),
            'bookingCheckInDate', b."CheckInDate",
            'bookingCheckOutDate', b."CheckOutDate"
          )
          ORDER BY b."CheckInDate" ASC NULLS LAST
        )
        FROM public."BookingReceiptItems" bri
        LEFT JOIN public."Bookings" b
          ON b."Id" = bri."BookingId"
        WHERE bri."BookingReceiptId" = fr.id
      ),
      '[]'::jsonb
    )::jsonb AS items
  FROM filtered_receipts fr
  LEFT JOIN receipt_owner ro ON ro.id = fr.id
  ORDER BY fr.created DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_booking_receipt_status(
  p_receipt_id uuid,
  p_is_paid boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user uuid;
  v_is_admin boolean := false;
BEGIN
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public."Members" m
    WHERE m."UserId" = v_current_user
      AND m."IsDeleted" = false
      AND m."Role" = 'admin'
  )
  INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public."BookingReceipts" br
    WHERE br."Id" = p_receipt_id
      AND br."IsDeleted" = false
  ) THEN
    RAISE EXCEPTION 'Receipt not found';
  END IF;

  UPDATE public."BookingReceipts"
  SET
    "Status" = CASE WHEN p_is_paid THEN 1 ELSE 0 END,
    "PaidAt" = CASE WHEN p_is_paid THEN now() ELSE NULL END,
    "LastModified" = now(),
    "LastModifiedBy" = v_current_user::text
  WHERE "Id" = p_receipt_id
    AND "IsDeleted" = false;

  UPDATE public."Bookings" b
  SET
    "PaymentStatus" = CASE WHEN p_is_paid THEN 1 ELSE 0 END,
    "LastModified" = now(),
    "LastModifiedBy" = v_current_user::text
  FROM public."BookingReceiptItems" bri
  WHERE bri."BookingReceiptId" = p_receipt_id
    AND bri."BookingId" = b."Id";
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_logs_for_date(p_date date)
RETURNS TABLE (
  event_type text,
  action text,
  at timestamp with time zone,
  target_id uuid,
  target_display text,
  performed_by_display text,
  details jsonb
)
LANGUAGE sql
SET search_path TO 'public'
AS $$
  SELECT event_type, action, at, target_id, target_display, performed_by_display, details
  FROM (
    -- User events
    SELECT
      'user'::text AS event_type,
      mah."ActionType"::text AS action,
      mah."PerformedAt" AS at,
      mah."MemberId" AS target_id,
      TRIM(COALESCE(t."FirstName", '') || ' ' || COALESCE(t."LastName", ''))
        || COALESCE(' <' || NULLIF(TRIM(t."Email"), '') || '>', '') AS target_display,
      COALESCE(
        NULLIF(TRIM(COALESCE(p."FirstName", '') || ' ' || COALESCE(p."LastName", '')), ''),
        NULLIF(TRIM(p."Email"), ''),
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

    -- Property events
    SELECT
      'property'::text AS event_type,
      pma."ActionType"::text AS action,
      pma."PerformedAt" AS at,
      pma."PropertyId" AS target_id,
      COALESCE(ll."Title", '') AS target_display,
      COALESCE(
        NULLIF(TRIM(COALESCE(m."FirstName", '') || ' ' || COALESCE(m."LastName", '')), ''),
        NULLIF(TRIM(m."Email"), ''),
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

    -- Booking created
    SELECT
      'booking'::text AS event_type,
      'created'::text AS action,
      b."Created" AS at,
      b."Id" AS target_id,
      'Booking ' || b."Id"::text AS target_display,
      COALESCE(
        NULLIF(TRIM(COALESCE(mc_id."FirstName", '') || ' ' || COALESCE(mc_id."LastName", '')), ''),
        NULLIF(TRIM(mc_id."Email"), ''),
        NULLIF(TRIM(COALESCE(mc_user."FirstName", '') || ' ' || COALESCE(mc_user."LastName", '')), ''),
        NULLIF(TRIM(mc_user."Email"), ''),
        NULLIF(b."CreatedBy", ''),
        'Unknown User'
      ) AS performed_by_display,
      jsonb_build_object('estatePropertyId', b."EstatePropertyId", 'checkIn', b."CheckInDate", 'checkOut', b."CheckOutDate") AS details
    FROM public."Bookings" b
    LEFT JOIN public."Members" mc_id
      ON mc_id."Id"::text = b."CreatedBy" AND mc_id."IsDeleted" = false
    LEFT JOIN public."Members" mc_user
      ON mc_user."UserId"::text = b."CreatedBy" AND mc_user."IsDeleted" = false
    WHERE b."IsDeleted" = false
      AND b."Created" >= p_date::timestamptz
      AND b."Created" < (p_date + interval '1 day')::timestamptz

    UNION ALL

    -- Booking updated
    SELECT
      'booking'::text AS event_type,
      'updated'::text AS action,
      b."LastModified" AS at,
      b."Id" AS target_id,
      'Booking ' || b."Id"::text AS target_display,
      COALESCE(
        NULLIF(TRIM(COALESCE(mu_id."FirstName", '') || ' ' || COALESCE(mu_id."LastName", '')), ''),
        NULLIF(TRIM(mu_id."Email"), ''),
        NULLIF(TRIM(COALESCE(mu_user."FirstName", '') || ' ' || COALESCE(mu_user."LastName", '')), ''),
        NULLIF(TRIM(mu_user."Email"), ''),
        NULLIF(b."LastModifiedBy", ''),
        'Unknown User'
      ) AS performed_by_display,
      jsonb_build_object('estatePropertyId', b."EstatePropertyId", 'checkIn', b."CheckInDate", 'checkOut', b."CheckOutDate") AS details
    FROM public."Bookings" b
    LEFT JOIN public."Members" mu_id
      ON mu_id."Id"::text = b."LastModifiedBy" AND mu_id."IsDeleted" = false
    LEFT JOIN public."Members" mu_user
      ON mu_user."UserId"::text = b."LastModifiedBy" AND mu_user."IsDeleted" = false
    WHERE b."IsDeleted" = false
      AND b."LastModified" >= p_date::timestamptz
      AND b."LastModified" < (p_date + interval '1 day')::timestamptz
      AND b."LastModified" <> b."Created"

    UNION ALL

    -- Receipt marked as paid (derived from existing receipt state updates)
    SELECT
      'booking'::text AS event_type,
      'RECEIPT_MARKED_AS_PAID'::text AS action,
      br."LastModified" AS at,
      br."Id" AS target_id,
      'Receipt ' || br."Id"::text AS target_display,
      COALESCE(
        NULLIF(TRIM(COALESCE(rm_id."FirstName", '') || ' ' || COALESCE(rm_id."LastName", '')), ''),
        NULLIF(TRIM(rm_id."Email"), ''),
        NULLIF(TRIM(COALESCE(rm_user."FirstName", '') || ' ' || COALESCE(rm_user."LastName", '')), ''),
        NULLIF(TRIM(rm_user."Email"), ''),
        NULLIF(br."LastModifiedBy", ''),
        'Unknown User'
      ) AS performed_by_display,
      jsonb_build_object(
        'receiptId', br."Id",
        'bookingIds', COALESCE((
          SELECT jsonb_agg(bri."BookingId" ORDER BY bri."BookingId")
          FROM public."BookingReceiptItems" bri
          WHERE bri."BookingReceiptId" = br."Id"
        ), '[]'::jsonb)
      ) AS details
    FROM public."BookingReceipts" br
    LEFT JOIN public."Members" rm_id
      ON rm_id."Id"::text = br."LastModifiedBy" AND rm_id."IsDeleted" = false
    LEFT JOIN public."Members" rm_user
      ON rm_user."UserId"::text = br."LastModifiedBy" AND rm_user."IsDeleted" = false
    WHERE br."IsDeleted" = false
      AND br."Status" = 1
      AND br."PaidAt" IS NOT NULL
      AND br."LastModified" >= p_date::timestamptz
      AND br."LastModified" < (p_date + interval '1 day')::timestamptz
  ) logs
  ORDER BY at DESC;
$$;
