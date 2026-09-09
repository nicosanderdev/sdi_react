-- Admin companies management migration scaffold
-- NOTE: This file is intended for manual DB execution by the project owner.

begin;

alter table if exists public."UserCompanies" rename to "CompanyMembers";

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'FK_UserCompanies_Companies_CompanyId'
  ) then
    alter table public."CompanyMembers"
      rename constraint "FK_UserCompanies_Companies_CompanyId" to "FK_CompanyMembers_Companies_CompanyId";
  end if;
end $$;

create or replace function public.admin_companies_metrics()
returns table (
  total_companies bigint,
  active_companies bigint,
  companies_created_this_month bigint
)
language sql
security definer
as $$
  select
    (select count(*) from public."Companies") as total_companies,
    (select count(*) from public."Companies" c where c."IsDeleted" = false) as active_companies,
    (
      select count(*)
      from public."Companies" c
      where c."CreatedAt" >= date_trunc('month', now())
    ) as companies_created_this_month;
$$;

create or replace function public.admin_companies_list(
  p_search text default null,
  p_status text default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
  p_page integer default 1,
  p_limit integer default 10
)
returns table (
  id uuid,
  name varchar,
  billing_email varchar,
  created_at timestamptz,
  is_deleted boolean,
  members_count bigint
)
language sql
security definer
as $$
  with filtered as (
    select c.*
    from public."Companies" c
    where
      (p_search is null or c."Name" ilike '%' || p_search || '%' or c."BillingEmail" ilike '%' || p_search || '%')
      and (
        p_status is null
        or (p_status = 'active' and c."IsDeleted" = false)
        or (p_status = 'deleted' and c."IsDeleted" = true)
      )
      and (p_created_from is null or c."CreatedAt" >= p_created_from)
      and (p_created_to is null or c."CreatedAt" <= p_created_to)
  )
  select
    c."Id" as id,
    c."Name" as name,
    c."BillingEmail" as billing_email,
    c."CreatedAt" as created_at,
    c."IsDeleted" as is_deleted,
    coalesce(cm_count.cnt, 0)::bigint as members_count
  from filtered c
  left join lateral (
    select count(*) as cnt
    from public."CompanyMembers" cm
    where cm."CompanyId" = c."Id" and cm."IsDeleted" = false
  ) cm_count on true
  order by c."CreatedAt" desc
  offset greatest((p_page - 1) * p_limit, 0)
  limit greatest(p_limit, 1);
$$;

create or replace function public.admin_company_detail(
  p_company_id uuid
)
returns table (
  company_id uuid,
  company_name varchar,
  company_billing_email varchar,
  company_description varchar,
  company_created_at timestamptz,
  member_row_id uuid,
  member_id uuid,
  member_name text,
  member_email varchar,
  member_role text,
  member_joined_at timestamptz
)
language sql
security definer
as $$
  select
    c."Id" as company_id,
    c."Name" as company_name,
    c."BillingEmail" as company_billing_email,
    c."Description" as company_description,
    c."CreatedAt" as company_created_at,
    cm."Id" as member_row_id,
    m."Id" as member_id,
    trim(coalesce(m."FirstName", '') || ' ' || coalesce(m."LastName", '')) as member_name,
    m."Email" as member_email,
    cm."Role" as member_role,
    cm."JoinedAt" as member_joined_at
  from public."Companies" c
  left join public."CompanyMembers" cm
    on cm."CompanyId" = c."Id"
    and cm."IsDeleted" = false
  left join public."Members" m
    on m."Id" = cm."MemberId"
    and m."IsDeleted" = false
  where c."Id" = p_company_id;
$$;

create or replace function public.admin_add_company_member_by_email(
  p_company_id uuid,
  p_email text,
  p_added_by uuid,
  p_role text default 'Member'
)
returns table (
  success boolean,
  message text
)
language plpgsql
security definer
as $$
declare
  v_member_id uuid;
begin
  select m."Id"
  into v_member_id
  from public."Members" m
  where lower(m."Email") = lower(trim(p_email))
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    return query select false, 'No existe un usuario con ese correo.';
    return;
  end if;

  if exists (
    select 1
    from public."CompanyMembers" cm
    where cm."CompanyId" = p_company_id
      and cm."MemberId" = v_member_id
      and cm."IsDeleted" = false
  ) then
    return query select false, 'El usuario ya está vinculado a esta compañía.';
    return;
  end if;

  insert into public."CompanyMembers" (
    "MemberId",
    "CompanyId",
    "Role",
    "AddedBy",
    "JoinedAt",
    "IsDeleted"
  )
  values (
    v_member_id,
    p_company_id,
    p_role,
    p_added_by,
    now(),
    false
  );

  return query select true, 'Usuario agregado correctamente.';
end;
$$;

create or replace function public.admin_update_company(
  p_company_id uuid,
  p_name text,
  p_billing_email text,
  p_description text default null,
  p_phone text default null,
  p_last_modified_by text default null
)
returns table (
  id uuid,
  name varchar,
  billing_email varchar,
  description varchar,
  phone varchar
)
language sql
security definer
as $$
  update public."Companies" c
  set
    "Name" = p_name,
    "BillingEmail" = p_billing_email,
    "Description" = p_description,
    "Phone" = p_phone,
    "LastModified" = now(),
    "LastModifiedBy" = p_last_modified_by
  where c."Id" = p_company_id
  returning
    c."Id",
    c."Name",
    c."BillingEmail",
    c."Description",
    c."Phone";
