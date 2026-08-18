-- Extend handle_new_user so OAuth providers (Google/Facebook) that send
-- full_name or name populate Members.FirstName / LastName when firstName/lastName
-- metadata from email signup is absent.
--
-- Keeps phone from metadata, Role user, Plan BASE-Inicial assignment, and
-- ON CONFLICT ("UserId") merge behavior.

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
declare
  v_member_id uuid;
  v_plan_id uuid;
  v_phone text;
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_space_pos int;
  v_now timestamptz := timezone('utc', now());
begin
  v_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');

  v_first_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'firstName', '')), '');
  v_last_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'lastName', '')), '');

  if v_first_name is null and v_last_name is null then
    v_full_name := nullif(
      trim(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          ''
        )
      ),
      ''
    );

    if v_full_name is not null then
      v_space_pos := position(' ' in v_full_name);
      if v_space_pos > 0 then
        v_first_name := nullif(trim(substring(v_full_name from 1 for v_space_pos - 1)), '');
        v_last_name := nullif(trim(substring(v_full_name from v_space_pos + 1)), '');
      else
        v_first_name := v_full_name;
        v_last_name := null;
      end if;
    end if;
  end if;

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
    v_first_name,
    v_last_name,
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
