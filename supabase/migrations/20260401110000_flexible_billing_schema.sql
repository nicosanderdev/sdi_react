-- Flexible billing schema expansion (non-destructive, idempotent)
-- NOTE: Manual execution by project owner.

begin;

-- ---------------------------------------------------------------------------
-- Plans extensions
-- ---------------------------------------------------------------------------
alter table if exists public."Plans"
  add column if not exists "PricingModel" text;

alter table if exists public."Plans"
  add column if not exists "Price" numeric;

alter table if exists public."Plans"
  add column if not exists "MinMonthlyFee" numeric;

alter table if exists public."Plans"
  add column if not exists "PricePerBooking" numeric;

alter table if exists public."Plans"
  add column if not exists "ListingLimit" integer;

alter table if exists public."Plans"
  add column if not exists "DurationDays" integer;

alter table if exists public."Plans"
  add column if not exists "IsActiveV2" boolean;

update public."Plans"
set
  "PricingModel" = coalesce(
    "PricingModel",
    case
      when coalesce("MonthlyPrice", 0) = 0 then 'free'
      else 'hybrid'
    end
  ),
  "Price" = coalesce("Price", "MonthlyPrice"),
  "MinMonthlyFee" = coalesce("MinMonthlyFee", "MonthlyPrice"),
  "PricePerBooking" = coalesce("PricePerBooking", null),
  "ListingLimit" = coalesce("ListingLimit", "MaxPublishedProperties"),
  "DurationDays" = coalesce("DurationDays", 30),
  "IsActiveV2" = coalesce("IsActiveV2", "IsActive")
where true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'CK_Plans_PricingModel'
  ) then
    alter table public."Plans"
      add constraint "CK_Plans_PricingModel"
      check ("PricingModel" in ('free', 'per_booking', 'per_listing', 'hybrid'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- MemberPlans: replacement for MemberSubscriptions (additive first)
-- ---------------------------------------------------------------------------
create table if not exists public."MemberPlans" (
  "Id" uuid primary key default gen_random_uuid(),
  "MemberId" uuid not null references public."Members"("Id"),
  "PlanId" uuid not null references public."Plans"("Id"),
  "StartDate" timestamptz not null default now(),
  "EndDate" timestamptz null,
  "IsActive" boolean not null default true,
  "Created" timestamptz not null default now(),
  "CreatedBy" text null,
  "LastModified" timestamptz not null default now(),
  "LastModifiedBy" text null
);

create index if not exists "IX_MemberPlans_MemberId_IsActive"
  on public."MemberPlans" ("MemberId", "IsActive");

create index if not exists "IX_MemberPlans_PlanId"
  on public."MemberPlans" ("PlanId");

-- ---------------------------------------------------------------------------
-- BillingCycles
-- ---------------------------------------------------------------------------
create table if not exists public."BillingCycles" (
  "Id" uuid primary key default gen_random_uuid(),
  "MemberId" uuid not null references public."Members"("Id"),
  "StartDate" timestamptz not null,
  "EndDate" timestamptz not null,
  "Status" text not null default 'open',
  "TotalAmount" numeric not null default 0,
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz not null default now(),
  "CreatedBy" text null,
  "LastModifiedBy" text null
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'CK_BillingCycles_Status'
  ) then
    alter table public."BillingCycles"
      add constraint "CK_BillingCycles_Status"
      check ("Status" in ('open', 'closed', 'paid'));
  end if;
end $$;

create index if not exists "IX_BillingCycles_MemberId_Status"
  on public."BillingCycles" ("MemberId", "Status");

create index if not exists "IX_BillingCycles_Start_End"
  on public."BillingCycles" ("StartDate", "EndDate");

-- ---------------------------------------------------------------------------
-- UsageRecords
-- ---------------------------------------------------------------------------
create table if not exists public."UsageRecords" (
  "Id" uuid primary key default gen_random_uuid(),
  "MemberId" uuid not null references public."Members"("Id"),
  "Type" text not null,
  "ReferenceId" integer not null,
  "Amount" numeric not null default 0,
  "CreatedAt" timestamptz not null default now(),
  "CreatedBy" text null
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'CK_UsageRecords_Type'
  ) then
    alter table public."UsageRecords"
      add constraint "CK_UsageRecords_Type"
      check ("Type" in ('booking', 'listing'));
  end if;
end $$;

create unique index if not exists "UX_UsageRecords_Member_Type_Reference"
  on public."UsageRecords" ("MemberId", "Type", "ReferenceId");

create index if not exists "IX_UsageRecords_Member_CreatedAt"
  on public."UsageRecords" ("MemberId", "CreatedAt");

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------
create table if not exists public."Invoices" (
  "Id" uuid primary key default gen_random_uuid(),
  "MemberId" uuid not null references public."Members"("Id"),
  "BillingCycleId" uuid not null references public."BillingCycles"("Id"),
  "Total" numeric not null default 0,
  "Status" text not null default 'pending',
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz not null default now(),
  "CreatedBy" text null,
  "LastModifiedBy" text null
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'CK_Invoices_Status'
  ) then
    alter table public."Invoices"
      add constraint "CK_Invoices_Status"
      check ("Status" in ('pending', 'paid'));
  end if;
end $$;

create index if not exists "IX_Invoices_MemberId_Status"
  on public."Invoices" ("MemberId", "Status");

create unique index if not exists "UX_Invoices_BillingCycleId"
  on public."Invoices" ("BillingCycleId");

commit;
