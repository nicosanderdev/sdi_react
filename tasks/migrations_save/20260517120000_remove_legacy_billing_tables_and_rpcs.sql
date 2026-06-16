-- Remove legacy booking-receipt billing, unused metering tables, and old tier subscription row.
-- Canonical billing remains: Plans, MemberPlans, BillingOwnerMemberMap, UsageRecords, BillingCycles, Invoices, MemberActionHistory.
-- Apply after app no longer calls BookingReceiptService / receipts-apply-overdue-blocks.

-- ---------------------------------------------------------------------------
-- 1) Admin audit log without BookingReceipts branch
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_logs_for_date(p_date date)
returns table (
  event_type text,
  action text,
  at timestamp with time zone,
  target_id uuid,
  target_display text,
  performed_by_display text,
  details jsonb
)
language sql
set search_path to 'public'
as $$
  select event_type, action, at, target_id, target_display, performed_by_display, details
  from (
    select
      'user'::text as event_type,
      mah."ActionType"::text as action,
      mah."PerformedAt" as at,
      mah."MemberId" as target_id,
      trim(coalesce(t."FirstName", '') || ' ' || coalesce(t."LastName", ''))
        || coalesce(' <' || nullif(trim(t."Email"), '') || '>', '') as target_display,
      coalesce(
        nullif(trim(coalesce(p."FirstName", '') || ' ' || coalesce(p."LastName", '')), ''),
        nullif(trim(p."Email"), ''),
        mah."PerformedBy"::text,
        'Unknown User'
      ) as performed_by_display,
      mah."ActionDetails" as details
    from public."MemberActionHistory" mah
    join public."Members" t on t."Id" = mah."MemberId" and t."IsDeleted" = false
    left join public."Members" p on p."Id" = mah."PerformedBy" and p."IsDeleted" = false
    where mah."IsDeleted" = false
      and mah."PerformedAt" >= p_date::timestamptz
      and mah."PerformedAt" < (p_date + interval '1 day')::timestamptz

    union all

    select
      'property'::text as event_type,
      pma."ActionType"::text as action,
      pma."PerformedAt" as at,
      pma."PropertyId" as target_id,
      coalesce(ll."Title", '') as target_display,
      coalesce(
        nullif(trim(coalesce(m."FirstName", '') || ' ' || coalesce(m."LastName", '')), ''),
        nullif(trim(m."Email"), ''),
        pma."PerformedBy"::text,
        'Unknown User'
      ) as performed_by_display,
      jsonb_build_object('reason', pma."Reason") as details
    from public."PropertyModerationActions" pma
    join public."EstateProperties" ep
      on ep."Id" = pma."PropertyId" and ep."IsDeleted" = false
    left join lateral (
      select l."Title"
      from public."Listings" l
      where l."EstatePropertyId" = pma."PropertyId" and l."IsDeleted" = false
      order by l."Created" desc
      limit 1
    ) ll on true
    left join public."Members" m
      on m."UserId" = pma."PerformedBy" and m."IsDeleted" = false
    where pma."IsDeleted" = false
      and pma."PerformedAt" >= p_date::timestamptz
      and pma."PerformedAt" < (p_date + interval '1 day')::timestamptz

    union all

    select
      'booking'::text as event_type,
      'created'::text as action,
      b."Created" as at,
      b."Id" as target_id,
      'Booking ' || b."Id"::text as target_display,
      coalesce(
        nullif(trim(coalesce(mc_id."FirstName", '') || ' ' || coalesce(mc_id."LastName", '')), ''),
        nullif(trim(mc_id."Email"), ''),
        nullif(trim(coalesce(mc_user."FirstName", '') || ' ' || coalesce(mc_user."LastName", '')), ''),
        nullif(trim(mc_user."Email"), ''),
        nullif(b."CreatedBy", ''),
        'Unknown User'
      ) as performed_by_display,
      jsonb_build_object('estatePropertyId', b."EstatePropertyId", 'checkIn', b."CheckInDate", 'checkOut', b."CheckOutDate") as details
    from public."Bookings" b
    left join public."Members" mc_id
      on mc_id."Id"::text = b."CreatedBy" and mc_id."IsDeleted" = false
    left join public."Members" mc_user
      on mc_user."UserId"::text = b."CreatedBy" and mc_user."IsDeleted" = false
    where b."IsDeleted" = false
      and b."Created" >= p_date::timestamptz
      and b."Created" < (p_date + interval '1 day')::timestamptz

    union all

    select
      'booking'::text as event_type,
      'updated'::text as action,
      b."LastModified" as at,
      b."Id" as target_id,
      'Booking ' || b."Id"::text as target_display,
      coalesce(
        nullif(trim(coalesce(mu_id."FirstName", '') || ' ' || coalesce(mu_id."LastName", '')), ''),
        nullif(trim(mu_id."Email"), ''),
        nullif(trim(coalesce(mu_user."FirstName", '') || ' ' || coalesce(mu_user."LastName", '')), ''),
        nullif(trim(mu_user."Email"), ''),
        nullif(b."LastModifiedBy", ''),
        'Unknown User'
      ) as performed_by_display,
      jsonb_build_object('estatePropertyId', b."EstatePropertyId", 'checkIn', b."CheckInDate", 'checkOut', b."CheckOutDate") as details
    from public."Bookings" b
    left join public."Members" mu_id
      on mu_id."Id"::text = b."LastModifiedBy" and mu_id."IsDeleted" = false
    left join public."Members" mu_user
      on mu_user."UserId"::text = b."LastModifiedBy" and mu_user."IsDeleted" = false
    where b."IsDeleted" = false
      and b."LastModified" >= p_date::timestamptz
      and b."LastModified" < (p_date + interval '1 day')::timestamptz
      and b."LastModified" <> b."Created"
  ) logs
  order by at desc;
