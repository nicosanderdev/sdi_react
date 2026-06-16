-- Unify MemberPlans + BillingOwnerMemberMap into BillingPlanAssignments.
-- Polymorphic billing subject on UsageRecords, BillingCycles, Invoices.
-- No data backfill from legacy assignment tables. Apply manually.
-- Existing usage/cycle/invoice rows: if MemberId present, copied to SubjectType='member'.

begin;

-- -----------------------------------------------------------------------------
-- BillingPlanAssignments
-- -----------------------------------------------------------------------------
create table if not exists public."BillingPlanAssignments" (
  "Id" uuid primary key default gen_random_uuid(),
  "SubjectType" text not null,
  "MemberOrCompanyId" uuid not null,
  "PlanId" uuid not null references public."Plans"("Id"),
  "StartDate" timestamptz not null default now(),
  "EndDate" timestamptz,
  "IsActive" boolean not null default true,
  "Created" timestamptz not null default now(),
  "CreatedBy" text,
  "LastModified" timestamptz not null default now(),
  "LastModifiedBy" text,
  constraint "CK_BillingPlanAssignments_SubjectType"
    check ("SubjectType" in ('member', 'company'))
);

create unique index if not exists "UX_BillingPlanAssignments_Active_Subject"
  on public."BillingPlanAssignments" ("SubjectType", "MemberOrCompanyId")
  where "IsActive" = true;

create index if not exists "IX_BillingPlanAssignments_Subject_IsActive"
  on public."BillingPlanAssignments" ("SubjectType", "MemberOrCompanyId", "IsActive");

create index if not exists "IX_BillingPlanAssignments_PlanId"
  on public."BillingPlanAssignments" ("PlanId");

comment on table public."BillingPlanAssignments" is
  'Plan subscription for a member or company (SubjectType + MemberOrCompanyId).';

-- -----------------------------------------------------------------------------
-- UsageRecords: MemberId -> SubjectType + MemberOrCompanyId
-- -----------------------------------------------------------------------------
alter table public."UsageRecords"
  add column if not exists "SubjectType" text;

alter table public."UsageRecords"
  add column if not exists "MemberOrCompanyId" uuid;

update public."UsageRecords"
set
  "SubjectType" = 'member',
  "MemberOrCompanyId" = "MemberId"
where "MemberId" is not null
  and ("SubjectType" is null or "MemberOrCompanyId" is null);

alter table public."UsageRecords"
  alter column "SubjectType" set not null;

alter table public."UsageRecords"
  alter column "MemberOrCompanyId" set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'CK_UsageRecords_SubjectType'
  ) then
    alter table public."UsageRecords"
      add constraint "CK_UsageRecords_SubjectType"
      check ("SubjectType" in ('member', 'company'));
  end if;
end $$;

drop index if exists public."UX_UsageRecords_Member_Type_Reference";
drop index if exists public."IX_UsageRecords_Member_CreatedAt";
drop index if exists public."IX_UsageRecords_Member_Invoice_CreatedAt";

alter table public."UsageRecords" drop constraint if exists "UsageRecords_MemberId_fkey";
alter table public."UsageRecords" drop column if exists "MemberId";

create unique index if not exists "UX_UsageRecords_Subject_Type_Reference"
  on public."UsageRecords" ("SubjectType", "MemberOrCompanyId", "Type", "ReferenceId");

create index if not exists "IX_UsageRecords_Subject_CreatedAt"
  on public."UsageRecords" ("SubjectType", "MemberOrCompanyId", "CreatedAt");

create index if not exists "IX_UsageRecords_Subject_Invoice_CreatedAt"
  on public."UsageRecords" ("SubjectType", "MemberOrCompanyId", "InvoiceId", "CreatedAt");

-- -----------------------------------------------------------------------------
-- BillingCycles
-- -----------------------------------------------------------------------------
alter table public."BillingCycles"
  add column if not exists "SubjectType" text;

alter table public."BillingCycles"
  add column if not exists "MemberOrCompanyId" uuid;

update public."BillingCycles"
set
  "SubjectType" = 'member',
  "MemberOrCompanyId" = "MemberId"
where "MemberId" is not null
  and ("SubjectType" is null or "MemberOrCompanyId" is null);

alter table public."BillingCycles"
  alter column "SubjectType" set not null;

alter table public."BillingCycles"
  alter column "MemberOrCompanyId" set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'CK_BillingCycles_SubjectType'
  ) then
    alter table public."BillingCycles"
      add constraint "CK_BillingCycles_SubjectType"
      check ("SubjectType" in ('member', 'company'));
  end if;
end $$;

drop index if exists public."IX_BillingCycles_MemberId_Status";
drop index if exists public."IX_BillingCycles_Start_End";

alter table public."BillingCycles" drop constraint if exists "BillingCycles_MemberId_fkey";
alter table public."BillingCycles" drop column if exists "MemberId";

create index if not exists "IX_BillingCycles_Subject_Status"
  on public."BillingCycles" ("SubjectType", "MemberOrCompanyId", "Status");

create index if not exists "IX_BillingCycles_Start_End"
  on public."BillingCycles" ("StartDate", "EndDate");

-- -----------------------------------------------------------------------------
-- Invoices (drop legacy member/cycle trigger before column drop)
-- -----------------------------------------------------------------------------
drop trigger if exists trg_validate_invoice_member_cycle on public."Invoices";

alter table public."Invoices"
  add column if not exists "SubjectType" text;

alter table public."Invoices"
  add column if not exists "MemberOrCompanyId" uuid;

update public."Invoices"
set
  "SubjectType" = 'member',
  "MemberOrCompanyId" = "MemberId"
where "MemberId" is not null
  and ("SubjectType" is null or "MemberOrCompanyId" is null);

alter table public."Invoices"
  alter column "SubjectType" set not null;

alter table public."Invoices"
  alter column "MemberOrCompanyId" set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'CK_Invoices_SubjectType'
  ) then
    alter table public."Invoices"
      add constraint "CK_Invoices_SubjectType"
      check ("SubjectType" in ('member', 'company'));
  end if;
end $$;

alter table public."Invoices" drop constraint if exists "Invoices_MemberId_fkey";
alter table public."Invoices" drop column if exists "MemberId";

drop index if exists public."IX_Invoices_MemberId_Status";
create index if not exists "IX_Invoices_Subject_Status"
  on public."Invoices" ("SubjectType", "MemberOrCompanyId", "Status");

-- -----------------------------------------------------------------------------
-- Drop legacy tables
-- -----------------------------------------------------------------------------
drop table if exists public."MemberPlans";
drop table if exists public."BillingOwnerMemberMap";

commit;
