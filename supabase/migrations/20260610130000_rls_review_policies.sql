-- RLS policies for tables reviewed in tasks/rls-review-progress.txt.
-- Apply manually. Idempotent: enables RLS and creates only policies that do not already exist.
-- Does not modify, replace, or delete any existing policy.
-- Prerequisite: public.is_admin(), public.is_company_manager(), public.user_can_manage_billing_subject().

begin;

-- -----------------------------------------------------------------------------
-- Helper functions (CREATE OR REPLACE — safe to re-run; not RLS policies)
-- -----------------------------------------------------------------------------

create or replace function public.is_property_owner(p_user_id uuid, p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."EstateProperties" ep
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    where ep."Id" = p_property_id
      and ep."IsDeleted" = false
      and (
        (
          o."OwnerType" = 'member'
          and exists (
            select 1
            from public."Members" m
            where m."Id" = o."MemberId"
              and m."UserId" = p_user_id
              and m."IsDeleted" = false
          )
        )
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            join public."Members" m
              on m."Id" = cm."MemberId"
             and m."IsDeleted" = false
            where cm."CompanyId" = o."CompanyId"
              and cm."IsDeleted" = false
              and cm."Role" in ('Admin', 'Manager')
              and m."UserId" = p_user_id
          )
        )
      )
  );
$$;

comment on function public.is_property_owner(uuid, uuid) is
  'True when p_user_id (auth.users id) owns or manages the estate property via Owners / CompanyMembers.';

create or replace function public.user_can_manage_estate_property(p_estate_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_property_owner(auth.uid(), p_estate_property_id);
$$;

comment on function public.user_can_manage_estate_property(uuid) is
  'True when the current auth user owns or manages the estate property (member owner or company Admin/Manager).';

create or replace function public.user_owns_owner_record(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."Owners" o
    join public."Members" m
      on m."UserId" = auth.uid()
     and m."IsDeleted" = false
    where o."Id" = p_owner_id
      and o."IsDeleted" = false
      and (
        (o."OwnerType" = 'member' and o."MemberId" = m."Id")
        or (
          o."OwnerType" = 'company'
          and public.is_company_manager(o."CompanyId")
        )
      )
  );
$$;

comment on function public.user_owns_owner_record(uuid) is
  'True when the current auth user is the member owner or a company Admin/Manager for the Owners row.';

grant execute on function public.is_property_owner(uuid, uuid) to authenticated, service_role;
grant execute on function public.user_can_manage_estate_property(uuid) to authenticated, service_role;
grant execute on function public.user_owns_owner_record(uuid) to authenticated, service_role;

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m."Id"
  from public."Members" m
  where m."UserId" = auth.uid()
    and m."IsDeleted" = false
  limit 1;
$$;

comment on function public.current_member_id() is
  'Members.Id for the current auth user (security definer; safe inside Members RLS policies).';

create or replace function public.user_is_record_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_member_id is not null
    and p_member_id = public.current_member_id();
$$;

create or replace function public.user_owns_auth_user_id(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null
    and p_user_id = auth.uid();
$$;

comment on function public.user_owns_auth_user_id(uuid) is
  'True when p_user_id matches the current auth.users id.';

create or replace function public.user_can_manage_listing(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."Listings" l
    where l."Id" = p_listing_id
      and l."IsDeleted" = false
      and public.user_can_manage_estate_property(l."EstatePropertyId")
  );
$$;

create or replace function public.user_can_manage_calendar_integration(p_integration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."CalendarIntegrations" ci
    where ci."Id" = p_integration_id
      and ci."IsDeleted" = false
      and public.user_can_manage_estate_property(ci."EstatePropertyId")
  );
$$;

create or replace function public.user_can_read_owner_record(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."Owners" o
    where o."Id" = p_owner_id
      and o."IsDeleted" = false
      and (
        (
          o."OwnerType" = 'member'
          and o."MemberId" = public.current_member_id()
        )
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = public.current_member_id()
              and cm."IsDeleted" = false
          )
        )
      )
  );
$$;

create or replace function public.user_can_manage_property_section(p_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.propertydetailssection s
    where s.id = p_section_id
      and s.isdeleted = false
      and public.user_can_manage_estate_property(s.propertyid)
  );
$$;

create or replace function public.is_public_estate_property(p_estate_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."EstateProperties" ep
    where ep."Id" = p_estate_property_id
      and ep."IsDeleted" = false
  );
$$;

grant execute on function public.current_member_id() to authenticated, service_role;
grant execute on function public.user_is_record_member(uuid) to authenticated, service_role;
grant execute on function public.user_owns_auth_user_id(uuid) to authenticated, service_role;
grant execute on function public.user_can_manage_listing(uuid) to authenticated, service_role;
grant execute on function public.user_can_manage_calendar_integration(uuid) to authenticated, service_role;
grant execute on function public.user_can_read_owner_record(uuid) to authenticated, service_role;
grant execute on function public.user_can_manage_property_section(uuid) to authenticated, service_role;
grant execute on function public.is_public_estate_property(uuid) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Amenities — public: R | user: R | admin: RIXD
-- -----------------------------------------------------------------------------

alter table public."Amenities" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Amenities' and policyname = 'Amenities_anon_select'
  ) then
    execute $policy$
      create policy "Amenities_anon_select"
        on public."Amenities"
        for select
        to anon
        using ("IsDeleted" = false)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Amenities' and policyname = 'Amenities_authenticated_select'
  ) then
    execute $policy$
      create policy "Amenities_authenticated_select"
        on public."Amenities"
        for select
        to authenticated
        using ("IsDeleted" = false)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Amenities' and policyname = 'Amenities_admin_all'
  ) then
    execute $policy$
      create policy "Amenities_admin_all"
        on public."Amenities"
        for all
        to authenticated
        using (public.is_admin())
        with check (public.is_admin())
    $policy$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- AppParameters — public: none | user: none | admin: RIXD
-- Existing: AppParameters_select_authenticated, AppParameters_all_admin — not modified.
-- -----------------------------------------------------------------------------

alter table public."AppParameters" enable row level security;

-- No new policies: admin RIXD covered by "AppParameters_all_admin" when present.

-- -----------------------------------------------------------------------------
-- AuthEmailChangeRequests — public: none | user: RIXD* | admin: RIXD
-- * user when record."UserId" = auth.uid()
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public."AuthEmailChangeRequests"') is null then
    raise notice 'Skipping AuthEmailChangeRequests RLS: table does not exist.';
    return;
  end if;

  execute 'alter table public."AuthEmailChangeRequests" enable row level security';

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'AuthEmailChangeRequests'
      and policyname = 'AuthEmailChangeRequests_user_all'
  ) then
    execute $policy$
      create policy "AuthEmailChangeRequests_user_all"
        on public."AuthEmailChangeRequests"
        for all
        to authenticated
        using ("UserId" = auth.uid())
        with check ("UserId" = auth.uid())
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'AuthEmailChangeRequests'
      and policyname = 'AuthEmailChangeRequests_admin_all'
  ) then
    execute $policy$
      create policy "AuthEmailChangeRequests_admin_all"
        on public."AuthEmailChangeRequests"
        for all
        to authenticated
        using (public.is_admin())
        with check (public.is_admin())
    $policy$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- AvailabilityBlocks — public: R | user: RIXD* | admin: RIXD
-- * property owner or company Admin/Manager linked through Owners
-- -----------------------------------------------------------------------------

