-- Replace missing admin_internal.require_admin() with public.is_admin().
-- The admin_internal schema was never created; these RPCs crashed on call.

CREATE OR REPLACE FUNCTION public.get_admin_user_detail(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  avatar_url text,
  phone text,
  street text,
  street2 text,
  city text,
  state text,
  postal_code text,
  country text,
  role text,
  subscription_status text,
  subscription_tier integer,
  subscription_expires_at timestamp with time zone,
  account_status text,
  registration_date timestamp with time zone,
  last_login timestamp with time zone,
  properties_count bigint,
  payment_status text,
  onboarding_step integer,
  onboarding_complete boolean,
  action_history jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  return query
  select
    m."Id",
    m."UserId",
    m."FirstName"::text,
    m."LastName"::text,
    m."Email"::text,
    m."AvatarUrl"::text,
    m."Phone"::text,
    m."Street"::text,
    m."Street2"::text,
    m."City"::text,
    m."State"::text,
    m."PostalCode"::text,
    m."Country"::text,
    m."Role"::text,
    'none'::text as subscription_status,
    null::integer as subscription_tier,
    null::timestamptz as subscription_expires_at,
    (
      case
        when m."IsDeleted" then 'deleted'
        when u.banned_until is not null and u.banned_until > timezone('utc', now()) then 'suspended'
        else 'active'
      end
    )::text as account_status,
    m."Created"::timestamptz as registration_date,
    u.last_sign_in_at::timestamptz as last_login,
    0::bigint as properties_count,
    'none'::text as payment_status,
    coalesce(m."OnboardingStep", 0)::integer as onboarding_step,
    coalesce(m."OnboardingComplete", false) as onboarding_complete,
    '[]'::jsonb as action_history
  from public."Members" m
  join auth.users u on u.id = m."UserId"
  where m."Id" = p_user_id
  limit 1;
end;
$$;


CREATE OR REPLACE FUNCTION public.reactivate_user(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public."Members"
  set "LastModified" = timezone('utc', now())
  where "Id" = p_member_id;

  return jsonb_build_object('success', true, 'message', 'User reactivated');
end;
$$;


CREATE OR REPLACE FUNCTION public.reset_user_onboarding(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public."Members"
  set
    "OnboardingStep" = 0,
    "OnboardingComplete" = false,
    "LastModified" = timezone('utc', now())
  where "Id" = p_member_id;

  return jsonb_build_object('success', true, 'message', 'Onboarding reset');
end;
$$;


CREATE OR REPLACE FUNCTION public.soft_delete_user(p_member_id uuid, p_reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public."Members"
  set
    "IsDeleted" = true,
    "LastModified" = timezone('utc', now())
  where "Id" = p_member_id;

  return jsonb_build_object('success', true, 'message', 'User soft-deleted');
end;
$$;


CREATE OR REPLACE FUNCTION public.suspend_user(p_member_id uuid, p_reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public."Members"
  set "LastModified" = timezone('utc', now())
  where "Id" = p_member_id;

  return jsonb_build_object('success', true, 'message', 'User suspended');
end;
$$;


CREATE OR REPLACE FUNCTION public.update_user_role(p_member_id uuid, p_new_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public."Members"
  set
    "Role" = p_new_role,
    "LastModified" = timezone('utc', now())
  where "Id" = p_member_id;

  return jsonb_build_object('success', true, 'message', 'Role updated');
end;
$$;
