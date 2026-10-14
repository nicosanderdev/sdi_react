-- Company creation and company plan changes are limited to platform administrators.
-- Checkout fulfillment (finalize_plan_checkout) is unchanged.

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

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador de la aplicación puede crear una empresa.';
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

  IF v_plan."Audience" IS DISTINCT FROM 'company' THEN
    RAISE EXCEPTION 'Plan is not available for this entity type.';
  END IF;

  IF NOT public.is_admin() THEN
    IF coalesce(v_plan."IsActiveV2", v_plan."IsActive", true) = false
       OR upper(trim(coalesce(v_plan."Currency", ''))) IS DISTINCT FROM 'UYU' THEN
      RAISE EXCEPTION 'Plan is not available for this entity type.';
    END IF;
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
  'Platform admin only: create a company, admin membership, and assign the chosen company plan.';

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

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador de la aplicación puede cambiar el plan.';
  END IF;

  SELECT *
    INTO v_plan
  FROM public."Plans" p
  WHERE p."Id" = p_plan_id
    AND p."IsDeleted" = false;

  IF v_plan."Id" IS NULL
     OR v_plan."Audience" IS DISTINCT FROM 'company' THEN
    RAISE EXCEPTION 'Plan is not available for this entity type.';
  END IF;

  IF NOT public.is_admin() THEN
    IF coalesce(v_plan."IsActiveV2", v_plan."IsActive", true) = false
       OR upper(trim(coalesce(v_plan."Currency", ''))) IS DISTINCT FROM 'UYU' THEN
      RAISE EXCEPTION 'Plan is not available for this entity type.';
    END IF;
  END IF;

  v_amount := coalesce(v_plan."MonthlyPrice", v_plan."Price", 0);
  IF v_amount > 0 AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'PLAN_PAYMENT_REQUIRED';
  END IF;

  PERFORM public.assign_permanent_billing_plan('company', p_company_id, p_plan_id);
END;
$$;

COMMENT ON FUNCTION public.change_company_plan_for_current_admin(uuid, uuid) IS
  'Platform admin only: assign a company plan without checkout.';

CREATE OR REPLACE FUNCTION public.cancel_company_plan_for_current_admin(p_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current public."BillingPlanAssignments"%ROWTYPE;
  v_current_plan public."Plans"%ROWTYPE;
  v_landing public."Plans"%ROWTYPE;
  v_current_price numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company is required.';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador de la aplicación puede cambiar el plan.';
  END IF;

  SELECT *
    INTO v_current
  FROM public."BillingPlanAssignments" a
  WHERE a."SubjectType" = 'company'
    AND a."MemberOrCompanyId" = p_company_id
    AND a."IsActive" = true
  ORDER BY a."StartDate" DESC
  LIMIT 1;

  IF v_current."Id" IS NULL THEN
    RAISE EXCEPTION 'No hay un plan de empresa activo para cancelar.';
  END IF;

  SELECT *
    INTO v_current_plan
  FROM public."Plans" p
  WHERE p."Id" = v_current."PlanId";

  v_current_price := coalesce(v_current_plan."MonthlyPrice", v_current_plan."Price", 0);
  IF v_current_price <= 0 THEN
    RAISE EXCEPTION 'El plan actual ya es gratuito.';
  END IF;

  SELECT *
    INTO v_landing
  FROM public."Plans" p
  WHERE p."Audience" = 'company'
    AND p."IsDeleted" = false
    AND coalesce(p."IsActiveV2", p."IsActive", true) = true
    AND coalesce(p."MonthlyPrice", p."Price", 0) = 0
  ORDER BY
    CASE WHEN p."Id" = '66666666-6666-4666-8666-666666666666'::uuid THEN 0 ELSE 1 END,
    coalesce(p."MaxProperties", 2147483647),
    p."Name"
  LIMIT 1;

  IF v_landing."Id" IS NULL THEN
    RAISE EXCEPTION 'No hay un plan gratuito de empresa activo para asignar.';
  END IF;

  RETURN public.assign_permanent_billing_plan('company', p_company_id, v_landing."Id");
END;
$$;

COMMENT ON FUNCTION public.cancel_company_plan_for_current_admin(uuid) IS
  'Platform admin only: deactivate the paid company plan immediately and assign the cheapest active $0 company plan. Does not refund Mercado Pago.';
