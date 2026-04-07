-- Dashboard/message RPC drift fixes (manual apply only).
-- This migration is intentionally committed as SQL only; do not auto-apply from the app.
--
-- Also fixes:
-- 1) PostgREST PGRST203 when two get_dashboard_summary overloads exist (uuid vs text args).
-- 2) Dashboard summary no longer queries message logs (message metrics disabled until product is ready).

begin;

drop function if exists public.get_dashboard_summary(text, text, text);

create or replace function public.get_dashboard_summary(
  p_period text default 'last30days',
  p_company_id uuid default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_start timestamptz;
  v_total_properties bigint := 0;
  v_visits bigint := 0;
begin
  select m."Id"
  into v_member_id
  from public."Members" m
  where m."UserId" = coalesce(p_user_id, auth.uid())
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    return jsonb_build_object(
      'visits', jsonb_build_object('currentPeriod', 0),
      'messages', jsonb_build_object('currentPeriod', 0),
      'totalProperties', jsonb_build_object('currentPeriod', 0),
      'propertiesNeedingAttention', '[]'::jsonb
    );
  end if;

  v_start := case
    when p_period = 'last7days' then timezone('utc', now()) - interval '7 days'
    when p_period = 'last90days' then timezone('utc', now()) - interval '90 days'
    when p_period = 'thisyear' then date_trunc('year', timezone('utc', now()))
    else timezone('utc', now()) - interval '30 days'
  end;

  with accessible_properties as (
    select ep."Id"
    from public."EstateProperties" ep
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and (
        (o."OwnerType" = 'member' and o."MemberId" = v_member_id)
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = v_member_id
              and cm."IsDeleted" = false
              and (p_company_id is null or cm."CompanyId" = p_company_id)
          )
        )
      )
      and (
        p_company_id is null
        or (o."OwnerType" = 'company' and o."CompanyId" = p_company_id)
      )
  )
  select count(*)::bigint into v_total_properties
  from accessible_properties;

  with accessible_properties as (
    select ep."Id"
    from public."EstateProperties" ep
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and (
        (o."OwnerType" = 'member' and o."MemberId" = v_member_id)
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = v_member_id
              and cm."IsDeleted" = false
              and (p_company_id is null or cm."CompanyId" = p_company_id)
          )
        )
      )
      and (
        p_company_id is null
        or (o."OwnerType" = 'company' and o."CompanyId" = p_company_id)
      )
  )
  select count(*)::bigint into v_visits
  from public."PropertyVisitLogs" pvl
  join accessible_properties ap
    on ap."Id" = pvl."PropertyId"
  where pvl."VisitedOnUtc" >= v_start;

  return jsonb_build_object(
    'visits', jsonb_build_object('currentPeriod', coalesce(v_visits, 0)),
    'messages', jsonb_build_object('currentPeriod', 0),
    'totalProperties', jsonb_build_object('currentPeriod', coalesce(v_total_properties, 0)),
    'propertiesNeedingAttention', '[]'::jsonb
  );
end;
$$;

