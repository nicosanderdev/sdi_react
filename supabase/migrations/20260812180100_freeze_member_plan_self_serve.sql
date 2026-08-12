-- Freeze member self-serve plan assignment changes.
-- Members may still SELECT their own assignments; only platform admins may mutate member subjects.
-- Company subjects remain manageable by company managers (refined in later company-billing work).
-- Service role still used by trusted backend jobs; payments webhook rejects member plan activation.

DROP POLICY IF EXISTS "BillingPlanAssignments_subject_insert" ON public."BillingPlanAssignments";
DROP POLICY IF EXISTS "BillingPlanAssignments_subject_update" ON public."BillingPlanAssignments";
DROP POLICY IF EXISTS "BillingPlanAssignments_subject_delete" ON public."BillingPlanAssignments";

CREATE POLICY "BillingPlanAssignments_company_subject_insert"
  ON public."BillingPlanAssignments"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    "SubjectType" = 'company'
    AND public.is_company_manager("MemberOrCompanyId")
  );

CREATE POLICY "BillingPlanAssignments_company_subject_update"
  ON public."BillingPlanAssignments"
  FOR UPDATE
  TO authenticated
  USING (
    "SubjectType" = 'company'
    AND public.is_company_manager("MemberOrCompanyId")
  )
  WITH CHECK (
    "SubjectType" = 'company'
    AND public.is_company_manager("MemberOrCompanyId")
  );

CREATE POLICY "BillingPlanAssignments_company_subject_delete"
  ON public."BillingPlanAssignments"
  FOR DELETE
  TO authenticated
  USING (
    "SubjectType" = 'company'
    AND public.is_company_manager("MemberOrCompanyId")
  );