$$;

create or replace function public.user_can_access_subscription(
  p_subscription_id uuid
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public."Subscriptions" s
    where s."Id" = p_subscription_id
      and s."IsDeleted" = false
      and (
        (s."OwnerType" = 0 and s."OwnerId" = auth.uid())
        or (
          s."OwnerType" = 1
          and exists (
            select 1
            from public."CompanyMembers" cm
            join public."Members" m
              on m."Id" = cm."MemberId"
             and m."IsDeleted" = false
            where cm."CompanyId" = s."OwnerId"::uuid
              and cm."IsDeleted" = false
              and m."UserId" = auth.uid()
          )
        )
      )
  );
$$;

create or replace function public.user_can_access_booking_receipt(
  p_booking_receipt_id uuid
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public."BookingReceipts" br
    where br."Id" = p_booking_receipt_id
      and (
        public.is_admin()
        or (
          br."SubscriptionId" is not null
          and public.user_can_access_subscription(br."SubscriptionId")
        )
      )
  );
$$;

alter table public."BookingReceipts" enable row level security;
alter table public."BookingReceiptItems" enable row level security;
alter table public."Companies" enable row level security;

drop policy if exists booking_receipts_select_policy on public."BookingReceipts";
create policy booking_receipts_select_policy
on public."BookingReceipts"
for select
using (
  public.is_admin()
  or (
    "SubscriptionId" is not null
    and public.user_can_access_subscription("SubscriptionId")
  )
);

drop policy if exists booking_receipts_insert_policy on public."BookingReceipts";
create policy booking_receipts_insert_policy
on public."BookingReceipts"
for insert
with check (
  public.is_admin()
  or (
    "SubscriptionId" is not null
    and public.user_can_access_subscription("SubscriptionId")
  )
);

drop policy if exists booking_receipts_update_policy on public."BookingReceipts";
create policy booking_receipts_update_policy
on public."BookingReceipts"
for update
using (
  public.is_admin()
  or (
    "SubscriptionId" is not null
    and public.user_can_access_subscription("SubscriptionId")
  )
)
with check (
  public.is_admin()
  or (
    "SubscriptionId" is not null
    and public.user_can_access_subscription("SubscriptionId")
  )
);

drop policy if exists booking_receipt_items_select_policy on public."BookingReceiptItems";
create policy booking_receipt_items_select_policy
on public."BookingReceiptItems"
for select
using (
  public.user_can_access_booking_receipt("BookingReceiptId")
);

drop policy if exists booking_receipt_items_insert_policy on public."BookingReceiptItems";
create policy booking_receipt_items_insert_policy
on public."BookingReceiptItems"
for insert
with check (
  public.user_can_access_booking_receipt("BookingReceiptId")
);

drop policy if exists booking_receipt_items_update_policy on public."BookingReceiptItems";
create policy booking_receipt_items_update_policy
on public."BookingReceiptItems"
for update
using (
  public.user_can_access_booking_receipt("BookingReceiptId")
)
with check (
  public.user_can_access_booking_receipt("BookingReceiptId")
);

drop policy if exists companies_select_policy on public."Companies";
create policy companies_select_policy
on public."Companies"
for select
using (
  public.is_admin()
  or exists (
    select 1
    from public."CompanyMembers" cm
    join public."Members" m
      on m."Id" = cm."MemberId"
     and m."IsDeleted" = false
    where cm."CompanyId" = "Companies"."Id"
      and cm."IsDeleted" = false
      and m."UserId" = auth.uid()
  )
);

drop policy if exists companies_update_policy on public."Companies";
create policy companies_update_policy
on public."Companies"
for update
using (
  public.is_admin()
  or exists (
    select 1
    from public."CompanyMembers" cm
    join public."Members" m
      on m."Id" = cm."MemberId"
     and m."IsDeleted" = false
    where cm."CompanyId" = "Companies"."Id"
      and cm."IsDeleted" = false
      and cm."Role" in ('Admin', 'Manager')
      and m."UserId" = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public."CompanyMembers" cm
    join public."Members" m
      on m."Id" = cm."MemberId"
     and m."IsDeleted" = false
    where cm."CompanyId" = "Companies"."Id"
      and cm."IsDeleted" = false
      and cm."Role" in ('Admin', 'Manager')
      and m."UserId" = auth.uid()
  )
);

drop policy if exists companies_delete_policy on public."Companies";
create policy companies_delete_policy
on public."Companies"
for delete
using (
  exists (
    select 1
    from public."CompanyMembers" cm
    join public."Members" m
      on m."Id" = cm."MemberId"
     and m."IsDeleted" = false
    where cm."CompanyId" = "Companies"."Id"
      and cm."IsDeleted" = false
      and cm."Role" in ('Admin', 'Manager')
      and m."UserId" = auth.uid()
  )
);

commit;
