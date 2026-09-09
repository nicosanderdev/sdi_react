-- Admin console RPC fixes (manual apply).
-- - get_admin_properties_list: use CompanyMembers (not UserCompanies) for owner filters.
-- - get_admin_property_views_summary: aggregates from PropertyVisitLogs (admin-only).
-- - get_admin_logs_for_date: canonical body without Subscriptions (resets drift if DB had extra branches).
-- - user_can_access_subscription: works when "Subscriptions" was renamed to "SubscriptionsLegacy" or dropped.

begin;

-- ---------------------------------------------------------------------------
-- Admin property list (parity with live DB; UserCompanies -> CompanyMembers)
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_properties_list(
  p_page integer default 1,
  p_limit integer default 20,
  p_user_id uuid default null::uuid,
  p_status text default null::text,
  p_location text default null::text,
  p_search text default null::text
)
returns table (
  id uuid,
  title character varying,
  owner_name text,
  owner_email character varying,
  city character varying,
  state character varying,
  status integer,
  is_active boolean,
  is_property_visible boolean,
  created timestamp with time zone,
  last_modified timestamp with time zone,
  total_count bigint
)
language plpgsql
as $$
begin
  return query
  with latest_listing as (
    select distinct on (l."EstatePropertyId")
      l."EstatePropertyId",
      l."Title",
      l."Status",
      l."IsActive",
      l."IsPropertyVisible"
    from public."Listings" l
    where l."IsDeleted" = false
    order by l."EstatePropertyId", l."Created" desc
  ),
  filtered_properties as (
    select
      ep."Id",
      ll."Title" as "Title",
      case
        when o."OwnerType" = 'member' then concat(m."FirstName", ' ', m."LastName")
        when o."OwnerType" = 'company' then c."Name"
        else 'Unknown Owner'
      end as owner_name,
      case
        when o."OwnerType" = 'member' then m."Email"
        when o."OwnerType" = 'company' then c."BillingEmail"
        else null
      end as owner_email,
      ep."City",
      ep."State",
      ll."Status",
      ll."IsActive",
      ll."IsPropertyVisible",
      coalesce(re."Created", ev."Created", sr."Created") as "Created",
      coalesce(re."LastModified", ev."LastModified", sr."LastModified") as "LastModified"
    from public."EstateProperties" ep
    join latest_listing ll on ep."Id" = ll."EstatePropertyId"
    join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
    left join public."Members" m on o."OwnerType" = 'member' and o."MemberId" = m."Id" and m."IsDeleted" = false
    left join public."Companies" c on o."OwnerType" = 'company' and o."CompanyId" = c."Id" and c."IsDeleted" = false
    left join public."RealEstateExtension" re on re."EstatePropertyId" = ep."Id"
    left join public."EventVenueExtension" ev on ev."EstatePropertyId" = ep."Id"
    left join public."SummerRentExtension" sr on sr."EstatePropertyId" = ep."Id"
    where ep."IsDeleted" = false
      and (
        p_user_id is null
        or (
          (o."OwnerType" = 'member' and o."MemberId" = p_user_id)
          or (
            o."OwnerType" = 'company'
            and exists (
              select 1
              from public."CompanyMembers" cm
              where cm."CompanyId" = o."CompanyId"
                and cm."MemberId" = p_user_id
                and cm."IsDeleted" = false
            )
          )
        )
      )
      and (
        p_status is null
        or ll."Status" = case
          when p_status = 'sale' then 0
          when p_status = 'rent' then 1
          when p_status = 'reserved' then 2
          when p_status = 'sold' then 3
          when p_status = 'unavailable' then 4
          else ll."Status"
        end
      )
      and (
        p_location is null
        or ep."City" ilike '%' || p_location || '%'
        or ep."State" ilike '%' || p_location || '%'
        or concat(ep."City", ', ', ep."State") ilike '%' || p_location || '%'
      )
      and (
        p_search is null
        or ll."Title" ilike '%' || p_search || '%'
        or case
          when o."OwnerType" = 'member' then concat(m."FirstName", ' ', m."LastName")
          when o."OwnerType" = 'company' then c."Name"
          else ''
        end ilike '%' || p_search || '%'
        or ep."City" ilike '%' || p_search || '%'
        or ep."State" ilike '%' || p_search || '%'
      )
    order by coalesce(re."Created", ev."Created", sr."Created") desc
  ),
  total_count as (
    select count(*)::bigint as count
    from filtered_properties
  )
  select
    fp."Id",
    fp."Title"::character varying,
    fp.owner_name,
    fp.owner_email::character varying,
    fp."City"::character varying,
    fp."State"::character varying,
    fp."Status",
    fp."IsActive",
    fp."IsPropertyVisible",
    fp."Created",
    fp."LastModified",
    tc.count
  from filtered_properties fp
  cross join total_count tc
  limit p_limit
  offset ((p_page - 1) * p_limit);
