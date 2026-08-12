-- Company membership: Admin-only management, MaxUsers, last-Admin protection.
-- Also tighten company BillingPlanAssignments mutations to company Admin (+ platform admin policies remain).

CREATE OR REPLACE FUNCTION public.is_company_admin(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."CompanyMembers" cm
    JOIN public."Members" m
      ON m."Id" = cm."MemberId"
     AND m."IsDeleted" = false
    WHERE cm."CompanyId" = _company_id
      AND cm."IsDeleted" = false
      AND cm."Role" IN ('Admin')
      AND m."UserId" = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_company_admin(uuid) IS
  'True when the current auth user is an active company Admin for the company.';

CREATE OR REPLACE FUNCTION public.count_active_company_admins(p_company_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::integer
  FROM public."CompanyMembers" cm
  WHERE cm."CompanyId" = p_company_id
    AND cm."IsDeleted" = false
    AND cm."Role" IN ('Admin');
$$;

CREATE OR REPLACE FUNCTION public.assert_company_membership_capacity(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max_users integer;
  v_current integer;
BEGIN
  SELECT p."MaxUsers"
    INTO v_max_users
  FROM public."BillingPlanAssignments" bpa
  JOIN public."Plans" p
    ON p."Id" = bpa."PlanId"
   AND coalesce(p."IsActiveV2", p."IsActive", true) = true
   AND p."IsDeleted" = false
  WHERE bpa."SubjectType" = 'company'
    AND bpa."MemberOrCompanyId" = p_company_id
    AND bpa."IsActive" = true
    AND bpa."StartDate" <= now()
    AND (bpa."EndDate" IS NULL OR bpa."EndDate" >= now())
  ORDER BY bpa."StartDate" DESC
  LIMIT 1;

  IF v_max_users IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::integer
    INTO v_current
  FROM public."CompanyMembers" cm
  WHERE cm."CompanyId" = p_company_id
    AND cm."IsDeleted" = false;

  IF v_current >= v_max_users THEN
    RAISE EXCEPTION 'Company user limit exceeded. Plan allows maximum % users.', v_max_users;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_company_members_enforce_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_was_admin boolean;
  v_is_admin boolean;
  v_admin_count integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."IsDeleted" = false THEN
      PERFORM public.assert_company_membership_capacity(NEW."CompanyId");
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_was_admin := OLD."IsDeleted" = false AND OLD."Role" IN ('Admin');
    v_is_admin := NEW."IsDeleted" = false AND NEW."Role" IN ('Admin');

    -- Soft-delete or demote of an Admin: protect last Admin
    IF v_was_admin AND NOT v_is_admin THEN
      v_admin_count := public.count_active_company_admins(OLD."CompanyId");
      IF v_admin_count <= 1 THEN
        RAISE EXCEPTION 'Cannot remove or demote the last company Admin.';
      END IF;
    END IF;

    -- Reactivating / adding a non-deleted row that was deleted increases headcount
    IF OLD."IsDeleted" = true AND NEW."IsDeleted" = false THEN
      PERFORM public.assert_company_membership_capacity(NEW."CompanyId");
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD."IsDeleted" = false AND OLD."Role" IN ('Admin') THEN
      v_admin_count := public.count_active_company_admins(OLD."CompanyId");
      IF v_admin_count <= 1 THEN
        RAISE EXCEPTION 'Cannot remove or demote the last company Admin.';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS company_members_enforce_rules ON public."CompanyMembers";
CREATE TRIGGER company_members_enforce_rules
  BEFORE INSERT OR UPDATE OR DELETE ON public."CompanyMembers"
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_company_members_enforce_rules();

-- Membership mutations: company Admin (or platform admin), not Manager.
DROP POLICY IF EXISTS company_members_insert_policy ON public."CompanyMembers";
CREATE POLICY company_members_insert_policy
  ON public."CompanyMembers"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_company_admin("CompanyId")
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

DROP POLICY IF EXISTS company_members_update_policy ON public."CompanyMembers";
CREATE POLICY company_members_update_policy
  ON public."CompanyMembers"
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_company_admin("CompanyId"))
  WITH CHECK (public.is_admin() OR public.is_company_admin("CompanyId"));

DROP POLICY IF EXISTS "CompanyMembers_delete_policy" ON public."CompanyMembers";
CREATE POLICY "CompanyMembers_delete_policy"
  ON public."CompanyMembers"
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.is_company_admin("CompanyId"));

-- Company plan assignment mutations: company Admin only (Managers cannot).
DROP POLICY IF EXISTS "BillingPlanAssignments_company_subject_insert" ON public."BillingPlanAssignments";
DROP POLICY IF EXISTS "BillingPlanAssignments_company_subject_update" ON public."BillingPlanAssignments";
DROP POLICY IF EXISTS "BillingPlanAssignments_company_subject_delete" ON public."BillingPlanAssignments";

CREATE POLICY "BillingPlanAssignments_company_subject_insert"
  ON public."BillingPlanAssignments"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    "SubjectType" = 'company'
    AND public.is_company_admin("MemberOrCompanyId")
  );

CREATE POLICY "BillingPlanAssignments_company_subject_update"
  ON public."BillingPlanAssignments"
  FOR UPDATE
  TO authenticated
  USING (
    "SubjectType" = 'company'
    AND public.is_company_admin("MemberOrCompanyId")
  )
  WITH CHECK (
    "SubjectType" = 'company'
    AND public.is_company_admin("MemberOrCompanyId")
  );

CREATE POLICY "BillingPlanAssignments_company_subject_delete"
  ON public."BillingPlanAssignments"
  FOR DELETE
  TO authenticated
  USING (
    "SubjectType" = 'company'
    AND public.is_company_admin("MemberOrCompanyId")
  );
