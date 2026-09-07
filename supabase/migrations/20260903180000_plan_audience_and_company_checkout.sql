-- Plan audience (member vs company), stop auto-assigning member BASE to companies,
-- permanent assignments + first billing cycle, paid company checkout attempts,
-- and admin member-plan assignment.

-- ---------------------------------------------------------------------------
-- Plans.Audience
-- ---------------------------------------------------------------------------
ALTER TABLE public."Plans"
  ADD COLUMN IF NOT EXISTS "Audience" text;

UPDATE public."Plans"
SET "Audience" = CASE
  WHEN "Key" IN (2, 4) OR lower("Name") LIKE 'company%' THEN 'company'
  ELSE 'member'
END
WHERE "Audience" IS NULL;

ALTER TABLE public."Plans"
  ALTER COLUMN "Audience" SET DEFAULT 'member';

UPDATE public."Plans"
SET "Audience" = 'member'
WHERE "Audience" IS NULL;

ALTER TABLE public."Plans"
  ALTER COLUMN "Audience" SET NOT NULL;

ALTER TABLE public."Plans"
  DROP CONSTRAINT IF EXISTS "Plans_Audience_check";

ALTER TABLE public."Plans"
  ADD CONSTRAINT "Plans_Audience_check"
  CHECK ("Audience" IN ('member', 'company'));

COMMENT ON COLUMN public."Plans"."Audience" IS
  'Which billing subject may use this SKU: member or company.';

-- Member catalog: BASE-Inicial, Free, Manager Pro
UPDATE public."Plans"
SET "Audience" = 'member'
WHERE "Id" IN (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid,
  '44444444-4444-4444-8444-444444444444'::uuid
);

-- Company Small: company audience, UYU 15
UPDATE public."Plans"
SET
  "Audience" = 'company',
  "Currency" = 'UYU',
  "MonthlyPrice" = 15,
  "Price" = 15
WHERE "Id" = '33333333-3333-4333-8333-333333333333'::uuid;

-- Company Unlimited: inactive placeholder at 0 UYU, unlimited caps
INSERT INTO public."Plans" (
  "Id",
  "Key",
  "Name",
  "MonthlyPrice",
  "Currency",
  "MaxProperties",
  "MaxPublishedProperties",
  "MaxUsers",
  "MaxStorageMb",
  "BillingCycle",
  "IsActive",
  "IsDeleted",
  "Created",
  "LastModified",
  "PricingModel",
  "Price",
  "ListingLimit",
  "DurationDays",
  "IsActiveV2",
  "Audience"
)
VALUES (
  '55555555-5555-4555-8555-555555555555'::uuid,
  4,
  'Company Unlimited',
  0,
  'UYU',
  NULL,
  NULL,
  NULL,
  NULL,
  30,
  false,
  false,
  now(),
  now(),
  'per_listing',
  0,
  NULL,
  30,
  false,
  'company'
)
ON CONFLICT ("Id") DO UPDATE SET
  "Key" = excluded."Key",
  "Name" = excluded."Name",
  "MonthlyPrice" = excluded."MonthlyPrice",
  "Currency" = excluded."Currency",
  "Audience" = excluded."Audience",
  "IsActive" = excluded."IsActive",
  "IsActiveV2" = excluded."IsActiveV2",
  "IsDeleted" = excluded."IsDeleted",
  "LastModified" = now();

-- ---------------------------------------------------------------------------
-- Stop auto-assigning member BASE-Inicial to new companies
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS companies_assign_base_inicial ON public."Companies";
DROP FUNCTION IF EXISTS public.trg_companies_assign_base_inicial();
DROP FUNCTION IF EXISTS public.assign_company_base_inicial_plan(uuid);

