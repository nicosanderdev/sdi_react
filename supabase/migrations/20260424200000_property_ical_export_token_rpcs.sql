-- iCal export token RPCs for SummerRentExtension.
-- Note: "SummerRentExtension" has no "IsDeleted" column in this schema (filter by "EstatePropertyId" only).
-- get_property_ical_export_token: owners/admins + service_role (ical-export edge validation).
-- regenerate_property_ical_export_token: authenticated owners/admins only.

begin;

alter table public."SummerRentExtension"
  add column if not exists "ICalExportToken" uuid;

-- Previous deployments may have used returns uuid; replace with text for API/clients.
-- CREATE OR REPLACE cannot change return type; drop first if an older signature exists.
drop function if exists public.get_property_ical_export_token(uuid);
drop function if exists public.regenerate_property_ical_export_token(uuid);

-- ---------------------------------------------------------------------------
-- Read token (browser: property access; edge: service_role reads DB token)
-- ---------------------------------------------------------------------------
create or replace function public.get_property_ical_export_token(property_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_member_id uuid;
  v_is_admin boolean;
  v_token uuid;
begin
  if auth.role() = 'service_role' then
    select s."ICalExportToken" into v_token
    from public."SummerRentExtension" s
    where s."EstatePropertyId" = property_id;

    if not found then
      raise exception 'Summer rent extension not found for property'
        using errcode = 'P0001';
    end if;

    if v_token is null then
      v_token := gen_random_uuid();
      update public."SummerRentExtension" s
      set "ICalExportToken" = v_token,
          "LastModified" = now()
      where s."EstatePropertyId" = property_id;
    end if;

    return v_token::text;
  end if;

  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'P0001';
  end if;

  select m."Id", lower(coalesce(m."Role", '')) = 'admin'
  into v_member_id, v_is_admin
  from public."Members" m
  where m."UserId" = v_uid
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    raise exception 'Member not found'
      using errcode = 'P0001';
  end if;

  if not (
    v_is_admin
    or exists (
      select 1
      from public."EstateProperties" ep
      join public."Owners" o on o."Id" = ep."OwnerId" and o."IsDeleted" = false
      where ep."Id" = property_id
        and ep."IsDeleted" = false
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
            )
          )
        )
    )
  ) then
    raise exception 'Access denied'
      using errcode = 'P0001';
  end if;

  select s."ICalExportToken" into v_token
  from public."SummerRentExtension" s
  where s."EstatePropertyId" = property_id;

  if not found then
    raise exception 'No summer rental extension for this property'
      using errcode = 'P0001';
  end if;

  if v_token is null then
    v_token := gen_random_uuid();
    update public."SummerRentExtension" s
    set "ICalExportToken" = v_token,
        "LastModified" = now()
    where s."EstatePropertyId" = property_id;
  end if;

  return v_token::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Regenerate token (dashboard only; same access as get for authenticated)
-- ---------------------------------------------------------------------------
create or replace function public.regenerate_property_ical_export_token(property_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_member_id uuid;
  v_is_admin boolean;
  v_new_token uuid := gen_random_uuid();
begin
  if auth.role() = 'service_role' then
    raise exception 'Not allowed'
      using errcode = 'P0001';
  end if;

  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'P0001';
  end if;

  select m."Id", lower(coalesce(m."Role", '')) = 'admin'
  into v_member_id, v_is_admin
  from public."Members" m
  where m."UserId" = v_uid
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    raise exception 'Member not found'
      using errcode = 'P0001';
  end if;

  if not (
    v_is_admin
    or exists (
      select 1
      from public."EstateProperties" ep
      join public."Owners" o on o."Id" = ep."OwnerId" and o."IsDeleted" = false
      where ep."Id" = property_id
        and ep."IsDeleted" = false
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
            )
          )
        )
    )
  ) then
    raise exception 'Access denied'
      using errcode = 'P0001';
  end if;

  update public."SummerRentExtension" s
  set "ICalExportToken" = v_new_token,
      "LastModified" = now()
  where s."EstatePropertyId" = property_id;

  if not found then
    raise exception 'Summer rent extension not found for property'
      using errcode = 'P0001';
  end if;

  return v_new_token::text;
end;
$$;

grant execute on function public.get_property_ical_export_token(uuid) to authenticated;
grant execute on function public.get_property_ical_export_token(uuid) to service_role;
grant execute on function public.regenerate_property_ical_export_token(uuid) to authenticated;

commit;
