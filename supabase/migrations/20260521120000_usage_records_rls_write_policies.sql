-- Idempotent patch: UsageRecords INSERT/UPDATE for authenticated users.
-- Plans SELECT for any authenticated user.
-- Apply manually if 20260520120002_billing_rls_policies.sql was already applied without write policies.

begin;

-- -----------------------------------------------------------------------------
-- Helpers (safe CREATE OR REPLACE)
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

-- -----------------------------------------------------------------------------
-- UsageRecords write policies
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Plans: catalog read for any authenticated user
-- -----------------------------------------------------------------------------
alter table public."Plans" enable row level security;

drop policy if exists "Plans_authenticated_select" on public."Plans";
create policy "Plans_authenticated_select"
  on public."Plans"
  for select
  to authenticated
  using (true);

drop policy if exists "Plans_service_all" on public."Plans";
create policy "Plans_service_all"
  on public."Plans"
  for all
  to service_role
  using (true)
  with check (true);

commit;