-- ---------------------------------------------------------------------------
-- Checkout attempts for company plan Checkout Pro
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_checkout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public."Members"("Id"),
  plan_id uuid NOT NULL REFERENCES public."Plans"("Id"),
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  amount numeric NOT NULL,
  currency_code text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  company_id uuid REFERENCES public."Companies"("Id"),
  preference_id text,
  init_point text,
  sandbox_init_point text,
  external_reference text,
  mp_payment_id text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT plan_checkout_attempts_kind_check
    CHECK (kind IN ('create_company', 'change_company')),
  CONSTRAINT plan_checkout_attempts_status_check
    CHECK (status IN (
      'created',
      'preference_created',
      'pending',
      'approved',
      'failed',
      'cancelled'
    ))
);

CREATE INDEX IF NOT EXISTS plan_checkout_attempts_member_id_idx
  ON public.plan_checkout_attempts (member_id);

CREATE INDEX IF NOT EXISTS plan_checkout_attempts_status_idx
  ON public.plan_checkout_attempts (status);

CREATE UNIQUE INDEX IF NOT EXISTS plan_checkout_attempts_preference_id_uidx
  ON public.plan_checkout_attempts (preference_id)
  WHERE preference_id IS NOT NULL;

ALTER TABLE public.plan_checkout_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_checkout_attempts_service_all ON public.plan_checkout_attempts;
CREATE POLICY plan_checkout_attempts_service_all
  ON public.plan_checkout_attempts
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS plan_checkout_attempts_select_own ON public.plan_checkout_attempts;
CREATE POLICY plan_checkout_attempts_select_own
  ON public.plan_checkout_attempts
  FOR SELECT
  TO authenticated
  USING (member_id = public.current_member_id());

