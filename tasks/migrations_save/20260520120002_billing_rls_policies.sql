-- Optional RLS for polymorphic billing tables. Apply if RLS is enabled on these tables.
-- Adjust roles to match your project; service_role bypasses RLS.

begin;

-- -----------------------------------------------------------------------------
-- Helpers for UsageRecords write policies
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and lower(coalesce(m."Role", '')) = 'admin'
  );
$$;

create or replace function public.is_company_manager(_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."CompanyMembers" cm
    join public."Members" m
      on m."Id" = cm."MemberId"
     and m."IsDeleted" = false
    where cm."CompanyId" = _company_id
      and cm."IsDeleted" = false
      and cm."Role" in ('Admin', 'Manager')
      and m."UserId" = auth.uid()
  );
$$;

create or replace function public.user_can_manage_billing_subject(
  p_subject_type text,
  p_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or (
      p_subject_type = 'member'
      and p_subject_id in (
        select m."Id"
        from public."Members" m
        where m."UserId" = auth.uid()
          and m."IsDeleted" = false
      )
    )
    or (
      p_subject_type = 'company'
      and public.is_company_manager(p_subject_id)
    );
$$;

create or replace function public.usage_reference_matches_billing_subject(
  p_subject_type text,
  p_subject_id uuid,
  p_type text,
  p_reference_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_type = 'booking' then exists (
      select 1
      from public."Bookings" b
      join public."EstateProperties" ep
        on ep."Id" = b."EstatePropertyId"
       and ep."IsDeleted" = false
      join public."Owners" o
        on o."Id" = ep."OwnerId"
       and o."IsDeleted" = false
      where b."Id"::text = p_reference_id
        and b."IsDeleted" = false
        and (
          (p_subject_type = 'member' and o."OwnerType" = 'member' and o."MemberId" = p_subject_id)
          or (p_subject_type = 'company' and o."OwnerType" = 'company' and o."CompanyId" = p_subject_id)
        )
    )
    when p_type = 'listing' then exists (
      select 1
      from public."Listings" l
      join public."EstateProperties" ep
        on ep."Id" = l."EstatePropertyId"
       and ep."IsDeleted" = false
      join public."Owners" o
        on o."Id" = ep."OwnerId"
       and o."IsDeleted" = false
      where l."Id"::text = p_reference_id
        and l."IsDeleted" = false
        and (
          (p_subject_type = 'member' and o."OwnerType" = 'member' and o."MemberId" = p_subject_id)
          or (p_subject_type = 'company' and o."OwnerType" = 'company' and o."CompanyId" = p_subject_id)
        )
    )
    else false
  end;
$$;

alter table public."BillingPlanAssignments" enable row level security;
alter table public."UsageRecords" enable row level security;
alter table public."BillingCycles" enable row level security;
alter table public."Invoices" enable row level security;

-- BillingPlanAssignments: member owns their row; company members can read company row
drop policy if exists "BillingPlanAssignments_member_select" on public."BillingPlanAssignments";
create policy "BillingPlanAssignments_member_select"
  on public."BillingPlanAssignments"
  for select
  to authenticated
  using (
    ("SubjectType" = 'member' and "MemberOrCompanyId" in (
      select m."Id" from public."Members" m
      where m."UserId" = auth.uid() and m."IsDeleted" = false
    ))
    or (
      "SubjectType" = 'company' and "MemberOrCompanyId" in (
        select cm."CompanyId" from public."CompanyMembers" cm
        join public."Members" m on m."Id" = cm."MemberId" and m."IsDeleted" = false
        where m."UserId" = auth.uid() and cm."IsDeleted" = false
      )
    )
  );

drop policy if exists "BillingPlanAssignments_service_all" on public."BillingPlanAssignments";
create policy "BillingPlanAssignments_service_all"
  on public."BillingPlanAssignments"
  for all
  to service_role
  using (true)
  with check (true);

-- UsageRecords / BillingCycles / Invoices: same subject access pattern
drop policy if exists "UsageRecords_subject_select" on public."UsageRecords";
create policy "UsageRecords_subject_select"
  on public."UsageRecords"
  for select
  to authenticated
  using (
    ("SubjectType" = 'member' and "MemberOrCompanyId" in (
      select m."Id" from public."Members" m
      where m."UserId" = auth.uid() and m."IsDeleted" = false
    ))
    or (
      "SubjectType" = 'company' and "MemberOrCompanyId" in (
        select cm."CompanyId" from public."CompanyMembers" cm
        join public."Members" m on m."Id" = cm."MemberId" and m."IsDeleted" = false
        where m."UserId" = auth.uid() and cm."IsDeleted" = false
      )
    )
  );

drop policy if exists "UsageRecords_subject_insert" on public."UsageRecords";
create policy "UsageRecords_subject_insert"
  on public."UsageRecords"
  for insert
  to authenticated
  with check (
    "InvoiceId" is null
    and (
      public.is_admin()
      or (
        public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId")
        and public.usage_reference_matches_billing_subject(
          "SubjectType",
          "MemberOrCompanyId",
          "Type",
          "ReferenceId"
        )
      )
    )
  );

drop policy if exists "UsageRecords_subject_update" on public."UsageRecords";
create policy "UsageRecords_subject_update"
  on public."UsageRecords"
  for update
  to authenticated
  using (
    "InvoiceId" is null
    and (
      public.is_admin()
      or (
        public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId")
        and public.usage_reference_matches_billing_subject(
          "SubjectType",
          "MemberOrCompanyId",
          "Type",
          "ReferenceId"
        )
      )
    )
  )
  with check (
    "InvoiceId" is null
    and (
      public.is_admin()
      or (
        public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId")
        and public.usage_reference_matches_billing_subject(
          "SubjectType",
          "MemberOrCompanyId",
          "Type",
          "ReferenceId"
        )
      )
    )
  );

drop policy if exists "UsageRecords_service_all" on public."UsageRecords";
create policy "UsageRecords_service_all"
  on public."UsageRecords"
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "BillingCycles_subject_select" on public."BillingCycles";
create policy "BillingCycles_subject_select"
  on public."BillingCycles"
  for select
  to authenticated
  using (
    ("SubjectType" = 'member' and "MemberOrCompanyId" in (
      select m."Id" from public."Members" m
      where m."UserId" = auth.uid() and m."IsDeleted" = false
    ))
    or (
      "SubjectType" = 'company' and "MemberOrCompanyId" in (
        select cm."CompanyId" from public."CompanyMembers" cm
        join public."Members" m on m."Id" = cm."MemberId" and m."IsDeleted" = false
        where m."UserId" = auth.uid() and cm."IsDeleted" = false
      )
    )
  );

drop policy if exists "BillingCycles_service_all" on public."BillingCycles";
create policy "BillingCycles_service_all"
  on public."BillingCycles"
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Invoices_subject_select" on public."Invoices";
create policy "Invoices_subject_select"
  on public."Invoices"
  for select
  to authenticated
  using (
    ("SubjectType" = 'member' and "MemberOrCompanyId" in (
      select m."Id" from public."Members" m
      where m."UserId" = auth.uid() and m."IsDeleted" = false
    ))
    or (
      "SubjectType" = 'company' and "MemberOrCompanyId" in (
        select cm."CompanyId" from public."CompanyMembers" cm
        join public."Members" m on m."Id" = cm."MemberId" and m."IsDeleted" = false
        where m."UserId" = auth.uid() and cm."IsDeleted" = false
      )
    )
  );

drop policy if exists "Invoices_service_all" on public."Invoices";
create policy "Invoices_service_all"
  on public."Invoices"
  for all
  to service_role
  using (true)
  with check (true);

commit;
