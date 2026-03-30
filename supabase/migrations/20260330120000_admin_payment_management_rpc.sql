-- Admin Payment Management RPCs
-- Artifact file (not auto-applied in this task).

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
  v_subscription_id uuid;
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

  SELECT s."Id"
  INTO v_subscription_id
  FROM public."Subscriptions" s
  JOIN public."Owners" o ON o."Id" = s."OwnerId"
  WHERE s."IsDeleted" = false
    AND o."IsDeleted" = false
    AND o."OwnerType" = v_owner_type
    AND (
      (v_member_id IS NOT NULL AND o."MemberId" = v_member_id)
      OR (v_company_id IS NOT NULL AND o."CompanyId" = v_company_id)
    )
  ORDER BY s."Created" DESC
  LIMIT 1;

  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'No active subscription found for selected bookings';
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
  WHERE b."Id" = ANY(p_booking_ids);

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
    v_subscription_id,
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

  UPDATE public."BookingReceipts"
  SET
    "Status" = CASE WHEN p_is_paid THEN 1 ELSE 0 END,
    "PaidAt" = CASE WHEN p_is_paid THEN now() ELSE NULL END,
    "LastModified" = now(),
    "LastModifiedBy" = v_current_user::text
  WHERE "Id" = p_receipt_id
    AND "IsDeleted" = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found';
  END IF;

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