GRANT SELECT ON public.plan_checkout_attempts TO authenticated;
GRANT ALL ON public.plan_checkout_attempts TO service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plan_fixed_price(p_plan_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(p."MonthlyPrice", p."Price", 0)
  FROM public."Plans" p
  WHERE p."Id" = p_plan_id;
$$;

CREATE OR REPLACE FUNCTION public.ensure_open_company_billing_cycle(p_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cycle_id uuid;
  v_duration integer;
  v_now timestamptz := timezone('utc', now());
BEGIN
  SELECT bc."Id"
    INTO v_cycle_id
  FROM public."BillingCycles" bc
  WHERE bc."SubjectType" = 'company'
    AND bc."MemberOrCompanyId" = p_company_id
    AND bc."Status" = 'open'
  ORDER BY bc."StartDate" DESC
  LIMIT 1;

  IF v_cycle_id IS NOT NULL THEN
    RETURN v_cycle_id;
  END IF;

  SELECT coalesce(p."DurationDays", p."BillingCycle", 30)
    INTO v_duration
  FROM public."BillingPlanAssignments" bpa
  JOIN public."Plans" p ON p."Id" = bpa."PlanId"
  WHERE bpa."SubjectType" = 'company'
    AND bpa."MemberOrCompanyId" = p_company_id
    AND bpa."IsActive" = true
  ORDER BY bpa."StartDate" DESC
  LIMIT 1;

  v_duration := coalesce(v_duration, 30);

  INSERT INTO public."BillingCycles" (
    "SubjectType",
    "MemberOrCompanyId",
    "StartDate",
    "EndDate",
    "Status",
    "TotalAmount",
    "CreatedAt",
    "UpdatedAt",
    "CreatedBy",
    "LastModifiedBy"
  ) VALUES (
    'company',
    p_company_id,
    v_now,
    v_now + make_interval(days => v_duration),
    'open',
    0,
    v_now,
    v_now,
    'system',
    'system'
  )
  RETURNING "Id" INTO v_cycle_id;

  RETURN v_cycle_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_open_company_billing_cycle(uuid) IS
  'Opens a 30-day (or plan DurationDays) billing cycle for a company if none is open. Plan assignment stays.';

REVOKE ALL ON FUNCTION public.plan_fixed_price(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.plan_fixed_price(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.ensure_open_company_billing_cycle(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_open_company_billing_cycle(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.assign_permanent_billing_plan(
  p_subject_type text,
  p_subject_id uuid,
  p_plan_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_assignment_id uuid;
  v_audience text;
BEGIN
  IF p_subject_type NOT IN ('member', 'company') THEN
    RAISE EXCEPTION 'Invalid subject type.';
  END IF;

  SELECT p."Audience"
    INTO v_audience
  FROM public."Plans" p
  WHERE p."Id" = p_plan_id
    AND p."IsDeleted" = false
    AND coalesce(p."IsActiveV2", p."IsActive", true) = true;

  IF v_audience IS NULL THEN
    RAISE EXCEPTION 'Plan not found or inactive';
  END IF;

  IF v_audience IS DISTINCT FROM p_subject_type THEN
    RAISE EXCEPTION 'Plan is not available for this entity type.';
  END IF;

  UPDATE public."BillingPlanAssignments"
  SET
    "IsActive" = false,
    "EndDate" = v_now,
    "LastModified" = v_now
  WHERE "SubjectType" = p_subject_type
    AND "MemberOrCompanyId" = p_subject_id
    AND "IsActive" = true;

  INSERT INTO public."BillingPlanAssignments" (
    "SubjectType",
    "MemberOrCompanyId",
    "PlanId",
    "StartDate",
    "EndDate",
    "IsActive",
    "Created",
    "LastModified"
  ) VALUES (
    p_subject_type,
    p_subject_id,
    p_plan_id,
    v_now,
    NULL,
    true,
    v_now,
    v_now
  )
  RETURNING "Id" INTO v_assignment_id;

  IF p_subject_type = 'company' THEN
    UPDATE public."BillingCycles"
    SET
      "Status" = 'closed',
      "UpdatedAt" = v_now,
      "LastModifiedBy" = 'system'
    WHERE "SubjectType" = 'company'
      AND "MemberOrCompanyId" = p_subject_id
      AND "Status" = 'open';

    PERFORM public.ensure_open_company_billing_cycle(p_subject_id);
  END IF;

  RETURN v_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_permanent_billing_plan(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_permanent_billing_plan(text, uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Create company with chosen plan (no MP when price is 0 or caller is platform admin)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_company_for_current_member(text, text, text);

CREATE OR REPLACE FUNCTION public.create_company_for_current_member(
  p_name text,
  p_billing_email text,
  p_description text DEFAULT '',
  p_plan_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_member public."Members"%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_company public."Companies"%ROWTYPE;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_email text := nullif(trim(coalesce(p_billing_email, '')), '');
  v_description text := trim(coalesce(p_description, ''));
  v_plan public."Plans"%ROWTYPE;
  v_amount numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'El nombre de la compañía es obligatorio';
  END IF;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'El correo de facturación es obligatorio';
  END IF;

  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'Debes elegir un plan de compañía';
  END IF;

  SELECT *
    INTO v_member
  FROM public."Members" m
  WHERE m."UserId" = v_user_id
    AND m."IsDeleted" = false
  LIMIT 1;

  IF v_member."Id" IS NULL THEN
    RAISE EXCEPTION 'Member not found for user';
  END IF;

  IF lower(trim(coalesce(v_member."Role", 'user'))) = 'user'
     AND (v_member."EmailVerifiedAt" IS NULL OR v_member."PhoneVerifiedAt" IS NULL) THEN
    RAISE EXCEPTION 'Debes verificar tu correo electrónico y teléfono antes de crear o editar propiedades o empresas. Ve a tu perfil para verificarlos.';
  END IF;

  SELECT *
    INTO v_plan
  FROM public."Plans" p
  WHERE p."Id" = p_plan_id
    AND p."IsDeleted" = false;

  IF v_plan."Id" IS NULL THEN
    RAISE EXCEPTION 'Plan not found or inactive';
  END IF;

  IF v_plan."Audience" IS DISTINCT FROM 'company'
     OR coalesce(v_plan."IsActiveV2", v_plan."IsActive", true) = false THEN
    RAISE EXCEPTION 'Plan is not available for this entity type.';
  END IF;

  v_amount := coalesce(v_plan."MonthlyPrice", v_plan."Price", 0);
  IF v_amount > 0 AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'PLAN_PAYMENT_REQUIRED';
  END IF;

  INSERT INTO public."Companies" (
    "Name",
    "Description",
    "BillingContactUserId",
    "BillingEmail",
    "CreatedAt",
    "IsDeleted",
    "Created",
    "CreatedBy",
    "LastModified",
    "LastModifiedBy"
  ) VALUES (
    v_name,
    v_description,
    v_user_id,
    v_email,
    v_now,
    false,
    v_now,
    v_user_id::text,
    v_now,
    v_user_id::text
  )
  RETURNING * INTO v_company;

  INSERT INTO public."CompanyMembers" (
    "MemberId",
    "CompanyId",
    "Role",
    "AddedBy",
    "JoinedAt",
    "IsDeleted"
  ) VALUES (
    v_member."Id",
    v_company."Id",
    'Admin',
    v_member."Id",
    v_now,
    false
  );

  PERFORM public.assign_permanent_billing_plan('company', v_company."Id", p_plan_id);

  RETURN to_jsonb(v_company);
END;
$$;

COMMENT ON FUNCTION public.create_company_for_current_member(text, text, text, uuid) IS
  'Creates a company, first Admin, and permanent company plan. Priced plans require Checkout Pro unless the caller is a platform admin.';

REVOKE ALL ON FUNCTION public.create_company_for_current_member(text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_company_for_current_member(text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_for_current_member(text, text, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.change_company_plan_for_current_admin(
  p_company_id uuid,
  p_plan_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan public."Plans"%ROWTYPE;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_company_id IS NULL OR p_plan_id IS NULL THEN
    RAISE EXCEPTION 'Company and plan are required.';
  END IF;

  IF NOT public.is_admin() AND NOT public.is_company_admin(p_company_id) THEN
    RAISE EXCEPTION 'Solo los administradores de la empresa pueden cambiar el plan.';
  END IF;

  SELECT *
    INTO v_plan
  FROM public."Plans" p
  WHERE p."Id" = p_plan_id
    AND p."IsDeleted" = false;

  IF v_plan."Id" IS NULL
     OR v_plan."Audience" IS DISTINCT FROM 'company'
     OR coalesce(v_plan."IsActiveV2", v_plan."IsActive", true) = false THEN
    RAISE EXCEPTION 'Plan is not available for this entity type.';
  END IF;

  v_amount := coalesce(v_plan."MonthlyPrice", v_plan."Price", 0);
  IF v_amount > 0 AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'PLAN_PAYMENT_REQUIRED';
  END IF;

  PERFORM public.assign_permanent_billing_plan('company', p_company_id, p_plan_id);
END;
$$;

REVOKE ALL ON FUNCTION public.change_company_plan_for_current_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_company_plan_for_current_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_company_plan_for_current_admin(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.assign_member_plan_as_admin(
  p_member_id uuid,
  p_plan_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan public."Plans"%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_member_id IS NULL OR p_plan_id IS NULL THEN
    RAISE EXCEPTION 'Member and plan are required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public."Members" m
    WHERE m."Id" = p_member_id AND m."IsDeleted" = false
  ) THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  SELECT *
    INTO v_plan
  FROM public."Plans" p
  WHERE p."Id" = p_plan_id
    AND p."IsDeleted" = false;

  IF v_plan."Id" IS NULL
     OR v_plan."Audience" IS DISTINCT FROM 'member'
     OR coalesce(v_plan."IsActiveV2", v_plan."IsActive", true) = false THEN
    RAISE EXCEPTION 'Plan is not available for this entity type.';
  END IF;

  PERFORM public.assign_permanent_billing_plan('member', p_member_id, p_plan_id);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_member_plan_as_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_member_plan_as_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_member_plan_as_admin(uuid, uuid) TO service_role;

-- Service-role: apply approved Checkout Pro to create/change company plan
CREATE OR REPLACE FUNCTION public.finalize_plan_checkout(
  p_attempt_id uuid,
  p_mp_payment_id text,
  p_amount numeric DEFAULT NULL,
  p_currency_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attempt public.plan_checkout_attempts%ROWTYPE;
  v_plan public."Plans"%ROWTYPE;
  v_member public."Members"%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_company public."Companies"%ROWTYPE;
  v_name text;
  v_email text;
  v_description text;
  v_company_id uuid;
  v_payload jsonb;
BEGIN
  SELECT * INTO v_attempt
  FROM public.plan_checkout_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attempt not found');
  END IF;

  IF v_attempt.status = 'approved' AND v_attempt.company_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_approved', true,
      'company_id', v_attempt.company_id
    );
  END IF;

  IF p_amount IS NOT NULL AND abs(coalesce(v_attempt.amount, 0) - p_amount) > 0.05 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount mismatch');
  END IF;

  SELECT * INTO v_plan FROM public."Plans" WHERE "Id" = v_attempt.plan_id;
  IF v_plan."Id" IS NULL OR v_plan."Audience" IS DISTINCT FROM 'company' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid plan');
  END IF;

  SELECT * INTO v_member
  FROM public."Members"
  WHERE "Id" = v_attempt.member_id AND "IsDeleted" = false;

  IF v_member."Id" IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found');
  END IF;

  v_payload := coalesce(v_attempt.payload, '{}'::jsonb);

  IF v_attempt.kind = 'create_company' THEN
    v_name := nullif(trim(coalesce(v_payload ->> 'name', '')), '');
    v_email := nullif(trim(coalesce(v_payload ->> 'billingEmail', '')), '');
    v_description := trim(coalesce(v_payload ->> 'description', ''));

    IF v_name IS NULL OR v_email IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing company details');
    END IF;

    INSERT INTO public."Companies" (
      "Name",
      "Description",
      "BillingContactUserId",
      "BillingEmail",
      "CreatedAt",
      "IsDeleted",
      "Created",
      "CreatedBy",
      "LastModified",
      "LastModifiedBy"
    ) VALUES (
      v_name,
      v_description,
      v_member."UserId",
      v_email,
      v_now,
      false,
      v_now,
      v_member."UserId"::text,
      v_now,
      v_member."UserId"::text
    )
    RETURNING * INTO v_company;

    INSERT INTO public."CompanyMembers" (
      "MemberId",
      "CompanyId",
      "Role",
      "AddedBy",
      "JoinedAt",
      "IsDeleted"
    ) VALUES (
      v_member."Id",
      v_company."Id",
      'Admin',
      v_member."Id",
      v_now,
      false
    );

    PERFORM public.assign_permanent_billing_plan('company', v_company."Id", v_attempt.plan_id);
    v_company_id := v_company."Id";
  ELSIF v_attempt.kind = 'change_company' THEN
    v_company_id := nullif(v_payload ->> 'companyId', '')::uuid;
    IF v_company_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing company id');
    END IF;

    PERFORM public.assign_permanent_billing_plan('company', v_company_id, v_attempt.plan_id);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid kind');
  END IF;

  UPDATE public.plan_checkout_attempts
  SET
    status = 'approved',
    company_id = v_company_id,
    mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id),
    updated_at = v_now
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_approved', false,
    'company_id', v_company_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_plan_checkout(uuid, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_plan_checkout(uuid, text, numeric, text) TO service_role;

-- Audience on admin catalog upsert (without rewriting the full insert/update map)
CREATE OR REPLACE FUNCTION public.upsert_admin_plan(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_is_create boolean;
  v_key integer;
  v_name text;
  v_currency text;
  v_pricing_model text;
  v_property_type public."PropertyType";
  v_price numeric;
  v_monthly_price numeric;
  v_duration_days integer;
  v_billing_cycle integer;
  v_listing_limit integer;
  v_max_properties integer;
  v_max_published integer;
  v_modified_by text;
  v_audience text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_payload IS NULL OR p_payload = '{}'::jsonb THEN
    RAISE EXCEPTION 'Payload required';
  END IF;

  v_modified_by := coalesce(auth.jwt() ->> 'email', auth.jwt() ->> 'sub');
  v_id := nullif(trim(p_payload ->> 'Id'), '')::uuid;
  v_is_create := v_id IS NULL;
  v_name := nullif(trim(p_payload ->> 'Name'), '');
  v_currency := nullif(trim(p_payload ->> 'Currency'), '');
  v_pricing_model := nullif(trim(p_payload ->> 'PricingModel'), '');
  v_audience := nullif(trim(p_payload ->> 'Audience'), '');

  IF v_audience IS NOT NULL AND v_audience NOT IN ('member', 'company') THEN
    RAISE EXCEPTION 'Invalid Audience: %', v_audience;
  END IF;

  IF v_pricing_model IS NOT NULL
     AND v_pricing_model NOT IN ('per_booking', 'per_listing', 'hybrid') THEN
    RAISE EXCEPTION 'Invalid PricingModel: %', v_pricing_model;
  END IF;

  IF p_payload ? 'PropertyType' THEN
    IF p_payload ->> 'PropertyType' IS NULL
       OR trim(p_payload ->> 'PropertyType') = '' THEN
      v_property_type := NULL;
    ELSE
      v_property_type := (p_payload ->> 'PropertyType')::public."PropertyType";
    END IF;
  END IF;

  IF v_is_create THEN
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Name is required';
    END IF;
    IF NOT (p_payload ? 'Key') OR p_payload ->> 'Key' IS NULL THEN
      RAISE EXCEPTION 'Key is required on create';
    END IF;
    v_key := (p_payload ->> 'Key')::integer;
    IF v_currency IS NULL THEN
      RAISE EXCEPTION 'Currency is required';
    END IF;
    IF v_pricing_model IS NULL THEN
      RAISE EXCEPTION 'PricingModel is required';
    END IF;
    IF EXISTS (SELECT 1 FROM public."Plans" p WHERE p."Key" = v_key) THEN
      RAISE EXCEPTION 'Plan Key % already exists', v_key;
    END IF;

    v_id := gen_random_uuid();
    v_price := coalesce((p_payload ->> 'Price')::numeric, 0);
    v_monthly_price := coalesce((p_payload ->> 'MonthlyPrice')::numeric, v_price, 0);
    v_duration_days := coalesce((p_payload ->> 'DurationDays')::integer, 30);
    v_billing_cycle := coalesce((p_payload ->> 'BillingCycle')::integer, v_duration_days, 30);
    v_listing_limit := (p_payload ->> 'ListingLimit')::integer;
    v_max_properties := coalesce((p_payload ->> 'MaxProperties')::integer, v_listing_limit);
    v_max_published := coalesce(
      (p_payload ->> 'MaxPublishedProperties')::integer,
      v_listing_limit,
      v_max_properties
    );

    INSERT INTO public."Plans" (
      "Id", "Key", "Name", "MonthlyPrice", "Currency", "MaxProperties", "MaxUsers",
      "MaxStorageMb", "BillingCycle", "IsActive", "IsDeleted", "Created", "LastModified",
      "LastModifiedBy", "MaxPublishedProperties", "CommissionPercentage",
      "CommissionMinimumAmount", "ExtraPropertiesPrice11to30", "ExtraPropertiesPrice31Plus",
      "BookingReceiptMinimumAmount", "PropertyType", "PricingModel", "Price",
      "MinMonthlyFee", "PricePerBooking", "ListingLimit", "DurationDays", "IsActiveV2",
      "BookingLimit", "Audience"
    ) VALUES (
      v_id,
      v_key,
      v_name,
      v_monthly_price,
      v_currency,
      v_max_properties,
      (p_payload ->> 'MaxUsers')::integer,
      (p_payload ->> 'MaxStorageMb')::integer,
      v_billing_cycle,
      coalesce((p_payload ->> 'IsActive')::boolean, true),
      coalesce((p_payload ->> 'IsDeleted')::boolean, false),
      now(),
      now(),
      v_modified_by,
      v_max_published,
      (p_payload ->> 'CommissionPercentage')::numeric,
      (p_payload ->> 'CommissionMinimumAmount')::numeric,
      (p_payload ->> 'ExtraPropertiesPrice11to30')::numeric,
      (p_payload ->> 'ExtraPropertiesPrice31Plus')::numeric,
      (p_payload ->> 'BookingReceiptMinimumAmount')::numeric,
      v_property_type,
      v_pricing_model,
      v_price,
      (p_payload ->> 'MinMonthlyFee')::numeric,
      (p_payload ->> 'PricePerBooking')::numeric,
      coalesce(v_listing_limit, v_max_published),
      v_duration_days,
      coalesce((p_payload ->> 'IsActiveV2')::boolean, true),
      (p_payload ->> 'BookingLimit')::integer,
      coalesce(v_audience, 'member')
    );

    RETURN v_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public."Plans" p WHERE p."Id" = v_id) THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  IF p_payload ? 'Price' THEN
    v_price := (p_payload ->> 'Price')::numeric;
  END IF;
  IF p_payload ? 'MonthlyPrice' THEN
    v_monthly_price := (p_payload ->> 'MonthlyPrice')::numeric;
  ELSIF p_payload ? 'Price' THEN
    v_monthly_price := v_price;
  END IF;
  IF p_payload ? 'DurationDays' THEN
    v_duration_days := (p_payload ->> 'DurationDays')::integer;
  END IF;
  IF p_payload ? 'BillingCycle' THEN
    v_billing_cycle := (p_payload ->> 'BillingCycle')::integer;
  ELSIF p_payload ? 'DurationDays' THEN
    v_billing_cycle := v_duration_days;
  END IF;
  IF p_payload ? 'ListingLimit' THEN
    v_listing_limit := (p_payload ->> 'ListingLimit')::integer;
  END IF;
  IF p_payload ? 'MaxProperties' THEN
    v_max_properties := (p_payload ->> 'MaxProperties')::integer;
  ELSIF p_payload ? 'ListingLimit' THEN
    v_max_properties := v_listing_limit;
  END IF;
  IF p_payload ? 'MaxPublishedProperties' THEN
    v_max_published := (p_payload ->> 'MaxPublishedProperties')::integer;
  ELSIF p_payload ? 'ListingLimit' THEN
    v_max_published := v_listing_limit;
  ELSIF p_payload ? 'MaxProperties' THEN
    v_max_published := v_max_properties;
  END IF;

  UPDATE public."Plans" p
  SET
    "Name" = coalesce(v_name, p."Name"),
    "MonthlyPrice" = coalesce(v_monthly_price, p."MonthlyPrice"),
    "Currency" = coalesce(v_currency, p."Currency"),
    "MaxProperties" = CASE
      WHEN p_payload ? 'MaxProperties' OR p_payload ? 'ListingLimit' THEN v_max_properties
      ELSE p."MaxProperties"
    END,
    "MaxUsers" = CASE
      WHEN p_payload ? 'MaxUsers' THEN (p_payload ->> 'MaxUsers')::integer
      ELSE p."MaxUsers"
    END,
    "MaxStorageMb" = CASE
      WHEN p_payload ? 'MaxStorageMb' THEN (p_payload ->> 'MaxStorageMb')::integer
      ELSE p."MaxStorageMb"
    END,
    "BillingCycle" = coalesce(v_billing_cycle, p."BillingCycle"),
    "IsActive" = CASE
      WHEN p_payload ? 'IsActive' THEN (p_payload ->> 'IsActive')::boolean
      ELSE p."IsActive"
    END,
    "IsDeleted" = CASE
      WHEN p_payload ? 'IsDeleted' THEN (p_payload ->> 'IsDeleted')::boolean
      ELSE p."IsDeleted"
    END,
    "LastModified" = now(),
    "LastModifiedBy" = v_modified_by,
    "MaxPublishedProperties" = CASE
      WHEN p_payload ? 'MaxPublishedProperties' OR p_payload ? 'ListingLimit' OR p_payload ? 'MaxProperties'
        THEN v_max_published
      ELSE p."MaxPublishedProperties"
    END,
    "CommissionPercentage" = CASE
      WHEN p_payload ? 'CommissionPercentage' THEN (p_payload ->> 'CommissionPercentage')::numeric
      ELSE p."CommissionPercentage"
    END,
    "CommissionMinimumAmount" = CASE
      WHEN p_payload ? 'CommissionMinimumAmount' THEN (p_payload ->> 'CommissionMinimumAmount')::numeric
      ELSE p."CommissionMinimumAmount"
    END,
    "ExtraPropertiesPrice11to30" = CASE
      WHEN p_payload ? 'ExtraPropertiesPrice11to30' THEN (p_payload ->> 'ExtraPropertiesPrice11to30')::numeric
      ELSE p."ExtraPropertiesPrice11to30"
    END,
    "ExtraPropertiesPrice31Plus" = CASE
      WHEN p_payload ? 'ExtraPropertiesPrice31Plus' THEN (p_payload ->> 'ExtraPropertiesPrice31Plus')::numeric
      ELSE p."ExtraPropertiesPrice31Plus"
    END,
    "BookingReceiptMinimumAmount" = CASE
      WHEN p_payload ? 'BookingReceiptMinimumAmount' THEN (p_payload ->> 'BookingReceiptMinimumAmount')::numeric
      ELSE p."BookingReceiptMinimumAmount"
    END,
    "PropertyType" = CASE
      WHEN p_payload ? 'PropertyType' THEN v_property_type
      ELSE p."PropertyType"
    END,
    "PricingModel" = coalesce(v_pricing_model, p."PricingModel"),
    "Price" = CASE WHEN p_payload ? 'Price' THEN v_price ELSE p."Price" END,
    "MinMonthlyFee" = CASE
      WHEN p_payload ? 'MinMonthlyFee' THEN (p_payload ->> 'MinMonthlyFee')::numeric
      ELSE p."MinMonthlyFee"
    END,
    "PricePerBooking" = CASE
      WHEN p_payload ? 'PricePerBooking' THEN (p_payload ->> 'PricePerBooking')::numeric
      ELSE p."PricePerBooking"
    END,
    "ListingLimit" = CASE
      WHEN p_payload ? 'ListingLimit' OR p_payload ? 'MaxPublishedProperties' OR p_payload ? 'MaxProperties'
        THEN coalesce(v_listing_limit, v_max_published)
      ELSE p."ListingLimit"
    END,
    "DurationDays" = coalesce(v_duration_days, p."DurationDays"),
    "IsActiveV2" = CASE
      WHEN p_payload ? 'IsActiveV2' THEN (p_payload ->> 'IsActiveV2')::boolean
      ELSE p."IsActiveV2"
    END,
    "BookingLimit" = CASE
      WHEN p_payload ? 'BookingLimit' THEN (p_payload ->> 'BookingLimit')::integer
      ELSE p."BookingLimit"
    END,
    "Audience" = coalesce(v_audience, p."Audience")
  WHERE p."Id" = v_id;

  RETURN v_id;
END;
$$;