create or replace function public.get_messages(
  p_user_id uuid,
  p_page integer default 1,
  p_limit integer default 15,
  p_filter text default 'inbox',
  p_query text default null,
  p_property_id uuid default null,
  p_sort_by text default 'createdAt_desc'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_limit integer := greatest(least(coalesce(p_limit, 15), 100), 1);
  v_offset integer;
  v_total bigint := 0;
  v_total_pages integer := 0;
begin
  v_offset := (v_page - 1) * v_limit;

  select m."Id"
  into v_member_id
  from public."Members" m
  where m."UserId" = coalesce(p_user_id, auth.uid())
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    return jsonb_build_object(
      'data', '[]'::jsonb,
      'total', 0,
      'page', v_page,
      'totalPages', 0
    );
  end if;

  with base as (
    select
      mr."MessageId",
      mr."RecipientId",
      mr."IsRead",
      mr."HasBeenRepliedToByRecipient",
      mr."IsStarred",
      mr."IsArchived",
      mr."IsDeleted" as recipient_deleted,
      msg."ThreadId",
      msg."SenderId",
      msg."PropertyId",
      msg."Subject",
      msg."Body",
      msg."Created",
      msg."IsDeleted" as message_deleted,
      sender."FirstName" as sender_first_name,
      sender."LastName" as sender_last_name,
      sender."Email" as sender_email,
      ll."Title" as property_title
    from public."MessageRecipients" mr
    join public."Messages" msg
      on msg."Id" = mr."MessageId"
    left join public."Members" sender
      on sender."Id" = msg."SenderId"
    left join lateral (
      select l."Title"
      from public."Listings" l
      where l."EstatePropertyId" = msg."PropertyId"
        and l."IsDeleted" = false
      order by l."Created" desc
      limit 1
    ) ll on true
    where mr."RecipientId" = v_member_id
      and coalesce(msg."IsDeleted", false) = false
      and (
        p_property_id is null
        or msg."PropertyId" = p_property_id
      )
      and (
        p_query is null
        or msg."Subject" ilike '%' || p_query || '%'
        or msg."Body" ilike '%' || p_query || '%'
        or coalesce(ll."Title", '') ilike '%' || p_query || '%'
      )
      and (
        p_filter = 'inbox'
        and coalesce(mr."IsDeleted", false) = false
        and coalesce(mr."IsArchived", false) = false
        or p_filter = 'archived'
        and coalesce(mr."IsArchived", false) = true
        and coalesce(mr."IsDeleted", false) = false
        or p_filter = 'starred'
        and coalesce(mr."IsStarred", false) = true
        and coalesce(mr."IsDeleted", false) = false
        or p_filter = 'replied'
        and coalesce(mr."HasBeenRepliedToByRecipient", false) = true
        and coalesce(mr."IsDeleted", false) = false
        or p_filter = 'trash'
        and coalesce(mr."IsDeleted", false) = true
        or p_filter = 'all'
      )
  ),
  counted as (
    select count(*)::bigint as total_rows
    from base
  ),
  paged as (
    select *
    from base
    order by
      case when p_sort_by = 'createdAt_asc' then "Created" end asc,
      case when p_sort_by <> 'createdAt_asc' then "Created" end desc
    limit v_limit
    offset v_offset
  )
  select total_rows into v_total from counted;

  v_total_pages := case
    when v_total = 0 then 0
    else ceil(v_total::numeric / v_limit::numeric)::integer
  end;

  return (
    with base as (
      select
        mr."MessageId",
        msg."ThreadId",
        msg."SenderId",
        msg."PropertyId",
        msg."Subject",
        msg."Body",
        msg."Created",
        mr."IsRead",
        mr."HasBeenRepliedToByRecipient",
        mr."IsStarred",
        mr."IsArchived",
        sender."FirstName" as sender_first_name,
        sender."LastName" as sender_last_name,
        sender."Email" as sender_email,
        ll."Title" as property_title
      from public."MessageRecipients" mr
      join public."Messages" msg
        on msg."Id" = mr."MessageId"
      left join public."Members" sender
        on sender."Id" = msg."SenderId"
      left join lateral (
        select l."Title"
        from public."Listings" l
        where l."EstatePropertyId" = msg."PropertyId"
          and l."IsDeleted" = false
        order by l."Created" desc
        limit 1
      ) ll on true
      where mr."RecipientId" = v_member_id
        and coalesce(msg."IsDeleted", false) = false
        and (
          p_property_id is null
          or msg."PropertyId" = p_property_id
        )
        and (
          p_query is null
          or msg."Subject" ilike '%' || p_query || '%'
          or msg."Body" ilike '%' || p_query || '%'
          or coalesce(ll."Title", '') ilike '%' || p_query || '%'
        )
        and (
          p_filter = 'inbox'
          and coalesce(mr."IsDeleted", false) = false
          and coalesce(mr."IsArchived", false) = false
          or p_filter = 'archived'
          and coalesce(mr."IsArchived", false) = true
          and coalesce(mr."IsDeleted", false) = false
          or p_filter = 'starred'
          and coalesce(mr."IsStarred", false) = true
          and coalesce(mr."IsDeleted", false) = false
          or p_filter = 'replied'
          and coalesce(mr."HasBeenRepliedToByRecipient", false) = true
          and coalesce(mr."IsDeleted", false) = false
          or p_filter = 'trash'
          and coalesce(mr."IsDeleted", false) = true
          or p_filter = 'all'
        )
    ),
    paged as (
      select *
      from base
      order by
        case when p_sort_by = 'createdAt_asc' then "Created" end asc,
        case when p_sort_by <> 'createdAt_asc' then "Created" end desc
      limit v_limit
      offset v_offset
    )
    select jsonb_build_object(
      'data',
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', p."MessageId",
            'threadId', p."ThreadId",
            'senderId', p."SenderId",
            'senderName', nullif(trim(coalesce(p.sender_first_name, '') || ' ' || coalesce(p.sender_last_name, '')), ''),
            'senderEmail', p.sender_email,
            'recipientId', v_member_id,
            'propertyId', p."PropertyId",
            'propertyTitle', p.property_title,
            'subject', coalesce(p."Subject", ''),
            'snippet', left(coalesce(p."Body", ''), 160),
            'createdAt', p."Created",
            'isRead', coalesce(p."IsRead", false),
            'isReplied', coalesce(p."HasBeenRepliedToByRecipient", false),
            'isStarred', coalesce(p."IsStarred", false),
            'isArchived', coalesce(p."IsArchived", false)
          )
        ),
        '[]'::jsonb
      ),
      'total', coalesce(v_total, 0),
      'page', v_page,
      'totalPages', v_total_pages
    )
    from paged p
  );
end;
$$;

