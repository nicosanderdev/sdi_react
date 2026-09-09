-- Auto-assign Plan BASE-Inicial (company subject) when a company is created.
-- Also allow the company creator to insert themselves as the first Admin.

CREATE OR REPLACE FUNCTION public.assign_company_base_inicial_plan(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_id uuid;
  v_now timestamptz := now();
BEGIN
  IF p_company_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."BillingPlanAssignments" bpa
    WHERE bpa."SubjectType" = 'company'
      AND bpa."MemberOrCompanyId" = p_company_id
      AND bpa."IsActive" = true
  ) THEN
    RETURN;
  END IF;

  SELECT p."Id"
    INTO v_plan_id
  FROM public."Plans" p
  WHERE p."Name" = 'Plan BASE-Inicial'
    AND p."IsDeleted" = false
    AND coalesce(p."IsActiveV2", p."IsActive", true) = true
  ORDER BY p."Key"
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Default company plan "Plan BASE-Inicial" not found or inactive';
  END IF;

  INSERT INTO public."BillingPlanAssignments" (
    "SubjectType",
    "MemberOrCompanyId",
    "PlanId",
    "StartDate",
    "IsActive",
    "Created",
    "LastModified"
  ) VALUES (
    'company',
    p_company_id,
    v_plan_id,
    v_now,
    true,
    v_now,
    v_now
  );
END;
$$;

COMMENT ON FUNCTION public.assign_company_base_inicial_plan(uuid) IS
  'Assigns active company-subject Plan BASE-Inicial when the company has no active plan.';

CREATE OR REPLACE FUNCTION public.trg_companies_assign_base_inicial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.assign_company_base_inicial_plan(NEW."Id");
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_assign_base_inicial ON public."Companies";
CREATE TRIGGER companies_assign_base_inicial
  AFTER INSERT ON public."Companies"
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_companies_assign_base_inicial();

-- Allow the billing-contact creator to become the first company Admin
-- (existing policy only allowed platform admin / existing managers).
DROP POLICY IF EXISTS company_members_insert_policy ON public."CompanyMembers";

CREATE POLICY company_members_insert_policy
  ON public."CompanyMembers"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_company_manager("CompanyId")
    OR (
      "Role" IN ('Admin')
      AND "MemberId" = public.current_member_id()
      AND EXISTS (
        SELECT 1
        FROM public."Companies" c
        WHERE c."Id" = "CompanyId"
          AND c."IsDeleted" = false
          AND c."BillingContactUserId" = auth.uid()
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public."CompanyMembers" cm
        WHERE cm."CompanyId" = "CompanyId"
          AND cm."IsDeleted" = false
      )
    )
  );