alter table public."AvailabilityBlocks" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'AvailabilityBlocks'
      and policyname = 'AvailabilityBlocks_anon_select'
  ) then
    execute $policy$
      create policy "AvailabilityBlocks_anon_select"
        on public."AvailabilityBlocks"
        for select
        to anon
        using ("IsDeleted" = false)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'AvailabilityBlocks'
      and policyname = 'AvailabilityBlocks_user_select'
  ) then
    execute $policy$
      create policy "AvailabilityBlocks_user_select"
        on public."AvailabilityBlocks"
        for select
        to authenticated
        using (
          "IsDeleted" = false
          and public.user_can_manage_estate_property("EstatePropertyId")
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'AvailabilityBlocks'
      and policyname = 'AvailabilityBlocks_user_insert'
  ) then
    execute $policy$
      create policy "AvailabilityBlocks_user_insert"
        on public."AvailabilityBlocks"
        for insert
        to authenticated
        with check (public.user_can_manage_estate_property("EstatePropertyId"))
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'AvailabilityBlocks'
      and policyname = 'AvailabilityBlocks_user_update'
  ) then
    execute $policy$
      create policy "AvailabilityBlocks_user_update"
        on public."AvailabilityBlocks"
        for update
        to authenticated
        using (public.user_can_manage_estate_property("EstatePropertyId"))
        with check (public.user_can_manage_estate_property("EstatePropertyId"))
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'AvailabilityBlocks'
      and policyname = 'AvailabilityBlocks_user_delete'
  ) then
    execute $policy$
      create policy "AvailabilityBlocks_user_delete"
        on public."AvailabilityBlocks"
        for delete
        to authenticated
        using (public.user_can_manage_estate_property("EstatePropertyId"))
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'AvailabilityBlocks'
      and policyname = 'AvailabilityBlocks_admin_all'
  ) then
    execute $policy$
      create policy "AvailabilityBlocks_admin_all"
        on public."AvailabilityBlocks"
        for all
        to authenticated
        using (public.is_admin())
        with check (public.is_admin())
    $policy$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- BillingCycles — public: none | user: RIXD* | admin: RIXD
-- * billing subject member or company member (via SubjectType / MemberOrCompanyId)
-- Existing: BillingCycles_subject_select, BillingCycles_service_all — not modified.
-- -----------------------------------------------------------------------------

alter table public."BillingCycles" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'BillingCycles'
      and policyname = 'BillingCycles_subject_insert'
  ) then
    execute $policy$
      create policy "BillingCycles_subject_insert"
        on public."BillingCycles"
        for insert
        to authenticated
        with check (
          public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId")
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'BillingCycles'
      and policyname = 'BillingCycles_subject_update'
  ) then
    execute $policy$
      create policy "BillingCycles_subject_update"
        on public."BillingCycles"
        for update
        to authenticated
        using (
          public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId")
        )
        with check (
          public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId")
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'BillingCycles'
      and policyname = 'BillingCycles_subject_delete'
  ) then
    execute $policy$
      create policy "BillingCycles_subject_delete"
        on public."BillingCycles"
        for delete
        to authenticated
        using (
          public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId")
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'BillingCycles'
      and policyname = 'BillingCycles_admin_insert'
  ) then
    execute $policy$
      create policy "BillingCycles_admin_insert"
        on public."BillingCycles"
        for insert
        to authenticated
        with check (public.is_admin())
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'BillingCycles'
      and policyname = 'BillingCycles_admin_update'
  ) then
    execute $policy$
      create policy "BillingCycles_admin_update"
        on public."BillingCycles"
        for update
        to authenticated
        using (public.is_admin())
        with check (public.is_admin())
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'BillingCycles'
      and policyname = 'BillingCycles_admin_delete'
  ) then
    execute $policy$
      create policy "BillingCycles_admin_delete"
        on public."BillingCycles"
        for delete
        to authenticated
        using (public.is_admin())
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'BillingCycles'
      and policyname = 'BillingCycles_admin_select'
  ) then
    execute $policy$
      create policy "BillingCycles_admin_select"
        on public."BillingCycles"
        for select
        to authenticated
        using (public.is_admin())
    $policy$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- BillingPlanAssignments — public: none | user: RIXD* | admin: RIXD
-- Existing: BillingPlanAssignments_member_select, BillingPlanAssignments_admin_select,
--           BillingPlanAssignments_service_all — not modified.
-- -----------------------------------------------------------------------------

alter table public."BillingPlanAssignments" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'BillingPlanAssignments'
      and policyname = 'BillingPlanAssignments_subject_insert'
  ) then
    execute $policy$
      create policy "BillingPlanAssignments_subject_insert"
        on public."BillingPlanAssignments"
        for insert
        to authenticated
        with check (
          public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId")
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'BillingPlanAssignments'
      and policyname = 'BillingPlanAssignments_subject_update'
  ) then
    execute $policy$
      create policy "BillingPlanAssignments_subject_update"
        on public."BillingPlanAssignments"
        for update
        to authenticated
        using (
          public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId")
        )
        with check (
          public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId")
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'BillingPlanAssignments'
      and policyname = 'BillingPlanAssignments_subject_delete'
  ) then
    execute $policy$
      create policy "BillingPlanAssignments_subject_delete"
        on public."BillingPlanAssignments"
        for delete
        to authenticated
        using (
          public.user_can_manage_billing_subject("SubjectType", "MemberOrCompanyId")
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'BillingPlanAssignments'
      and policyname = 'BillingPlanAssignments_admin_insert'
  ) then
    execute $policy$
      create policy "BillingPlanAssignments_admin_insert"
        on public."BillingPlanAssignments"
        for insert
        to authenticated
        with check (public.is_admin())
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'BillingPlanAssignments'
      and policyname = 'BillingPlanAssignments_admin_update'
  ) then
    execute $policy$
      create policy "BillingPlanAssignments_admin_update"
        on public."BillingPlanAssignments"
        for update
        to authenticated
        using (public.is_admin())
        with check (public.is_admin())
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'BillingPlanAssignments'
      and policyname = 'BillingPlanAssignments_admin_delete'
  ) then
    execute $policy$
      create policy "BillingPlanAssignments_admin_delete"
        on public."BillingPlanAssignments"
        for delete
        to authenticated
        using (public.is_admin())
    $policy$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Bookings — public: RIX | user: RIXD* | admin: RIXD
-- * property owner or company Admin/Manager linked through Owners
-- -----------------------------------------------------------------------------