$$;

-- ---------------------------------------------------------------------------
-- 2) Drop RLS policies on legacy receipt tables (before DROP TABLE)
-- ---------------------------------------------------------------------------
drop policy if exists booking_receipt_items_select_policy on public."BookingReceiptItems";
drop policy if exists booking_receipt_items_insert_policy on public."BookingReceiptItems";
drop policy if exists booking_receipt_items_update_policy on public."BookingReceiptItems";

drop policy if exists booking_receipts_select_policy on public."BookingReceipts";
drop policy if exists booking_receipts_insert_policy on public."BookingReceipts";
drop policy if exists booking_receipts_update_policy on public."BookingReceipts";

alter table if exists public."BookingReceiptItems" disable row level security;
alter table if exists public."BookingReceipts" disable row level security;

-- ---------------------------------------------------------------------------
-- 3) Drop legacy admin RPCs and RLS helpers (signatures from 20260330120000 / 20260331110000)
-- ---------------------------------------------------------------------------
drop function if exists public.admin_generate_booking_receipt(uuid[]);
drop function if exists public.admin_get_booking_receipts(text, text, date, date, integer);
drop function if exists public.admin_set_booking_receipt_status(uuid, boolean);
drop function if exists public.user_can_access_booking_receipt(uuid);
drop function if exists public.user_can_access_subscription(uuid);

-- ---------------------------------------------------------------------------
-- 4) Drop legacy tables (child first)
-- ---------------------------------------------------------------------------
drop table if exists public."BookingReceiptItems" cascade;
drop table if exists public."BookingReceipts" cascade;

drop table if exists public."BillingHistories" cascade;
drop table if exists public."Usages" cascade;
drop table if exists public."MemberStatus" cascade;

-- ---------------------------------------------------------------------------
-- 5) Members -> MemberSubscriptions FK and table
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'Members'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) ilike '%MemberSubscriptions%'
  loop
    execute format('alter table public."Members" drop constraint %I', r.conname);
  end loop;
end $$;

alter table if exists public."Members" drop column if exists "MemberSubscriptionId";

drop table if exists public."MemberSubscriptions" cascade;

-- ---------------------------------------------------------------------------
-- 6) Legacy owner subscription rows (receipts / old RLS only)
-- ---------------------------------------------------------------------------
drop table if exists public."Subscriptions" cascade;
drop table if exists public."SubscriptionsLegacy" cascade;
