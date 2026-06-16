-- Admin-only stats for a single company (edit page): active listings, linked users, unpublished/inactive inventory.

begin;

create or replace function public.get_admin_company_edit_stats(p_company_id uuid)
returns table (
  active_owned_properties bigint,
  linked_users bigint,
  unpublished_or_inactive bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
  v_total bigint;
  v_active bigint;
  v_linked bigint;
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

  select count(*)::bigint
  into v_linked
  from public."CompanyMembers" cm
  where cm."CompanyId" = p_company_id
    and cm."IsDeleted" = false;

  with latest_listing as (
    select distinct on (l."EstatePropertyId")
      l."EstatePropertyId",
      l."IsActive",
      l."IsPropertyVisible"
    from public."Listings" l
    where l."IsDeleted" = false
    order by l."EstatePropertyId", l."Created" desc
  ),
  company_props as (
    select ep."Id"
    from public."EstateProperties" ep
    join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
    where ep."IsDeleted" = false
      and o."OwnerType" = 'company'
      and o."CompanyId" = p_company_id
  )
  select
    (select count(*)::bigint from company_props),
    (
      select count(*)::bigint
      from company_props cp
      join latest_listing ll on ll."EstatePropertyId" = cp."Id"
      where ll."IsActive" = true
        and ll."IsPropertyVisible" = true
    )
  into v_total, v_active;

  return query
  select
    coalesce(v_active, 0)::bigint as active_owned_properties,
    coalesce(v_linked, 0)::bigint as linked_users,
    greatest(coalesce(v_total, 0) - coalesce(v_active, 0), 0)::bigint as unpublished_or_inactive;
end;
$$;

grant execute on function public.get_admin_company_edit_stats(uuid) to authenticated;
grant execute on function public.get_admin_company_edit_stats(uuid) to service_role;

commit;
