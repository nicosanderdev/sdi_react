-- Extend handle_new_user to:
-- 1) Copy phone from auth user metadata into Members.Phone
-- 2) Assign Plan BASE-Inicial (looked up by Name) via BillingPlanAssignments
--
-- Do not hardcode plan UUIDs or Key values; resolve by Name for environment portability.

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
declare
  v_member_id uuid;
  v_plan_id uuid;
  v_phone text;
  v_now timestamptz := timezone('utc', now());
begin
  v_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');

  insert into public."Members" (
    "Id",
    "UserId",
    "Email",
    "FirstName",
    "LastName",
    "Phone",
    "Role",
    "IsDeleted",
    "Created",
    "LastModified"
  )
  values (
    gen_random_uuid(),
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'firstName', ''),
    nullif(new.raw_user_meta_data ->> 'lastName', ''),
    v_phone,
    'user',
    false,
    v_now,
    v_now
  )
  on conflict ("UserId") do update
  set
    "Email" = excluded."Email",
    "FirstName" = coalesce(excluded."FirstName", public."Members"."FirstName"),
    "LastName" = coalesce(excluded."LastName", public."Members"."LastName"),
    "Phone" = coalesce(excluded."Phone", public."Members"."Phone"),
    "LastModified" = v_now
  returning "Id" into v_member_id;

  select p."Id"
  into v_plan_id
  from public."Plans" p
  where p."Name" = 'Plan BASE-Inicial'
    and p."IsDeleted" = false
    and coalesce(p."IsActiveV2", p."IsActive", true) = true
  order by p."Key"
  limit 1;

  if v_plan_id is null then
    raise exception 'Default signup plan "Plan BASE-Inicial" not found or inactive';
  end if;

  if not exists (
    select 1
    from public."BillingPlanAssignments" bpa
    where bpa."SubjectType" = 'member'
      and bpa."MemberOrCompanyId" = v_member_id
      and bpa."IsActive" = true
  ) then
    insert into public."BillingPlanAssignments" (
      "SubjectType",
      "MemberOrCompanyId",
      "PlanId",
      "StartDate",
      "IsActive",
      "Created",
      "LastModified"
    ) values (
      'member',
      v_member_id,
      v_plan_id,
      v_now,
      true,
      v_now,
      v_now
    );
  end if;

  return new;
end;
$$;