end;
$$;

-- ---------------------------------------------------------------------------
-- Property visit aggregates for admin dashboard (PropertyVisitLogs.PropertyId -> EstateProperties.Id)
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_property_views_summary(
  p_period_7d text default null,
  p_period_30d text default null
)
returns table (
  "totalPropertyViews" bigint,
  "viewsLast7Days" bigint,
  "viewsLast30Days" bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
begin
  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Forbidden: admin only';
  end if;

  return query
  select
    (
      select count(*)::bigint
      from public."PropertyVisitLogs" pvl
      join public."EstateProperties" ep
        on ep."Id" = pvl."PropertyId"
       and ep."IsDeleted" = false
    ) as "totalPropertyViews",
    (
      select count(*)::bigint
      from public."PropertyVisitLogs" pvl
      join public."EstateProperties" ep
        on ep."Id" = pvl."PropertyId"
       and ep."IsDeleted" = false
      where pvl."VisitedOnUtc" >= (timezone('utc', now()) - interval '7 days')
    ) as "viewsLast7Days",
    (
      select count(*)::bigint
      from public."PropertyVisitLogs" pvl
      join public."EstateProperties" ep
        on ep."Id" = pvl."PropertyId"
       and ep."IsDeleted" = false
      where pvl."VisitedOnUtc" >= (timezone('utc', now()) - interval '30 days')
    ) as "viewsLast30Days";
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin audit log for a single calendar day (no legacy Subscriptions reference)
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

    union all

    select
      'booking'::text as event_type,
      'RECEIPT_MARKED_AS_PAID'::text as action,
      br."LastModified" as at,
      br."Id" as target_id,
      'Receipt ' || br."Id"::text as target_display,
      coalesce(
        nullif(trim(coalesce(rm_id."FirstName", '') || ' ' || coalesce(rm_id."LastName", '')), ''),
        nullif(trim(rm_id."Email"), ''),
        nullif(trim(coalesce(rm_user."FirstName", '') || ' ' || coalesce(rm_user."LastName", '')), ''),
        nullif(trim(rm_user."Email"), ''),
        nullif(br."LastModifiedBy", ''),
        'Unknown User'
      ) as performed_by_display,
      jsonb_build_object(
        'receiptId', br."Id",
        'bookingIds', coalesce((
          select jsonb_agg(bri."BookingId" order by bri."BookingId")
          from public."BookingReceiptItems" bri
          where bri."BookingReceiptId" = br."Id"
        ), '[]'::jsonb)
      ) as details
    from public."BookingReceipts" br
    left join public."Members" rm_id
      on rm_id."Id"::text = br."LastModifiedBy" and rm_id."IsDeleted" = false
    left join public."Members" rm_user
      on rm_user."UserId"::text = br."LastModifiedBy" and rm_user."IsDeleted" = false
    where br."IsDeleted" = false
      and br."Status" = 1
      and br."PaidAt" is not null
      and br."LastModified" >= p_date::timestamptz
      and br."LastModified" < (p_date + interval '1 day')::timestamptz
  ) logs
  order by at desc;
$$;

-- ---------------------------------------------------------------------------
-- Receipt RLS helper: support Subscriptions renamed to SubscriptionsLegacy
-- ---------------------------------------------------------------------------
create or replace function public.user_can_access_subscription(
  p_subscription_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  if to_regclass('public."Subscriptions"') is not null then
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
    )
    into v_ok;
    return coalesce(v_ok, false);
  end if;

  if to_regclass('public."SubscriptionsLegacy"') is not null then
    select exists (
      select 1
      from public."SubscriptionsLegacy" s
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
    )
    into v_ok;
    return coalesce(v_ok, false);
  end if;

  return false;
end;
$$;

commit;