alter table public."Bookings" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Bookings'
      and policyname = 'Bookings_anon_select'
  ) then
    execute $policy$
      create policy "Bookings_anon_select"
        on public."Bookings"
        for select
        to anon
        using ("IsDeleted" = false)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Bookings'
      and policyname = 'Bookings_anon_insert'
  ) then
    execute $policy$
      create policy "Bookings_anon_insert"
        on public."Bookings"
        for insert
        to anon
        with check (true)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Bookings'
      and policyname = 'Bookings_anon_update'
  ) then
    execute $policy$
      create policy "Bookings_anon_update"
        on public."Bookings"
        for update
        to anon
        using ("IsDeleted" = false)
        with check ("IsDeleted" = false)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Bookings'
      and policyname = 'Bookings_user_select'
  ) then
    execute $policy$
      create policy "Bookings_user_select"
        on public."Bookings"
        for select
        to authenticated
        using (
          "IsDeleted" = false
          and public.user_can_manage_estate_property("EstatePropertyId")
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Bookings'
      and policyname = 'Bookings_user_insert'
  ) then
    execute $policy$
      create policy "Bookings_user_insert"
        on public."Bookings"
        for insert
        to authenticated
        with check (public.user_can_manage_estate_property("EstatePropertyId"))
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Bookings'
      and policyname = 'Bookings_user_update'
  ) then
    execute $policy$
      create policy "Bookings_user_update"
        on public."Bookings"
        for update
        to authenticated
        using (public.user_can_manage_estate_property("EstatePropertyId"))
        with check (public.user_can_manage_estate_property("EstatePropertyId"))
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Bookings'
      and policyname = 'Bookings_user_delete'
  ) then
    execute $policy$
      create policy "Bookings_user_delete"
        on public."Bookings"
        for delete
        to authenticated
        using (public.user_can_manage_estate_property("EstatePropertyId"))
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Bookings'
      and policyname = 'Bookings_admin_all'
  ) then
    execute $policy$
      create policy "Bookings_admin_all"
        on public."Bookings"
        for all
        to authenticated
        using (public.is_admin())
        with check (public.is_admin())
    $policy$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- CalendarIntegrations — public: none | user: RIXD | admin: RIXD
-- Scoped to estate properties the user owns or manages (EstatePropertyId).
-- -----------------------------------------------------------------------------

alter table public."CalendarIntegrations" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'CalendarIntegrations'
      and policyname = 'CalendarIntegrations_user_select'
  ) then
    execute $policy$
      create policy "CalendarIntegrations_user_select"
        on public."CalendarIntegrations"
        for select
        to authenticated
        using (
          "IsDeleted" = false
          and public.user_can_manage_estate_property("EstatePropertyId")
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'CalendarIntegrations'
      and policyname = 'CalendarIntegrations_user_insert'
  ) then
    execute $policy$
      create policy "CalendarIntegrations_user_insert"
        on public."CalendarIntegrations"
        for insert
        to authenticated
        with check (public.user_can_manage_estate_property("EstatePropertyId"))
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'CalendarIntegrations'
      and policyname = 'CalendarIntegrations_user_update'
  ) then
    execute $policy$
      create policy "CalendarIntegrations_user_update"
        on public."CalendarIntegrations"
        for update
        to authenticated
        using (public.user_can_manage_estate_property("EstatePropertyId"))
        with check (public.user_can_manage_estate_property("EstatePropertyId"))
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'CalendarIntegrations'
      and policyname = 'CalendarIntegrations_user_delete'
  ) then
    execute $policy$
      create policy "CalendarIntegrations_user_delete"
        on public."CalendarIntegrations"
        for delete
        to authenticated
        using (public.user_can_manage_estate_property("EstatePropertyId"))
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'CalendarIntegrations'
      and policyname = 'CalendarIntegrations_admin_all'
  ) then
    execute $policy$
      create policy "CalendarIntegrations_admin_all"
        on public."CalendarIntegrations"
        for all
        to authenticated
        using (public.is_admin())
        with check (public.is_admin())
    $policy$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Companies — public: R | user: R all, IXD* | admin: RIXD
-- Existing: companies_select_policy, companies_update_policy, companies_delete_policy
-- -----------------------------------------------------------------------------

alter table public."Companies" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Companies'
      and policyname = 'Companies_anon_select'
  ) then
    execute $policy$
      create policy "Companies_anon_select"
        on public."Companies"
        for select
        to anon
        using ("IsDeleted" = false)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Companies'
      and policyname = 'Companies_authenticated_select_all'
  ) then
    execute $policy$
      create policy "Companies_authenticated_select_all"
        on public."Companies"
        for select
        to authenticated
        using ("IsDeleted" = false)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Companies'
      and policyname = 'Companies_authenticated_insert'
  ) then
    execute $policy$
      create policy "Companies_authenticated_insert"
        on public."Companies"
        for insert
        to authenticated
        with check (auth.uid() is not null)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Companies'
      and policyname = 'Companies_admin_insert'
  ) then
    execute $policy$
      create policy "Companies_admin_insert"
        on public."Companies"
        for insert
        to authenticated
        with check (public.is_admin())
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Companies'
      and policyname = 'Companies_admin_select'
  ) then
    execute $policy$
      create policy "Companies_admin_select"
        on public."Companies"
        for select
        to authenticated
        using (public.is_admin())
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Companies'
      and policyname = 'Companies_admin_delete'
  ) then
    execute $policy$
      create policy "Companies_admin_delete"
        on public."Companies"
        for delete
        to authenticated
        using (public.is_admin())
    $policy$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- CompanyMembers — public: none | user: RIXD* | admin: RIXD
-- * same as Companies (Admin/Manager via CompanyMembers for writes)
-- Existing: company_members_select_policy, company_members_insert_policy,
--           company_members_update_policy — not modified.
-- -----------------------------------------------------------------------------

alter table public."CompanyMembers" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'CompanyMembers'
      and policyname = 'CompanyMembers_authenticated_select_all'
  ) then
    execute $policy$
      create policy "CompanyMembers_authenticated_select_all"
        on public."CompanyMembers"
        for select
        to authenticated
        using ("IsDeleted" = false)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'CompanyMembers'
      and policyname = 'CompanyMembers_delete_policy'
  ) then
    execute $policy$
      create policy "CompanyMembers_delete_policy"
        on public."CompanyMembers"
        for delete
        to authenticated
        using (
          public.is_admin()
          or public.is_company_manager("CompanyId")
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'CompanyMembers'
      and policyname = 'CompanyMembers_admin_select'
  ) then
    execute $policy$
      create policy "CompanyMembers_admin_select"
        on public."CompanyMembers"
        for select
        to authenticated
        using (public.is_admin())
    $policy$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- EstateProperties — public: R | user: RIXD* | admin: RIXD
-- * property owner or company Admin/Manager linked through Owners
-- -----------------------------------------------------------------------------

alter table public."EstateProperties" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'EstateProperties'
      and policyname = 'EstateProperties_anon_select'
  ) then
    execute $policy$
      create policy "EstateProperties_anon_select"
        on public."EstateProperties"
        for select
        to anon
        using ("IsDeleted" = false)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'EstateProperties'
      and policyname = 'EstateProperties_user_select'
  ) then
    execute $policy$
      create policy "EstateProperties_user_select"
        on public."EstateProperties"
        for select
        to authenticated
        using (
          "IsDeleted" = false
          and public.user_can_manage_estate_property("Id")
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'EstateProperties'
      and policyname = 'EstateProperties_user_insert'
  ) then
    execute $policy$
      create policy "EstateProperties_user_insert"
        on public."EstateProperties"
        for insert
        to authenticated
        with check (public.user_owns_owner_record("OwnerId"))
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'EstateProperties'
      and policyname = 'EstateProperties_user_update'
  ) then
    execute $policy$
      create policy "EstateProperties_user_update"
        on public."EstateProperties"
        for update
        to authenticated
        using (public.user_can_manage_estate_property("Id"))
        with check (public.user_can_manage_estate_property("Id"))
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'EstateProperties'
      and policyname = 'EstateProperties_user_delete'
  ) then
    execute $policy$
      create policy "EstateProperties_user_delete"
        on public."EstateProperties"
        for delete
        to authenticated
        using (public.user_can_manage_estate_property("Id"))
    $policy$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'EstateProperties'
      and policyname = 'EstateProperties_admin_all'
  ) then
    execute $policy$
      create policy "EstateProperties_admin_all"
        on public."EstateProperties"
        for all
        to authenticated
        using (public.is_admin())
        with check (public.is_admin())
    $policy$;
  end if;
