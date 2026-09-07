-- Active $0 company landing plan + RPC to cancel a paid company assignment onto it.

INSERT INTO public."Plans" (
  "Id", "Key", "Name", "MonthlyPrice", "Currency",
  "MaxProperties", "MaxPublishedProperties", "MaxUsers", "MaxStorageMb",
  "BillingCycle", "IsActive", "IsDeleted", "Created", "LastModified",
  "PricingModel", "Price", "DurationDays", "IsActiveV2", "Audience"
)
VALUES (
  '66666666-6666-4666-8666-666666666666'::uuid,
  5,
  'Plan gratuito compañía',
  0,
  'UYU',
  5, 3, 3, 100,
  30, true, false, now(), now(),
  'per_listing', 0, 30, true, 'company'
)
ON CONFLICT ("Id") DO UPDATE SET
  "Key" = excluded."Key",
  "Name" = excluded."Name",
  "MonthlyPrice" = excluded."MonthlyPrice",
  "Price" = excluded."Price",
  "Currency" = excluded."Currency",
  "Audience" = excluded."Audience",
  "IsActive" = excluded."IsActive",
  "IsActiveV2" = excluded."IsActiveV2",
  "IsDeleted" = excluded."IsDeleted",
  "MaxProperties" = excluded."MaxProperties",
  "MaxPublishedProperties" = excluded."MaxPublishedProperties",
  "MaxUsers" = excluded."MaxUsers",
  "MaxStorageMb" = excluded."MaxStorageMb",
  "LastModified" = now();

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

  IF NOT public.is_admin() AND NOT public.is_company_admin(p_company_id) THEN
    RAISE EXCEPTION 'Solo los administradores de la empresa pueden cancelar el plan.';
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
  'Company Admin or platform admin: deactivate the paid company plan immediately and assign the cheapest active $0 company plan. Does not refund Mercado Pago.';

REVOKE ALL ON FUNCTION public.cancel_company_plan_for_current_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_company_plan_for_current_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_company_plan_for_current_admin(uuid) TO service_role;
