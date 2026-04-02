-- Flexible billing staged migration (manual mapping + idempotent backfill)
-- NOTE: Manual execution by project owner.

begin;

create table if not exists public."BillingOwnerMemberMap" (
  "Id" uuid primary key default gen_random_uuid(),
  "OwnerType" integer not null,
  "OwnerId" uuid not null,
  "MemberId" uuid not null references public."Members"("Id"),
  "Notes" text null,
  "IsActive" boolean not null default true,
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz not null default now(),
  "CreatedBy" text null,
  "LastModifiedBy" text null
);

create unique index if not exists "UX_BillingOwnerMemberMap_Owner"
  on public."BillingOwnerMemberMap" ("OwnerType", "OwnerId")
  where "IsActive" = true;

create index if not exists "IX_BillingOwnerMemberMap_MemberId"
  on public."BillingOwnerMemberMap" ("MemberId");

create or replace function public.billing_unmapped_subscriptions()
returns table (
  subscription_id uuid,
  owner_type integer,
  owner_id uuid,
  created_at timestamptz
)
language sql
security definer
as $$
  select
    s."Id" as subscription_id,
    s."OwnerType" as owner_type,
    s."OwnerId" as owner_id,
    s."CreatedAt" as created_at
  from public."Subscriptions" s
  left join public."BillingOwnerMemberMap" m
    on m."OwnerType" = s."OwnerType"
   and m."OwnerId" = s."OwnerId"
   and m."IsActive" = true
  where s."IsDeleted" = false
    and m."Id" is null;
$$;

create or replace function public.billing_unmapped_histories()
returns table (
  billing_history_id uuid,
  subscription_id uuid,
  owner_type integer,
  owner_id uuid
)
language sql
security definer
as $$
  select
    bh."Id" as billing_history_id,
    s."Id" as subscription_id,
    s."OwnerType" as owner_type,
    s."OwnerId" as owner_id
  from public."BillingHistories" bh
  join public."Subscriptions" s
    on s."Id" = bh."SubscriptionId"
  left join public."BillingOwnerMemberMap" m
    on m."OwnerType" = s."OwnerType"
   and m."OwnerId" = s."OwnerId"
   and m."IsActive" = true
  where bh."IsDeleted" = false
    and s."IsDeleted" = false
    and m."Id" is null;
$$;

-- Backfill from MemberSubscriptions where a member->plan relationship can be inferred.
insert into public."MemberPlans" (
  "Id",
  "MemberId",
  "PlanId",
  "StartDate",
  "EndDate",
  "IsActive",
  "Created",
  "CreatedBy",
  "LastModified",
  "LastModifiedBy"
)
select
  ms."Id",
  ms."MemberId",
  p."Id" as "PlanId",
  coalesce(ms."Created", now()) as "StartDate",
  ms."ExpiresAtUtc" as "EndDate",
  ms."isActive" as "IsActive",
  coalesce(ms."Created", now()) as "Created",
  ms."CreatedBy",
  coalesce(ms."LastModified", now()) as "LastModified",
  ms."LastModifiedBy"
from public."MemberSubscriptions" ms
join lateral (
  select p0."Id"
  from public."Plans" p0
  where p0."IsDeleted" = false
  order by p0."Created" asc
  limit 1
) p on true
where not exists (
  select 1
  from public."MemberPlans" mp
  where mp."Id" = ms."Id"
);

-- Backfill from Subscriptions, only for owners explicitly mapped in BillingOwnerMemberMap.
insert into public."MemberPlans" (
  "Id",
  "MemberId",
  "PlanId",
  "StartDate",
  "EndDate",
  "IsActive",
  "Created",
  "CreatedBy",
  "LastModified",
  "LastModifiedBy"
)
select
  s."Id",
  map."MemberId",
  s."PlanId",
  coalesce(s."CurrentPeriodStart", s."CreatedAt", now()) as "StartDate",
  s."CurrentPeriodEnd" as "EndDate",
  (s."Status" = 1 and s."IsDeleted" = false) as "IsActive",
  coalesce(s."Created", now()) as "Created",
  s."CreatedBy",
  coalesce(s."LastModified", now()) as "LastModified",
  s."LastModifiedBy"
from public."Subscriptions" s
join public."BillingOwnerMemberMap" map
  on map."OwnerType" = s."OwnerType"
 and map."OwnerId" = s."OwnerId"
 and map."IsActive" = true
where s."IsDeleted" = false
  and not exists (
    select 1 from public."MemberPlans" mp where mp."Id" = s."Id"
  );

-- Seed billing cycles and invoices from BillingHistories only for mapped owners.
insert into public."BillingCycles" (
  "Id",
  "MemberId",
  "StartDate",
  "EndDate",
  "Status",
  "TotalAmount",
  "CreatedAt",
  "UpdatedAt",
  "CreatedBy",
  "LastModifiedBy"
)
select
  bh."Id" as "Id",
  map."MemberId",
  coalesce(s."CurrentPeriodStart", bh."Created", now()) as "StartDate",
  coalesce(s."CurrentPeriodEnd", bh."Created", now()) as "EndDate",
  case
    when bh."Status" = 1 then 'paid'
    else 'closed'
  end as "Status",
  bh."Amount" as "TotalAmount",
  coalesce(bh."Created", now()) as "CreatedAt",
  coalesce(bh."LastModified", now()) as "UpdatedAt",
  bh."CreatedBy",
  bh."LastModifiedBy"
from public."BillingHistories" bh
join public."Subscriptions" s
  on s."Id" = bh."SubscriptionId"
join public."BillingOwnerMemberMap" map
  on map."OwnerType" = s."OwnerType"
 and map."OwnerId" = s."OwnerId"
 and map."IsActive" = true
where bh."IsDeleted" = false
  and s."IsDeleted" = false
  and not exists (
    select 1 from public."BillingCycles" bc where bc."Id" = bh."Id"
  );

insert into public."Invoices" (
  "Id",
  "MemberId",
  "BillingCycleId",
  "Total",
  "Status",
  "CreatedAt",
  "UpdatedAt",
  "CreatedBy",
  "LastModifiedBy"
)
select
  bh."Id" as "Id",
  map."MemberId",
  bh."Id" as "BillingCycleId",
  bh."Amount" as "Total",
  case
    when bh."Status" = 1 then 'paid'
    else 'pending'
  end as "Status",
  coalesce(bh."Created", now()) as "CreatedAt",
  coalesce(bh."LastModified", now()) as "UpdatedAt",
  bh."CreatedBy",
  bh."LastModifiedBy"
from public."BillingHistories" bh
join public."Subscriptions" s
  on s."Id" = bh."SubscriptionId"
join public."BillingOwnerMemberMap" map
  on map."OwnerType" = s."OwnerType"
 and map."OwnerId" = s."OwnerId"
 and map."IsActive" = true
where bh."IsDeleted" = false
  and s."IsDeleted" = false
  and not exists (
    select 1 from public."Invoices" i where i."Id" = bh."Id"
  );

commit;