end $$;

-- =============================================================================
-- Batch 2–5 (rls-review-progress.txt lines 69–310)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EstatePropertyAmenity — public: R | user: RIXD | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public."EstatePropertyAmenity"') is null then return; end if;
  execute 'alter table public."EstatePropertyAmenity" enable row level security';

  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'EstatePropertyAmenity' and policyname = 'EstatePropertyAmenity_anon_select') then
    execute $p$ create policy "EstatePropertyAmenity_anon_select" on public."EstatePropertyAmenity" for select to anon
      using (coalesce("DeletedAtUtc", 'infinity'::timestamptz) > now() and public.is_public_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'EstatePropertyAmenity' and policyname = 'EstatePropertyAmenity_user_select') then
    execute $p$ create policy "EstatePropertyAmenity_user_select" on public."EstatePropertyAmenity" for select to authenticated
      using (coalesce("DeletedAtUtc", 'infinity'::timestamptz) > now() and public.user_can_manage_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'EstatePropertyAmenity' and policyname = 'EstatePropertyAmenity_user_insert') then
    execute $p$ create policy "EstatePropertyAmenity_user_insert" on public."EstatePropertyAmenity" for insert to authenticated
      with check (public.user_can_manage_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'EstatePropertyAmenity' and policyname = 'EstatePropertyAmenity_user_update') then
    execute $p$ create policy "EstatePropertyAmenity_user_update" on public."EstatePropertyAmenity" for update to authenticated
      using (public.user_can_manage_estate_property("EstatePropertyId")) with check (public.user_can_manage_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'EstatePropertyAmenity' and policyname = 'EstatePropertyAmenity_user_delete') then
    execute $p$ create policy "EstatePropertyAmenity_user_delete" on public."EstatePropertyAmenity" for delete to authenticated
      using (public.user_can_manage_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'EstatePropertyAmenity' and policyname = 'EstatePropertyAmenity_admin_all') then
    execute $p$ create policy "EstatePropertyAmenity_admin_all" on public."EstatePropertyAmenity" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- EstatePropertyPolicy — public: R | user: RIXD | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public."EstatePropertyPolicy"') is null then return; end if;
  execute 'alter table public."EstatePropertyPolicy" enable row level security';
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'EstatePropertyPolicy' and policyname = 'EstatePropertyPolicy_anon_select') then
    execute $p$ create policy "EstatePropertyPolicy_anon_select" on public."EstatePropertyPolicy" for select to anon
      using ("IsDeleted" = false and public.is_public_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'EstatePropertyPolicy' and policyname = 'EstatePropertyPolicy_user_select') then
    execute $p$ create policy "EstatePropertyPolicy_user_select" on public."EstatePropertyPolicy" for select to authenticated
      using ("IsDeleted" = false and public.user_can_manage_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'EstatePropertyPolicy' and policyname = 'EstatePropertyPolicy_user_insert') then
    execute $p$ create policy "EstatePropertyPolicy_user_insert" on public."EstatePropertyPolicy" for insert to authenticated
      with check (public.user_can_manage_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'EstatePropertyPolicy' and policyname = 'EstatePropertyPolicy_user_update') then
    execute $p$ create policy "EstatePropertyPolicy_user_update" on public."EstatePropertyPolicy" for update to authenticated
      using (public.user_can_manage_estate_property("EstatePropertyId")) with check (public.user_can_manage_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'EstatePropertyPolicy' and policyname = 'EstatePropertyPolicy_user_delete') then
    execute $p$ create policy "EstatePropertyPolicy_user_delete" on public."EstatePropertyPolicy" for delete to authenticated
      using (public.user_can_manage_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'EstatePropertyPolicy' and policyname = 'EstatePropertyPolicy_admin_all') then
    execute $p$ create policy "EstatePropertyPolicy_admin_all" on public."EstatePropertyPolicy" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Property extensions (EventVenue, RealEstate, SummerRent) — public: R | user: RIXD* | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
declare
  v_table text;