create or replace function public.get_dashboard_views_timeseries(
  p_period text default 'last30days',
  p_company_id uuid default null,
  p_user_id uuid default null
)
returns table (
  date date,
  count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_start timestamptz;
begin
  select m."Id"
  into v_member_id
  from public."Members" m
  where m."UserId" = coalesce(p_user_id, auth.uid())
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    return;
  end if;

  v_start := case
    when p_period = 'last7days' then timezone('utc', now()) - interval '7 days'
    when p_period = 'last90days' then timezone('utc', now()) - interval '90 days'
    when p_period = 'thisyear' then date_trunc('year', timezone('utc', now()))
    else timezone('utc', now()) - interval '30 days'
  end;

  return query
  with accessible_properties as (
    select ep."Id"
    from public."EstateProperties" ep
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and (
        (o."OwnerType" = 'member' and o."MemberId" = v_member_id)
        or (
          o."OwnerType" = 'company'
          and exists (
            select 1
            from public."CompanyMembers" cm
            where cm."CompanyId" = o."CompanyId"
              and cm."MemberId" = v_member_id
              and cm."IsDeleted" = false
              and (p_company_id is null or cm."CompanyId" = p_company_id)
          )
        )
      )
      and (
        p_company_id is null
        or (o."OwnerType" = 'company' and o."CompanyId" = p_company_id)
      )
  )
  select
    timezone('utc', pvl."VisitedOnUtc")::date as date,
    count(*)::bigint as count
  from public."PropertyVisitLogs" pvl
  join accessible_properties ap
    on ap."Id" = pvl."PropertyId"
  where pvl."VisitedOnUtc" >= v_start
  group by 1
  order by 1;
end;
$$;

create or replace function public.get_views_by_source(
  p_period text default 'last30days',
  p_company_id uuid default null,
  p_user_id uuid default null
)
returns table (
  source text,
  visits bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_start timestamptz;
  v_source_col_exists boolean := false;
begin
  select m."Id"
  into v_member_id
  from public."Members" m
  where m."UserId" = coalesce(p_user_id, auth.uid())
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    return;
  end if;

  v_start := case
    when p_period = 'last7days' then timezone('utc', now()) - interval '7 days'
    when p_period = 'last90days' then timezone('utc', now()) - interval '90 days'
    when p_period = 'thisyear' then date_trunc('year', timezone('utc', now()))
    else timezone('utc', now()) - interval '30 days'
  end;

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'PropertyVisitLogs'
      and c.column_name = 'Source'
  )
  into v_source_col_exists;

  if v_source_col_exists then
    return query
    with accessible_properties as (
      select ep."Id"
      from public."EstateProperties" ep
      join public."Owners" o
        on o."Id" = ep."OwnerId"
       and o."IsDeleted" = false
      where ep."IsDeleted" = false
        and (
          (o."OwnerType" = 'member' and o."MemberId" = v_member_id)
          or (
            o."OwnerType" = 'company'
            and exists (
              select 1
              from public."CompanyMembers" cm
              where cm."CompanyId" = o."CompanyId"
                and cm."MemberId" = v_member_id
                and cm."IsDeleted" = false
                and (p_company_id is null or cm."CompanyId" = p_company_id)
            )
          )
        )
        and (
          p_company_id is null
          or (o."OwnerType" = 'company' and o."CompanyId" = p_company_id)
        )
    )
    select
      coalesce(nullif(lower(pvl."Source"), ''), 'website') as source,
      count(*)::bigint as visits
    from public."PropertyVisitLogs" pvl
    join accessible_properties ap
      on ap."Id" = pvl."PropertyId"
    where pvl."VisitedOnUtc" >= v_start
    group by 1
    order by 2 desc, 1 asc;
  else
    return query
    with accessible_properties as (
      select ep."Id"
      from public."EstateProperties" ep
      join public."Owners" o
        on o."Id" = ep."OwnerId"
       and o."IsDeleted" = false
      where ep."IsDeleted" = false
        and (
          (o."OwnerType" = 'member' and o."MemberId" = v_member_id)
          or (
            o."OwnerType" = 'company'
            and exists (
              select 1
              from public."CompanyMembers" cm
              where cm."CompanyId" = o."CompanyId"
                and cm."MemberId" = v_member_id
                and cm."IsDeleted" = false
                and (p_company_id is null or cm."CompanyId" = p_company_id)
            )
          )
        )
        and (
          p_company_id is null
          or (o."OwnerType" = 'company' and o."CompanyId" = p_company_id)
        )
    )
    select
      'website'::text as source,
      count(*)::bigint as visits
    from public."PropertyVisitLogs" pvl
    join accessible_properties ap
      on ap."Id" = pvl."PropertyId"
    where pvl."VisitedOnUtc" >= v_start
    group by 1;
  end if;
end;
$$;

grant execute on function public.get_dashboard_summary(text, uuid, uuid) to authenticated;
grant execute on function public.get_messages(uuid, integer, integer, text, text, uuid, text) to authenticated;
grant execute on function public.get_dashboard_views_timeseries(text, uuid, uuid) to authenticated;
grant execute on function public.get_views_by_source(text, uuid, uuid) to authenticated;

commit;