begin
  foreach v_table in array array['EventVenueExtension', 'RealEstateExtension', 'SummerRentExtension']
  loop
    if to_regclass(format('public.%I', v_table)) is null then continue; end if;
    execute format('alter table public.%I enable row level security', v_table);

    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_anon_select') then
      execute format($p$ create policy %I on public.%I for select to anon
        using (public.is_public_estate_property("EstatePropertyId")) $p$, v_table || '_anon_select', v_table);
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_user_select') then
      execute format($p$ create policy %I on public.%I for select to authenticated
        using (public.user_can_manage_estate_property("EstatePropertyId")) $p$, v_table || '_user_select', v_table);
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_user_insert') then
      execute format($p$ create policy %I on public.%I for insert to authenticated
        with check (public.user_can_manage_estate_property("EstatePropertyId")) $p$, v_table || '_user_insert', v_table);
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_user_update') then
      execute format($p$ create policy %I on public.%I for update to authenticated
        using (public.user_can_manage_estate_property("EstatePropertyId"))
        with check (public.user_can_manage_estate_property("EstatePropertyId")) $p$, v_table || '_user_update', v_table);
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_user_delete') then
      execute format($p$ create policy %I on public.%I for delete to authenticated
        using (public.user_can_manage_estate_property("EstatePropertyId")) $p$, v_table || '_user_delete', v_table);
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_admin_all') then
      execute format($p$ create policy %I on public.%I for all to authenticated
        using (public.is_admin()) with check (public.is_admin()) $p$, v_table || '_admin_all', v_table);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- ExternalCalendarEvents — public: R | user: RIXD* | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public."ExternalCalendarEvents"') is null then return; end if;
  execute 'alter table public."ExternalCalendarEvents" enable row level security';

  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'ExternalCalendarEvents' and policyname = 'ExternalCalendarEvents_anon_select') then
    execute $p$ create policy "ExternalCalendarEvents_anon_select" on public."ExternalCalendarEvents" for select to anon using (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'ExternalCalendarEvents' and policyname = 'ExternalCalendarEvents_user_select') then
    execute $p$ create policy "ExternalCalendarEvents_user_select" on public."ExternalCalendarEvents" for select to authenticated
      using (public.user_can_manage_calendar_integration("CalendarIntegrationId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'ExternalCalendarEvents' and policyname = 'ExternalCalendarEvents_user_insert') then
    execute $p$ create policy "ExternalCalendarEvents_user_insert" on public."ExternalCalendarEvents" for insert to authenticated
      with check (public.user_can_manage_calendar_integration("CalendarIntegrationId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'ExternalCalendarEvents' and policyname = 'ExternalCalendarEvents_user_update') then
    execute $p$ create policy "ExternalCalendarEvents_user_update" on public."ExternalCalendarEvents" for update to authenticated
      using (public.user_can_manage_calendar_integration("CalendarIntegrationId"))
      with check (public.user_can_manage_calendar_integration("CalendarIntegrationId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'ExternalCalendarEvents' and policyname = 'ExternalCalendarEvents_user_delete') then
    execute $p$ create policy "ExternalCalendarEvents_user_delete" on public."ExternalCalendarEvents" for delete to authenticated
      using (public.user_can_manage_calendar_integration("CalendarIntegrationId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'ExternalCalendarEvents' and policyname = 'ExternalCalendarEvents_admin_all') then
    execute $p$ create policy "ExternalCalendarEvents_admin_all" on public."ExternalCalendarEvents" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Favorites — public/user/admin: none (RLS on, no policies; locked down for now)
-- -----------------------------------------------------------------------------

do $$
declare
  r record;
begin
  if to_regclass('public."Favorites"') is null then return; end if;
  execute 'alter table public."Favorites" enable row level security';
  for r in
    select policyname from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'Favorites'
  loop
    execute format('drop policy if exists %I on public."Favorites"', r.policyname);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- ForceLogoutRequests — public: R | user: R | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public."ForceLogoutRequests"') is null then return; end if;
  execute 'alter table public."ForceLogoutRequests" enable row level security';

  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'ForceLogoutRequests' and policyname = 'ForceLogoutRequests_anon_select') then
    execute $p$ create policy "ForceLogoutRequests_anon_select" on public."ForceLogoutRequests" for select to anon using (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'ForceLogoutRequests' and policyname = 'ForceLogoutRequests_user_select') then
    execute $p$ create policy "ForceLogoutRequests_user_select" on public."ForceLogoutRequests" for select to authenticated
      using (public.user_is_record_member("MemberId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'ForceLogoutRequests' and policyname = 'ForceLogoutRequests_admin_all') then
    execute $p$ create policy "ForceLogoutRequests_admin_all" on public."ForceLogoutRequests" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Guests — public: RIXD* | user: R | admin: RIXD
-- -----------------------------------------------------------------------------

alter table public."Guests" enable row level security;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Guests' and policyname = 'Guests_anon_all') then
    execute $p$ create policy "Guests_anon_all" on public."Guests" for all to anon using (true) with check (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Guests' and policyname = 'Guests_authenticated_select') then
    execute $p$ create policy "Guests_authenticated_select" on public."Guests" for select to authenticated using (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Guests' and policyname = 'Guests_admin_all') then
    execute $p$ create policy "Guests_admin_all" on public."Guests" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Invoices — public: none | user: R | admin: RIXD
-- Existing: Invoices_subject_select, Invoices_service_all — not modified.
-- -----------------------------------------------------------------------------

alter table public."Invoices" enable row level security;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Invoices' and policyname = 'Invoices_admin_all') then
    execute $p$ create policy "Invoices_admin_all" on public."Invoices" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- ListingDailyFactors — public: none | user: R | admin: RIXD
-- Existing: ListingDailyFactors_select_all, ListingDailyFactors_write_admin — not modified.
-- -----------------------------------------------------------------------------

alter table public."ListingDailyFactors" enable row level security;

-- -----------------------------------------------------------------------------
-- Listings — public: R | user: RIXD* | admin: RIXD
-- -----------------------------------------------------------------------------

alter table public."Listings" enable row level security;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Listings' and policyname = 'Listings_anon_select') then
    execute $p$ create policy "Listings_anon_select" on public."Listings" for select to anon
      using ("IsDeleted" = false and public.is_public_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Listings' and policyname = 'Listings_user_select') then
    execute $p$ create policy "Listings_user_select" on public."Listings" for select to authenticated
      using ("IsDeleted" = false and public.user_can_manage_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Listings' and policyname = 'Listings_user_insert') then
    execute $p$ create policy "Listings_user_insert" on public."Listings" for insert to authenticated
      with check (public.user_can_manage_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Listings' and policyname = 'Listings_user_update') then
    execute $p$ create policy "Listings_user_update" on public."Listings" for update to authenticated
      using (public.user_can_manage_estate_property("EstatePropertyId"))
      with check (public.user_can_manage_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Listings' and policyname = 'Listings_user_delete') then
    execute $p$ create policy "Listings_user_delete" on public."Listings" for delete to authenticated
      using (public.user_can_manage_estate_property("EstatePropertyId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Listings' and policyname = 'Listings_admin_all') then
    execute $p$ create policy "Listings_admin_all" on public."Listings" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- MemberActionHistory — public: none | user: none | admin: R
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public."MemberActionHistory"') is null then return; end if;
  execute 'alter table public."MemberActionHistory" enable row level security';
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'MemberActionHistory' and policyname = 'MemberActionHistory_admin_select') then
    execute $p$ create policy "MemberActionHistory_admin_select" on public."MemberActionHistory" for select to authenticated
      using (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- MemberForceLogout — public: R | user: R | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public."MemberForceLogout"') is null then return; end if;
  execute 'alter table public."MemberForceLogout" enable row level security';
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'MemberForceLogout' and policyname = 'MemberForceLogout_anon_select') then
    execute $p$ create policy "MemberForceLogout_anon_select" on public."MemberForceLogout" for select to anon using (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'MemberForceLogout' and policyname = 'MemberForceLogout_user_select') then
    execute $p$ create policy "MemberForceLogout_user_select" on public."MemberForceLogout" for select to authenticated
      using (public.user_is_record_member("MemberId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'MemberForceLogout' and policyname = 'MemberForceLogout_admin_all') then
    execute $p$ create policy "MemberForceLogout_admin_all" on public."MemberForceLogout" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- MemberOnboarding — public: R | user: RIX | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public."MemberOnboarding"') is null then return; end if;
  execute 'alter table public."MemberOnboarding" enable row level security';
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'MemberOnboarding' and policyname = 'MemberOnboarding_anon_select') then
    execute $p$ create policy "MemberOnboarding_anon_select" on public."MemberOnboarding" for select to anon using (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'MemberOnboarding' and policyname = 'MemberOnboarding_user_select') then
    execute $p$ create policy "MemberOnboarding_user_select" on public."MemberOnboarding" for select to authenticated
      using (public.user_is_record_member("MemberId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'MemberOnboarding' and policyname = 'MemberOnboarding_user_insert') then
    execute $p$ create policy "MemberOnboarding_user_insert" on public."MemberOnboarding" for insert to authenticated
      with check (public.user_is_record_member("MemberId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'MemberOnboarding' and policyname = 'MemberOnboarding_user_update') then
    execute $p$ create policy "MemberOnboarding_user_update" on public."MemberOnboarding" for update to authenticated
      using (public.user_is_record_member("MemberId")) with check (public.user_is_record_member("MemberId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'MemberOnboarding' and policyname = 'MemberOnboarding_admin_all') then
    execute $p$ create policy "MemberOnboarding_admin_all" on public."MemberOnboarding" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Members — public: R | user: RIX | admin: RIXD (avoid self-referential subqueries in policies)
-- -----------------------------------------------------------------------------

alter table public."Members" enable row level security;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Members' and policyname = 'Members_anon_select') then
    execute $p$ create policy "Members_anon_select" on public."Members" for select to anon using ("IsDeleted" = false) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Members' and policyname = 'Members_authenticated_select') then
    execute $p$ create policy "Members_authenticated_select" on public."Members" for select to authenticated using ("IsDeleted" = false) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Members' and policyname = 'Members_authenticated_insert') then
    execute $p$ create policy "Members_authenticated_insert" on public."Members" for insert to authenticated
      with check ("UserId" = auth.uid()) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Members' and policyname = 'Members_authenticated_update') then
    execute $p$ create policy "Members_authenticated_update" on public."Members" for update to authenticated
      using ("UserId" = auth.uid()) with check ("UserId" = auth.uid()) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Members' and policyname = 'Members_admin_all') then
    execute $p$ create policy "Members_admin_all" on public."Members" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Messaging tables — public/user/admin: none (RLS on, no policies)
-- -----------------------------------------------------------------------------

do $$
declare
  v_table text;
begin
  foreach v_table in array array['MessageRecipients', 'MessageThreads', 'Messages', 'WebhookEvents']
  loop
    if to_regclass(format('public.%I', v_table)) is null then continue; end if;
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- OwnerOnboarding — public: none | user: RIX* | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public."OwnerOnboarding"') is null then return; end if;
  execute 'alter table public."OwnerOnboarding" enable row level security';
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'OwnerOnboarding' and policyname = 'OwnerOnboarding_user_select') then
    execute $p$ create policy "OwnerOnboarding_user_select" on public."OwnerOnboarding" for select to authenticated
      using (public.user_is_record_member("MemberId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'OwnerOnboarding' and policyname = 'OwnerOnboarding_user_insert') then
    execute $p$ create policy "OwnerOnboarding_user_insert" on public."OwnerOnboarding" for insert to authenticated
      with check (public.user_is_record_member("MemberId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'OwnerOnboarding' and policyname = 'OwnerOnboarding_user_update') then
    execute $p$ create policy "OwnerOnboarding_user_update" on public."OwnerOnboarding" for update to authenticated
      using (public.user_is_record_member("MemberId")) with check (public.user_is_record_member("MemberId")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'OwnerOnboarding' and policyname = 'OwnerOnboarding_admin_all') then
    execute $p$ create policy "OwnerOnboarding_admin_all" on public."OwnerOnboarding" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Owners — public: R | user: RIXD* | admin: RIXD
-- -----------------------------------------------------------------------------

alter table public."Owners" enable row level security;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Owners' and policyname = 'Owners_anon_select') then
    execute $p$ create policy "Owners_anon_select" on public."Owners" for select to anon using ("IsDeleted" = false) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Owners' and policyname = 'Owners_user_select') then
    execute $p$ create policy "Owners_user_select" on public."Owners" for select to authenticated
      using ("IsDeleted" = false and public.user_can_read_owner_record("Id")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Owners' and policyname = 'Owners_user_insert') then
    execute $p$ create policy "Owners_user_insert" on public."Owners" for insert to authenticated
      with check (
        ("OwnerType" = 'member' and "MemberId" = public.current_member_id())
        or ("OwnerType" = 'company' and public.is_company_manager("CompanyId"))
      ) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Owners' and policyname = 'Owners_user_update') then
    execute $p$ create policy "Owners_user_update" on public."Owners" for update to authenticated
      using (public.user_owns_owner_record("Id")) with check (public.user_owns_owner_record("Id")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Owners' and policyname = 'Owners_user_delete') then
    execute $p$ create policy "Owners_user_delete" on public."Owners" for delete to authenticated
      using (public.user_owns_owner_record("Id")) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Owners' and policyname = 'Owners_admin_all') then
    execute $p$ create policy "Owners_admin_all" on public."Owners" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Plans — public: none | user: R | admin: RIXD
-- Existing: Plans_authenticated_select, Plans_service_all — not modified.
-- -----------------------------------------------------------------------------

alter table public."Plans" enable row level security;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Plans' and policyname = 'Plans_admin_all') then
    execute $p$ create policy "Plans_admin_all" on public."Plans" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Property media — PropertyDocuments/Images: no public | PropertyVideos: public R
-- -----------------------------------------------------------------------------

do $$
declare
  v_table text;
  v_public_tables text[] := array['PropertyVideos'];
begin
  foreach v_table in array array['PropertyDocuments', 'PropertyImages', 'PropertyVideos']
  loop
    if to_regclass(format('public.%I', v_table)) is null then continue; end if;
    execute format('alter table public.%I enable row level security', v_table);

    if v_table = any (v_public_tables) and not exists (
      select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_anon_select'
    ) then
      execute format($p$ create policy %I on public.%I for select to anon
        using ("IsDeleted" = false and public.is_public_estate_property("EstatePropertyId")) $p$,
        v_table || '_anon_select', v_table);
    end if;

    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_user_select') then
      execute format($p$ create policy %I on public.%I for select to authenticated
        using ("IsDeleted" = false and public.user_can_manage_estate_property("EstatePropertyId")) $p$,
        v_table || '_user_select', v_table);
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_user_insert') then
      execute format($p$ create policy %I on public.%I for insert to authenticated
        with check (public.user_can_manage_estate_property("EstatePropertyId")) $p$,
        v_table || '_user_insert', v_table);
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_user_update') then
      execute format($p$ create policy %I on public.%I for update to authenticated
        using (public.user_can_manage_estate_property("EstatePropertyId"))
        with check (public.user_can_manage_estate_property("EstatePropertyId")) $p$,
        v_table || '_user_update', v_table);
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_user_delete') then
      execute format($p$ create policy %I on public.%I for delete to authenticated
        using (public.user_can_manage_estate_property("EstatePropertyId")) $p$,
        v_table || '_user_delete', v_table);
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_admin_all') then
      execute format($p$ create policy %I on public.%I for all to authenticated
        using (public.is_admin()) with check (public.is_admin()) $p$,
        v_table || '_admin_all', v_table);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- PropertyMessageLogs — public: I | user: I | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public."PropertyMessageLogs"') is null then return; end if;
  execute 'alter table public."PropertyMessageLogs" enable row level security';
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'PropertyMessageLogs' and policyname = 'PropertyMessageLogs_anon_insert') then
    execute $p$ create policy "PropertyMessageLogs_anon_insert" on public."PropertyMessageLogs" for insert to anon with check (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'PropertyMessageLogs' and policyname = 'PropertyMessageLogs_user_insert') then
    execute $p$ create policy "PropertyMessageLogs_user_insert" on public."PropertyMessageLogs" for insert to authenticated with check (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'PropertyMessageLogs' and policyname = 'PropertyMessageLogs_admin_all') then
    execute $p$ create policy "PropertyMessageLogs_admin_all" on public."PropertyMessageLogs" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- PropertyModerationActions — public/user: none | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public."PropertyModerationActions"') is null then return; end if;
  execute 'alter table public."PropertyModerationActions" enable row level security';
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'PropertyModerationActions' and policyname = 'PropertyModerationActions_admin_all') then
    execute $p$ create policy "PropertyModerationActions_admin_all" on public."PropertyModerationActions" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- PropertySearchScores — public: R | user: R | admin: RIXD
-- Existing: PropertySearchScores_select_all, PropertySearchScores_write_service — not modified.
-- -----------------------------------------------------------------------------

alter table public."PropertySearchScores" enable row level security;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'PropertySearchScores' and policyname = 'PropertySearchScores_admin_all') then
    execute $p$ create policy "PropertySearchScores_admin_all" on public."PropertySearchScores" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- PropertyVisitLogs — public: I | user: RI | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public."PropertyVisitLogs"') is null then return; end if;
  execute 'alter table public."PropertyVisitLogs" enable row level security';
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'PropertyVisitLogs' and policyname = 'PropertyVisitLogs_anon_insert') then
    execute $p$ create policy "PropertyVisitLogs_anon_insert" on public."PropertyVisitLogs" for insert to anon with check (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'PropertyVisitLogs' and policyname = 'PropertyVisitLogs_user_select') then
    execute $p$ create policy "PropertyVisitLogs_user_select" on public."PropertyVisitLogs" for select to authenticated using (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'PropertyVisitLogs' and policyname = 'PropertyVisitLogs_user_insert') then
    execute $p$ create policy "PropertyVisitLogs_user_insert" on public."PropertyVisitLogs" for insert to authenticated with check (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'PropertyVisitLogs' and policyname = 'PropertyVisitLogs_admin_all') then
    execute $p$ create policy "PropertyVisitLogs_admin_all" on public."PropertyVisitLogs" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- RecoveryCodes — public: none | user: RIXD | admin: RIXD
-- Ownership column varies by schema (UserId vs MemberId).
-- -----------------------------------------------------------------------------

do $$
declare
  v_rel regclass;
  v_owner_expr text;
begin
  v_rel := to_regclass('public."RecoveryCodes"');
  if v_rel is null then return; end if;

  execute 'alter table public."RecoveryCodes" enable row level security';

  if exists (
    select 1 from pg_attribute
    where attrelid = v_rel and attname = 'UserId' and not attisdropped
  ) then
    v_owner_expr := 'public.user_owns_auth_user_id("UserId")';
  elsif exists (
    select 1 from pg_attribute
    where attrelid = v_rel and attname = 'MemberId' and not attisdropped
  ) then
    v_owner_expr := 'public.user_is_record_member("MemberId")';
  elsif exists (
    select 1 from pg_attribute
    where attrelid = v_rel and attname = 'user_id' and not attisdropped
  ) then
    v_owner_expr := 'user_id = auth.uid()';
  elsif exists (
    select 1 from pg_attribute
    where attrelid = v_rel and attname = 'member_id' and not attisdropped
  ) then
    v_owner_expr := 'member_id = public.current_member_id()';
  else
    raise notice 'RecoveryCodes: no UserId/MemberId ownership column; skipping user policy.';
    v_owner_expr := null;
  end if;

  if v_owner_expr is not null and not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'RecoveryCodes' and policyname = 'RecoveryCodes_user_all'
  ) then
    execute format(
      'create policy "RecoveryCodes_user_all" on public."RecoveryCodes" for all to authenticated using (%s) with check (%s)',
      v_owner_expr,
      v_owner_expr
    );
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'RecoveryCodes' and policyname = 'RecoveryCodes_admin_all'
  ) then
    execute $p$ create policy "RecoveryCodes_admin_all" on public."RecoveryCodes" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Reviews — public: RIXD | user: RIXD | admin: RIXD
-- -----------------------------------------------------------------------------

alter table public."Reviews" enable row level security;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Reviews' and policyname = 'Reviews_anon_all') then
    execute $p$ create policy "Reviews_anon_all" on public."Reviews" for all to anon using (true) with check (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Reviews' and policyname = 'Reviews_user_all') then
    execute $p$ create policy "Reviews_user_all" on public."Reviews" for all to authenticated using (true) with check (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'Reviews' and policyname = 'Reviews_admin_all') then
    execute $p$ create policy "Reviews_admin_all" on public."Reviews" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- SyncJobs — public/user: none | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public."SyncJobs"') is null then return; end if;
  execute 'alter table public."SyncJobs" enable row level security';
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'SyncJobs' and policyname = 'SyncJobs_admin_all') then
    execute $p$ create policy "SyncJobs_admin_all" on public."SyncJobs" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- UsageRecords — public: none | user: R | admin: RIXD
-- Existing: UsageRecords_subject_select/insert/update, UsageRecords_service_all — not modified.
-- -----------------------------------------------------------------------------

alter table public."UsageRecords" enable row level security;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'UsageRecords' and policyname = 'UsageRecords_admin_all') then
    execute $p$ create policy "UsageRecords_admin_all" on public."UsageRecords" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- UserApps — public: none | user: RIX | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public."UserApps"') is null then return; end if;
  execute 'alter table public."UserApps" enable row level security';
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'UserApps' and policyname = 'UserApps_user_select') then
    execute $p$ create policy "UserApps_user_select" on public."UserApps" for select to authenticated using ("UserId" = auth.uid()) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'UserApps' and policyname = 'UserApps_user_insert') then
    execute $p$ create policy "UserApps_user_insert" on public."UserApps" for insert to authenticated with check ("UserId" = auth.uid()) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'UserApps' and policyname = 'UserApps_user_update') then
    execute $p$ create policy "UserApps_user_update" on public."UserApps" for update to authenticated
      using ("UserId" = auth.uid()) with check ("UserId" = auth.uid()) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'UserApps' and policyname = 'UserApps_admin_all') then
    execute $p$ create policy "UserApps_admin_all" on public."UserApps" for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- VerificationCodes / verification_codes — public: R | user: R | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
declare
  v_rel regclass;
  v_tablename text;
  v_user_col text;
begin
  v_rel := coalesce(to_regclass('public."VerificationCodes"'), to_regclass('public.verification_codes'));
  if v_rel is null then return; end if;

  select c.relname into v_tablename from pg_class c where c.oid = v_rel;

  execute format('alter table %s enable row level security', v_rel);

  if exists (
    select 1 from pg_attribute
    where attrelid = v_rel and attname = 'UserId' and not attisdropped
  ) then
    v_user_col := 'UserId';
  elsif exists (
    select 1 from pg_attribute
    where attrelid = v_rel and attname = 'user_id' and not attisdropped
  ) then
    v_user_col := 'user_id';
  else
    v_user_col := null;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies p
    where p.schemaname = 'public' and p.tablename = v_tablename and p.policyname = 'VerificationCodes_anon_select'
  ) then
    execute format($p$ create policy "VerificationCodes_anon_select" on %s for select to anon using (true) $p$, v_rel);
  end if;

  if v_user_col is not null and not exists (
    select 1 from pg_catalog.pg_policies p
    where p.schemaname = 'public' and p.tablename = v_tablename and p.policyname = 'VerificationCodes_user_select'
  ) then
    execute format(
      $p$ create policy "VerificationCodes_user_select" on %s for select to authenticated using (%I = auth.uid()) $p$,
      v_rel, v_user_col
    );
  elsif v_user_col is null and not exists (
    select 1 from pg_catalog.pg_policies p
    where p.schemaname = 'public' and p.tablename = v_tablename and p.policyname = 'VerificationCodes_user_select'
  ) then
    execute format($p$ create policy "VerificationCodes_user_select" on %s for select to authenticated using (true) $p$, v_rel);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies p
    where p.schemaname = 'public' and p.tablename = v_tablename and p.policyname = 'VerificationCodes_admin_all'
  ) then
    execute format($p$ create policy "VerificationCodes_admin_all" on %s for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$, v_rel);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- analytics_events — public: none | user: R | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.analytics_events') is null then return; end if;
  execute 'alter table public.analytics_events enable row level security';
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'analytics_events' and policyname = 'analytics_events_user_select') then
    execute $p$ create policy "analytics_events_user_select" on public.analytics_events for select to authenticated using (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'analytics_events' and policyname = 'analytics_events_admin_all') then
    execute $p$ create policy "analytics_events_admin_all" on public.analytics_events for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- booking_holds — public: RI | user: RI | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.booking_holds') is null then return; end if;
  execute 'alter table public.booking_holds enable row level security';
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'booking_holds' and policyname = 'booking_holds_anon_select') then
    execute $p$ create policy "booking_holds_anon_select" on public.booking_holds for select to anon using (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'booking_holds' and policyname = 'booking_holds_anon_insert') then
    execute $p$ create policy "booking_holds_anon_insert" on public.booking_holds for insert to anon with check (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'booking_holds' and policyname = 'booking_holds_user_select') then
    execute $p$ create policy "booking_holds_user_select" on public.booking_holds for select to authenticated using (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'booking_holds' and policyname = 'booking_holds_user_insert') then
    execute $p$ create policy "booking_holds_user_insert" on public.booking_holds for insert to authenticated with check (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'booking_holds' and policyname = 'booking_holds_admin_all') then
    execute $p$ create policy "booking_holds_admin_all" on public.booking_holds for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- booking_manage_tokens — public: RI | user: RI | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.booking_manage_tokens') is null then return; end if;
  execute 'alter table public.booking_manage_tokens enable row level security';
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'booking_manage_tokens' and policyname = 'booking_manage_tokens_anon_select') then
    execute $p$ create policy "booking_manage_tokens_anon_select" on public.booking_manage_tokens for select to anon using (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'booking_manage_tokens' and policyname = 'booking_manage_tokens_anon_insert') then
    execute $p$ create policy "booking_manage_tokens_anon_insert" on public.booking_manage_tokens for insert to anon with check (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'booking_manage_tokens' and policyname = 'booking_manage_tokens_user_select') then
    execute $p$ create policy "booking_manage_tokens_user_select" on public.booking_manage_tokens for select to authenticated using (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'booking_manage_tokens' and policyname = 'booking_manage_tokens_user_insert') then
    execute $p$ create policy "booking_manage_tokens_user_insert" on public.booking_manage_tokens for insert to authenticated with check (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'booking_manage_tokens' and policyname = 'booking_manage_tokens_admin_all') then
    execute $p$ create policy "booking_manage_tokens_admin_all" on public.booking_manage_tokens for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- booking_rate_limits / otp_rate_limits — public: R | user: R | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
declare
  v_table text;
begin
  foreach v_table in array array['booking_rate_limits', 'otp_rate_limits']
  loop
    if to_regclass(format('public.%I', v_table)) is null then continue; end if;
    execute format('alter table public.%I enable row level security', v_table);
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_anon_select') then
      execute format($p$ create policy %I on public.%I for select to anon using (true) $p$, v_table || '_anon_select', v_table);
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_user_select') then
      execute format($p$ create policy %I on public.%I for select to authenticated using (true) $p$, v_table || '_user_select', v_table);
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = v_table and policyname = v_table || '_admin_all') then
      execute format($p$ create policy %I on public.%I for all to authenticated
        using (public.is_admin()) with check (public.is_admin()) $p$, v_table || '_admin_all', v_table);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- otp_requests — public: RI | user: RI | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.otp_requests') is null then return; end if;
  execute 'alter table public.otp_requests enable row level security';
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'otp_requests' and policyname = 'otp_requests_anon_select') then
    execute $p$ create policy "otp_requests_anon_select" on public.otp_requests for select to anon using (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'otp_requests' and policyname = 'otp_requests_anon_insert') then
    execute $p$ create policy "otp_requests_anon_insert" on public.otp_requests for insert to anon with check (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'otp_requests' and policyname = 'otp_requests_user_select') then
    execute $p$ create policy "otp_requests_user_select" on public.otp_requests for select to authenticated using (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'otp_requests' and policyname = 'otp_requests_user_insert') then
    execute $p$ create policy "otp_requests_user_insert" on public.otp_requests for insert to authenticated with check (true) $p$;
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'otp_requests' and policyname = 'otp_requests_admin_all') then
    execute $p$ create policy "otp_requests_admin_all" on public.otp_requests for all to authenticated
      using (public.is_admin()) with check (public.is_admin()) $p$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- propertydetailssection / propertysectionimages — public: R | user: RIXD | admin: RIXD
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.propertydetailssection') is not null then
    execute 'alter table public.propertydetailssection enable row level security';
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'propertydetailssection' and policyname = 'propertydetailssection_anon_select') then
      execute $p$ create policy "propertydetailssection_anon_select" on public.propertydetailssection for select to anon
        using (isdeleted = false and public.is_public_estate_property(propertyid)) $p$;
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'propertydetailssection' and policyname = 'propertydetailssection_user_select') then
      execute $p$ create policy "propertydetailssection_user_select" on public.propertydetailssection for select to authenticated
        using (isdeleted = false and public.user_can_manage_estate_property(propertyid)) $p$;
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'propertydetailssection' and policyname = 'propertydetailssection_user_insert') then
      execute $p$ create policy "propertydetailssection_user_insert" on public.propertydetailssection for insert to authenticated
        with check (public.user_can_manage_estate_property(propertyid)) $p$;
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'propertydetailssection' and policyname = 'propertydetailssection_user_update') then
      execute $p$ create policy "propertydetailssection_user_update" on public.propertydetailssection for update to authenticated
        using (public.user_can_manage_estate_property(propertyid)) with check (public.user_can_manage_estate_property(propertyid)) $p$;
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'propertydetailssection' and policyname = 'propertydetailssection_user_delete') then
      execute $p$ create policy "propertydetailssection_user_delete" on public.propertydetailssection for delete to authenticated
        using (public.user_can_manage_estate_property(propertyid)) $p$;
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'propertydetailssection' and policyname = 'propertydetailssection_admin_all') then
      execute $p$ create policy "propertydetailssection_admin_all" on public.propertydetailssection for all to authenticated
        using (public.is_admin()) with check (public.is_admin()) $p$;
    end if;
  end if;

  if to_regclass('public.propertysectionimages') is not null then
    execute 'alter table public.propertysectionimages enable row level security';
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'propertysectionimages' and policyname = 'propertysectionimages_anon_select') then
      execute $p$ create policy "propertysectionimages_anon_select" on public.propertysectionimages for select to anon
        using (exists (
          select 1 from public.propertydetailssection s
          where s.id = sectionid and s.isdeleted = false
            and public.is_public_estate_property(s.propertyid)
        )) $p$;
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'propertysectionimages' and policyname = 'propertysectionimages_user_select') then
      execute $p$ create policy "propertysectionimages_user_select" on public.propertysectionimages for select to authenticated
        using (public.user_can_manage_property_section(sectionid)) $p$;
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'propertysectionimages' and policyname = 'propertysectionimages_user_insert') then
      execute $p$ create policy "propertysectionimages_user_insert" on public.propertysectionimages for insert to authenticated
        with check (public.user_can_manage_property_section(sectionid)) $p$;
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'propertysectionimages' and policyname = 'propertysectionimages_user_update') then
      execute $p$ create policy "propertysectionimages_user_update" on public.propertysectionimages for update to authenticated
        using (public.user_can_manage_property_section(sectionid)) with check (public.user_can_manage_property_section(sectionid)) $p$;
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'propertysectionimages' and policyname = 'propertysectionimages_user_delete') then
      execute $p$ create policy "propertysectionimages_user_delete" on public.propertysectionimages for delete to authenticated
        using (public.user_can_manage_property_section(sectionid)) $p$;
    end if;
    if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'propertysectionimages' and policyname = 'propertysectionimages_admin_all') then
      execute $p$ create policy "propertysectionimages_admin_all" on public.propertysectionimages for all to authenticated
        using (public.is_admin()) with check (public.is_admin()) $p$;
    end if;
  end if;
end $$;

commit;
